// World calibration statistics (DESIGN §3.7, §3.18; BALANCE T-01, T-02). Generates seeded worlds with the full
// generator and measures class shares (all parcels, held, open, and the steady-state listing pool), grade and strip
// distributions, pockets, coarse gold, parcel counts, held shares and mixes against the §3.7 / §3.18 bands.
// Truth-reading by design: simulator and tests only.
import { baseTuning, type TuningResolved } from '../../src/data/tuning';
import {
  ECON_CLASSES,
  claimTruth,
  generateWorld,
  listingPoolWeights,
  refEconomics,
  templateOf,
  type BlockState,
  type Claim,
  type ClaimTruth,
  type EconClass,
  type RefEconResult,
  type WorldSlice,
} from '../../src/engine/systems/world';
import { formatId } from '../../src/engine/core/ids';
import { regionTemplate } from '../../src/data/regions';

export interface CalibrationOptions {
  /** Two-district worlds (northernFederal + aridFederal), so N worlds give N districts per template. */
  readonly worlds: number;
  readonly seedBase: number;
  readonly tuning?: TuningResolved;
}

export type ClassShares = Record<EconClass, number>;

export interface Percentiles {
  readonly p10: number;
  readonly p25: number;
  readonly p50: number;
  readonly p75: number;
  readonly p90: number;
  readonly p99: number;
}

export interface TemplateStats {
  readonly templateId: string;
  readonly districts: number;
  readonly parcels: number;
  readonly parcelsPerDistrict: {
    readonly mean: number;
    readonly min: number;
    readonly max: number;
    readonly share55: number;
    readonly overTarget: number;
  };
  readonly heldShare: number;
  readonly classes: {
    readonly all: ClassShares;
    readonly held: ClassShares;
    readonly open: ClassShares;
    readonly pool: ClassShares;
  };
  readonly depositMix: Record<string, number>;
  readonly accessMix: Record<string, number>;
  readonly oldTimerMix: Record<string, number>;
  readonly honestyMix: Record<string, number>;
  /** Median current grade of unmined paystreak blocks per held claim (§3.7 table). */
  readonly heldMedianPsGrade: Percentiles;
  /** bcy-weighted grade of the yardstick's mined blocks on economic held claims. */
  readonly minedBlockGrade: Percentiles;
  readonly stripWhole: Percentiles;
  readonly stripMined: Percentiles;
  /** BALANCE T-01 (b): share of paystreak blocks with in-situ grade in [0.005, 0.03]. */
  readonly psBlocksInBand: number;
  /** BALANCE T-01 (c): share of paystreak blocks above 0.1 oz/bcy. */
  readonly psBlocksOver01: number;
  /** Share of paystreak blocks carrying a rich pocket. */
  readonly pocketShare: number;
  /** Mean coarse share of the size mix on paystreak blocks, and mean coarse particle mass (mg). */
  readonly coarseShare: number;
  readonly coarseMeanMg: number;
  readonly openOverlookedEconomic: number;
  readonly openCreekEconomic: number;
  readonly uneconomicBySize: Record<string, number>;
  readonly medianMinedOzByClass: Record<string, number>;
  /** Pool ÷ held geometric-mean paystreak grade (§3.7 statusMult.listed check). */
  readonly listedHeldGradeRatio: number;
  readonly priorDrillShare: number;
  /** Dredged parcels as a share of valley (non-bench) parcels (§3.4 valleyType target). */
  readonly dredgedValleyShare: number;
}

export interface CalibrationResult {
  readonly worlds: number;
  readonly seedBase: number;
  readonly meanGenMs: number;
  readonly meanWorldKb: number;
  readonly templates: Record<string, TemplateStats>;
}

interface ClaimRow {
  readonly claim: Claim;
  readonly truth: ClaimTruth;
  readonly econ: RefEconResult;
  readonly states: (BlockState | undefined)[];
}

export function percentiles(values: readonly number[]): Percentiles {
  const s = values.slice().sort((a, b) => a - b);
  const q = (p: number): number =>
    s.length === 0 ? NaN : (s[Math.min(s.length - 1, Math.floor(p * s.length))] as number);
  return { p10: q(0.1), p25: q(0.25), p50: q(0.5), p75: q(0.75), p90: q(0.9), p99: q(0.99) };
}

/** Weighted percentiles (value, weight) pairs. */
export function weightedPercentiles(pairs: readonly [number, number][]): Percentiles {
  const s = pairs.slice().sort((a, b) => a[0] - b[0]);
  const total = s.reduce((a, x) => a + x[1], 0);
  const q = (p: number): number => {
    let acc = 0;
    for (const [v, w] of s) {
      acc += w;
      if (acc >= p * total) return v;
    }
    return s.length > 0 ? (s[s.length - 1] as [number, number])[0] : NaN;
  };
  return { p10: q(0.1), p25: q(0.25), p50: q(0.5), p75: q(0.75), p90: q(0.9), p99: q(0.99) };
}

function shares(rows: readonly { cls: EconClass; w: number }[]): ClassShares {
  const out: ClassShares = { uneconomic: 0, marginal: 0, good: 0, excellent: 0 };
  let total = 0;
  for (const r of rows) {
    out[r.cls] += r.w;
    total += r.w;
  }
  for (const c of ECON_CLASSES) out[c] = total > 0 ? out[c] / total : 0;
  return out;
}

function mixOf(values: readonly string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const v of values) out[v] = (out[v] ?? 0) + 1;
  for (const k of Object.keys(out)) out[k] = (out[k] as number) / values.length;
  return out;
}

function claimRows(world: WorldSlice): Map<string, ClaimRow[]> {
  const byTemplate = new Map<string, ClaimRow[]>();
  for (const id of world.claimIds) {
    const claim = world.claims[id] as Claim;
    const d = world.districts[claim.districtId];
    if (d === undefined) continue;
    const truth = claimTruth(world, id);
    const states = truth.blocks.map((_, i) => world.blockStates[formatId('blk', claim.blockIdBase + i)]);
    const band = templateOf(world.genParams, d.templateId).climateBand;
    const econ = refEconomics(truth, (i) => states[i], band, world.genParams.refEcon);
    const list = byTemplate.get(d.templateId) ?? [];
    list.push({ claim, truth, econ, states });
    byTemplate.set(d.templateId, list);
  }
  return byTemplate;
}

/**
 * Streaming form of the calibration: add worlds one at a time (generated here, or the `world` slice of a newGame state
 * handed over by the simulator's `--world-only` collector), then read the statistics. Order of `add` calls is the
 * caller's; every statistic below is order-independent except floating-point summation, so callers add in seed order.
 */
export interface WorldStatsAccumulator {
  add(world: WorldSlice): void;
  readonly worlds: number;
  templates(): Record<string, TemplateStats>;
}

export function createWorldStatsAccumulator(): WorldStatsAccumulator {
  const rows = new Map<string, ClaimRow[]>();
  const perDistrict = new Map<string, { n: number; target: number }[]>();
  const honesty = new Map<string, string[]>();
  let poolW: Record<EconClass, number> | null = null;
  let worlds = 0;
  return {
    get worlds() {
      return worlds;
    },
    add(world) {
      worlds++;
      poolW ??= listingPoolWeights(world.genParams);
      for (const [tpl, list] of claimRows(world)) rows.set(tpl, (rows.get(tpl) ?? []).concat(list));
      for (const did of world.districtIds) {
        const d = world.districts[did];
        if (d === undefined) continue;
        const tpl = templateOf(world.genParams, d.templateId);
        const pd = perDistrict.get(d.templateId) ?? [];
        pd.push({ n: d.claimIds.length, target: tpl.parcelsPerDistrict[1] });
        perDistrict.set(d.templateId, pd);
        const hs = honesty.get(d.templateId) ?? [];
        for (const cid of d.claimIds) {
          const h = world.claims[cid]?.holderId;
          if (typeof h === 'string' && h.startsWith('hld_')) {
            const prof = world.holders[h as keyof WorldSlice['holders']];
            if (prof !== undefined && prof.claimIds[0] === cid) hs.push(prof.honesty);
          }
        }
        honesty.set(d.templateId, hs);
      }
    },
    templates() {
      const weights = poolW ?? { uneconomic: 0, marginal: 0, good: 0, excellent: 0 };
      const out: Record<string, TemplateStats> = {};
      for (const [tplId, list] of rows) {
        out[tplId] = templateStats(tplId, list, perDistrict.get(tplId) ?? [], honesty.get(tplId) ?? [], weights);
      }
      return out;
    },
  };
}

export function runCalibration(opts: CalibrationOptions): CalibrationResult {
  const tuning = opts.tuning ?? baseTuning;
  const acc = createWorldStatsAccumulator();
  let genMs = 0;
  let kb = 0;
  for (let i = 0; i < opts.worlds; i++) {
    const t0 = performance.now();
    const world = generateWorld(
      String(opts.seedBase + i),
      { districtCount: 2, templateIds: ['northernFederal', 'aridFederal'] },
      tuning,
    );
    genMs += performance.now() - t0;
    kb += JSON.stringify(world).length / 1024;
    acc.add(world);
  }
  return {
    worlds: opts.worlds,
    seedBase: opts.seedBase,
    meanGenMs: genMs / opts.worlds,
    meanWorldKb: kb / opts.worlds,
    templates: acc.templates(),
  };
}

const PS_F = 0.4;

function templateStats(
  templateId: string,
  list: readonly ClaimRow[],
  districts: readonly { n: number; target: number }[],
  honesty: readonly string[],
  poolW: Record<EconClass, number>,
): TemplateStats {
  const held = list.filter((r) => r.claim.status === 'heldNpc');
  const open = list.filter((r) => r.claim.status === 'open' || r.claim.status === 'withdrawn');
  const unmined = (r: ClaimRow, i: number): boolean => (r.states[i]?.minedBcy ?? 0) === 0;

  const medPs: number[] = [];
  const lnPsByClaim = new Map<ClaimRow, number>();
  for (const r of held) {
    const g = r.truth.blocks.filter((b, i) => b.paystreakFraction >= PS_F && unmined(r, i)).map((b) => b.gradeOzPerBcy);
    if (g.length === 0) continue;
    g.sort((a, b) => a - b);
    medPs.push(g[Math.floor(g.length / 2)] as number);
    lnPsByClaim.set(r, g.reduce((a, x) => a + Math.log(x), 0) / g.length);
  }
  const minedPairs: [number, number][] = [];
  const stripWhole: number[] = [];
  const stripMined: number[] = [];
  for (const r of held) {
    let ob = 0;
    let pay = 0;
    r.truth.blocks.forEach((b, i) => {
      if (!unmined(r, i)) return;
      ob += b.overburdenFt * 1613 + (b.oldTailings?.bcy ?? 0) - (r.states[i]?.strippedBcy ?? 0);
      pay += (b.payThicknessFt + b.bedrockCleanupFt) * 1613;
    });
    if (pay > 0) stripWhole.push(ob / pay);
    if (r.econ.minedPayBcy > 0) stripMined.push(r.econ.minedOverburdenBcy / r.econ.minedPayBcy);
    if (r.econ.cdvUsd > 0) {
      for (const i of r.econ.minedIdxs) {
        const b = r.truth.blocks[i];
        if (b !== undefined) minedPairs.push([b.gradeOzPerBcy, (b.payThicknessFt + b.bedrockCleanupFt) * 1613]);
      }
    }
  }
  let psBlocks = 0;
  let inBand = 0;
  let over01 = 0;
  let pockets = 0;
  let coarse = 0;
  let coarseMg = 0;
  // BALANCE T-01 (b, c) are measured on held claims' unmined paystreak blocks (as the preflight model does).
  for (const r of list) coarseMg += r.truth.coarseMeanMg;
  for (const r of held) {
    r.truth.blocks.forEach((b, i) => {
      if (b.paystreakFraction < PS_F || !unmined(r, i)) return;
      psBlocks++;
      if (b.gradeOzPerBcy >= 0.005 && b.gradeOzPerBcy <= 0.03) inBand++;
      if (b.gradeOzPerBcy > 0.1) over01++;
      if (b.pocket !== undefined) pockets++;
      coarse += b.sizeMix.coarse;
    });
  }
  const overlooked = open.filter(
    (r) => r.claim.hidden.depositType === 'bench' || r.claim.hidden.depositType === 'deepMuck',
  );
  const creekOpen = open.filter(
    (r) => !(r.claim.hidden.depositType === 'bench' || r.claim.hidden.depositType === 'deepMuck'),
  );
  const econShare = (xs: readonly ClaimRow[]): number =>
    xs.length === 0 ? NaN : xs.filter((r) => r.econ.econClass !== 'uneconomic').length / xs.length;
  const bySize: Record<string, number> = {};
  for (const ac of [20, 40, 80, 160]) {
    const g = held.filter((r) => r.claim.acres === ac);
    bySize[String(ac)] = g.length === 0 ? NaN : g.filter((r) => r.econ.econClass === 'uneconomic').length / g.length;
  }
  const minedOz: Record<string, number> = {};
  for (const c of ['marginal', 'good', 'excellent'] as const) {
    const g = held.filter((r) => r.econ.econClass === c).map((r) => r.econ.minedContainedOz);
    minedOz[c] = percentiles(g).p50;
  }
  // Pool ÷ held geometric-mean paystreak grade.
  let lnHeld = 0;
  let nHeld = 0;
  let lnPool = 0;
  let wPool = 0;
  for (const [r, ln] of lnPsByClaim) {
    lnHeld += ln;
    nHeld++;
    const w = poolW[r.econ.econClass];
    lnPool += w * ln;
    wPool += w;
  }
  const ratio = nHeld > 0 && wPool > 0 ? Math.exp(lnPool / wPool - lnHeld / nHeld) : NaN;
  const nd = districts.length;
  const counts = districts.map((d) => d.n);
  return {
    templateId,
    districts: nd,
    parcels: list.length,
    parcelsPerDistrict: {
      mean: counts.reduce((a, x) => a + x, 0) / Math.max(1, nd),
      min: Math.min(...counts),
      max: Math.max(...counts),
      share55: counts.filter((x) => x >= 55).length / Math.max(1, nd),
      overTarget: districts.filter((d) => d.n > d.target).length,
    },
    heldShare: held.length / list.length,
    classes: {
      all: shares(list.map((r) => ({ cls: r.econ.econClass, w: 1 }))),
      held: shares(held.map((r) => ({ cls: r.econ.econClass, w: 1 }))),
      open: shares(open.map((r) => ({ cls: r.econ.econClass, w: 1 }))),
      pool: shares(held.map((r) => ({ cls: r.econ.econClass, w: poolW[r.econ.econClass] }))),
    },
    depositMix: mixOf(list.map((r) => r.claim.hidden.depositType)),
    accessMix: mixOf(list.map((r) => r.claim.access)),
    oldTimerMix: mixOf(list.map((r) => r.claim.hidden.oldTimerKind)),
    honestyMix: mixOf(honesty),
    heldMedianPsGrade: percentiles(medPs),
    minedBlockGrade: weightedPercentiles(minedPairs),
    stripWhole: percentiles(stripWhole),
    stripMined: percentiles(stripMined),
    psBlocksInBand: inBand / Math.max(1, psBlocks),
    psBlocksOver01: over01 / Math.max(1, psBlocks),
    pocketShare: pockets / Math.max(1, psBlocks),
    coarseShare: coarse / Math.max(1, psBlocks),
    coarseMeanMg: coarseMg / Math.max(1, list.length),
    openOverlookedEconomic: econShare(overlooked),
    openCreekEconomic: econShare(creekOpen),
    uneconomicBySize: bySize,
    medianMinedOzByClass: minedOz,
    listedHeldGradeRatio: ratio,
    priorDrillShare: list.filter((r) => r.claim.hidden.publicRecord.priorDrill !== null).length / list.length,
    dredgedValleyShare:
      list.filter((r) => r.claim.hidden.depositType === 'dredgedGround').length /
      Math.max(1, list.filter((r) => r.claim.hidden.depositType !== 'bench').length),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Bands (§3.7 listing-pool target = BALANCE T-02; §3.18 distribution tests)
// ---------------------------------------------------------------------------------------------------------------------

export interface BandCheck {
  readonly id: string;
  readonly templateId: string;
  readonly what: string;
  readonly value: number;
  readonly lo: number;
  readonly hi: number;
  readonly gating: boolean;
  readonly pass: boolean;
}

const ACCESS_TARGETS: Record<string, Record<string, number>> = {
  northernFederal: { highway: 0.15, seasonalRoad: 0.5, winterTrail: 0.25, flyIn: 0.1 },
  aridFederal: { highway: 0.35, seasonalRoad: 0.65, winterTrail: 0, flyIn: 0 },
};

const HELD_SHARE: Record<string, [number, number]> = {
  northernFederal: [0.65, 0.75],
  aridFederal: [0.52, 0.62],
};

const STRIP_P50: Record<string, [number, number]> = {
  northernFederal: [3, 5],
  aridFederal: [1, 2],
};

/** Band checks; `loose` widens every band (the fast vitest sample is small). */
export function bandChecks(
  result: CalibrationResult,
  statusMultListed: number,
  loose = 0,
  honestyRow: Readonly<Record<string, number>> = baseTuning['geology.seller.honestyMix'],
): BandCheck[] {
  const out: BandCheck[] = [];
  const add = (
    id: string,
    templateId: string,
    what: string,
    value: number,
    lo: number,
    hi: number,
    gating: boolean,
  ): void => {
    const span = Number.isFinite(hi - lo) ? hi - lo : Math.abs(Number.isFinite(lo) ? lo : hi);
    const w = span * loose;
    const l = lo - w;
    const h = hi + w;
    out.push({ id, templateId, what, value, lo: l, hi: h, gating, pass: value >= l && value <= h });
  };
  for (const [tpl, s] of Object.entries(result.templates)) {
    const pool = s.classes.pool;
    add('T-02', tpl, 'listing pool uneconomic', pool.uneconomic, 0.6, 0.72, true);
    add('T-02', tpl, 'listing pool marginal', pool.marginal, 0.18, 0.3, true);
    add('T-02', tpl, 'listing pool good', pool.good, 0.05, 0.1, true);
    add('T-02', tpl, 'listing pool excellent', pool.excellent, 0.007, 0.025, true);
    add('3.18', tpl, 'held median paystreak grade p50 (oz/bcy)', s.heldMedianPsGrade.p50, 0.004, 0.009, true);
    add('3.18', tpl, 'mined-block grade p10 (oz/bcy)', s.minedBlockGrade.p10, 0.005, Infinity, true);
    add('3.18', tpl, 'mined-block grade p90 (oz/bcy)', s.minedBlockGrade.p90, 0, 0.045, true);
    const strip = STRIP_P50[tpl];
    if (strip !== undefined)
      add('3.18', tpl, 'whole-claim strip ratio p50', s.stripWhole.p50, strip[0], strip[1], true);
    add('3.18', tpl, 'parcels per district (mean)', s.parcelsPerDistrict.mean, 65, 75, true);
    add('3.18', tpl, 'districts with ≥ 55 parcels (share)', s.parcelsPerDistrict.share55, 0.99, 1, true);
    add('3.18', tpl, 'districts above nTarget (count)', s.parcelsPerDistrict.overTarget, 0, 0, true);
    const hs = HELD_SHARE[tpl];
    if (hs !== undefined) add('3.18', tpl, 'realized held share', s.heldShare, hs[0], hs[1], true);
    const acc = ACCESS_TARGETS[tpl];
    if (acc !== undefined) {
      for (const [a, t] of Object.entries(acc))
        add('3.18', tpl, `access ${a} share`, s.accessMix[a] ?? 0, t - 0.1, t + 0.1, true);
    }
    // §3.4: benches reach their template share ± 0.05; dredged stretches the dredged share of valley parcels ± 0.05.
    const mix = regionTemplate(tpl)?.depositMix;
    if (mix !== undefined) {
      const bench = mix.bench ?? 0;
      add('3.4', tpl, 'bench share of parcels', s.depositMix['bench'] ?? 0, bench - 0.05, bench + 0.05, true);
      const dredged = mix.dredgedGround ?? 0;
      add('3.4', tpl, 'dredged share of valley parcels', s.dredgedValleyShare, dredged - 0.05, dredged + 0.05, true);
    }
    // §3.18: honesty mix within ±4 points of the difficulty row (standard: §1 1.11 via geology.seller.honestyMix).
    for (const [h, t] of Object.entries(honestyRow)) {
      add('3.18', tpl, `honesty ${h} share`, s.honestyMix[h] ?? 0, t - 0.04, t + 0.04, true);
    }
    add(
      '3.7',
      tpl,
      'pool ÷ held GM paystreak grade vs statusMult.listed',
      s.listedHeldGradeRatio,
      statusMultListed - 0.03,
      statusMultListed + 0.03,
      false,
    );
    // BALANCE T-01 (a), aligned with §3.18 by the owner's ruling of 2026-10-06 (p90 ≤ 0.045); a P1 gate, reported here.
    add('T-01a', tpl, 'mined-block grade p90 (oz/bcy), BALANCE band', s.minedBlockGrade.p90, 0, 0.045, false);
    add(
      'T-01b',
      tpl,
      'paystreak blocks in [0.005, 0.03]',
      s.psBlocksInBand,
      tpl === 'aridFederal' ? 0.4 : 0.45,
      1,
      false,
    );
    add('T-01c', tpl, 'paystreak blocks > 0.1 oz/bcy', s.psBlocksOver01, 0.0005, 0.01, false);
  }
  return out;
}
