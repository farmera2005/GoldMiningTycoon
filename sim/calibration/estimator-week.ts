// The §4 estimator's weekly refresh on a fixed scenario (DESIGN §2.13, §4.22 "Performance"; s04 #2): 8 tracked claims
// for a year, as step 16 would refresh them. Two are operating (pit grid, then mining a block in about ten weeks,
// stripping ahead, a cleanup every other week, a season end at week 30), one is being prospected (a batch of five pits
// every four weeks), five are watched (pans and records only). The planning price drifts 0.4% a week. The evidence
// timeline (samples, block states, production rows through recordProduction's pure core) is built first, untimed,
// from §3's engine generator; the timed pass then refreshes every claim every week through the incremental path
// (refreshAnchor + estimateAnchored) from a cold memo. The synthetic scenario is the CI regression check; the budget
// itself is measured on simulator games once the bots exist (s04 #2).
import { baseTuning } from '../../src/data/tuning';
import { formatId, type BlockId, type ClaimId, type SampleId } from '../../src/engine/core/ids';
import { clearAllMemos } from '../../src/engine/core/memo';
import {
  claimPriors,
  claimTruth,
  drawContextFor,
  generateWorld,
  type Claim,
  type ClaimPriors,
  type WorldSlice,
} from '../../src/engine/systems/world';
import { BCY_PER_ACRE_FT } from '../../src/engine/systems/world/constants';
import { UNTOUCHED_BLOCK } from '../../src/engine/systems/world/sample';
import {
  emptyEvidence,
  estimateAnchored,
  estimatorMemoStats,
  executeSample,
  executionParams,
  productionRecords,
  refreshAnchor,
  type CleanupResult,
  type EstimateAnchor,
  type EstimateContext,
  type EstimateResult,
  type EvidenceSet,
  type KnownBlockState,
  type MethodId,
  type PlanningAssumptions,
  type SampleRecord,
} from '../../src/engine/systems/knowledge';
import { CAL_LOGGER, harnessContext, planningFor, type HarnessContext } from './estimator-stages';

export const SCENARIO_WEEKS = 52;
const SEASON_END_WEEK = 30;
/** The scenario's evidence first becomes available at turn 1; from week 2 every claim has been solved once. */
export const STEADY_FROM_WEEK = 2;
const SIZES = ['coarse', 'medium', 'fine', 'ultrafine'] as const;

export type Role = 'operating' | 'prospecting' | 'watched';

interface ClaimTimeline {
  readonly claimId: ClaimId;
  readonly role: Role;
  readonly priors: ClaimPriors;
  readonly planning: PlanningAssumptions;
  /** Evidence as step 16 sees it each week. */
  readonly weeks: readonly EvidenceSet[];
}

export interface EstimatorWeekScenario {
  readonly claims: readonly ClaimTimeline[];
  readonly ctx: readonly EstimateContext[];
  readonly everyRows: number;
}

class Sampler {
  private seq = 0;
  private readonly k: Record<string, number> = {};
  constructor(
    private readonly world: WorldSlice,
    private readonly claim: Claim,
    private readonly base: number,
  ) {}
  sample(idx: number, method: MethodId, turn: number, volumeBcy?: number): SampleRecord {
    const truth = claimTruth(this.world, this.claim.id);
    const blockId = formatId('blk', this.claim.blockIdBase + idx) as BlockId;
    const key = `${idx}|${method}`;
    const kk = this.k[key] ?? 0;
    this.k[key] = kk + 1;
    return executeSample(
      truth.blocks[idx] as (typeof truth.blocks)[number],
      this.world.blockStates[blockId] ?? UNTOUCHED_BLOCK,
      drawContextFor(this.world, blockId),
      {
        seed: '2013',
        sampleId: formatId('smp', this.base + ++this.seq) as SampleId,
        claimId: this.claim.id,
        blockId,
        methodId: method,
        k: kk,
        turn,
        availableTurn: turn + 1,
        logger: CAL_LOGGER,
        machineReachFt: 22,
        ...(volumeBcy !== undefined ? { volumeBcy } : {}),
      },
      executionParams(baseTuning),
    ).record;
  }
}

function payBcy(world: WorldSlice, claim: Claim, priors: ClaimPriors, idx: number): number {
  const t = claimTruth(world, claim.id).blocks[idx] as { payThicknessFt: number; bedrockCleanupFt: number };
  return (t.payThicknessFt + t.bedrockCleanupFt) * BCY_PER_ACRE_FT * (priors.blocks[idx]?.acres ?? 1);
}

/** §7 stand-in: one line, the visible chain exact, the plant recovering each block's true mix at nominal capture. */
function cleanupOf(
  world: WorldSlice,
  claim: Claim,
  h: HarnessContext,
  turn: number,
  mined: Readonly<Record<number, number>>,
): CleanupResult {
  const truth = claimTruth(world, claim.id);
  const cap = h.ctx.recoveryBySize;
  const grl = { coarse: 0.01, medium: 0.01, fine: 0.01, ultrafine: 0.01 };
  const dirt = 0.04;
  const mf = 0.95 * 0.97;
  const inSitu: Partial<Record<BlockId, number>> = {};
  const bySize = { coarse: 0, medium: 0, fine: 0, ultrafine: 0 };
  const metal = { coarse: 0, medium: 0, fine: 0, ultrafine: 0 };
  for (const [k, v] of Object.entries(mined)) {
    const idx = Number(k);
    inSitu[formatId('blk', claim.blockIdBase + idx) as BlockId] = v;
    const bt = truth.blocks[idx] as { gradeOzPerBcy: number; sizeMix: Record<(typeof SIZES)[number], number> };
    for (const s of SIZES) {
      metal[s] += v * bt.gradeOzPerBcy * bt.sizeMix[s];
      bySize[s] += (v * bt.gradeOzPerBcy * bt.sizeMix[s] * mf * cap[s] * (1 - grl[s])) / (1 - dirt);
    }
  }
  const tot = metal.coarse + metal.medium + metal.fine + metal.ultrafine;
  const mix = {
    coarse: metal.coarse / tot,
    medium: metal.medium / tot,
    fine: metal.fine / tot,
    ultrafine: metal.ultrafine / tot,
  };
  let capMix = 0;
  for (const s of SIZES) capMix += mix[s] * cap[s] * (1 - grl[s]);
  return {
    turn,
    lineId: 'L1',
    purpose: 'production',
    rawOzWeighed: bySize.coarse + bySize.medium + bySize.fine + bySize.ultrafine,
    rawOzBySize: bySize,
    interestsTaken: [],
    bcyWashedSince: 0,
    bcyByBlock: {},
    recoveredGradeOzPerBcy: 0,
    inSituBcyByBlock: inSitu,
    pileBcyWashed: 0,
    pileRawOzEst: 0,
    modeledChainFactor: (mf * capMix) / (1 - dirt),
    modeledChain: {
      miningFactorByBlock: {},
      sizeMixP50: mix,
      captureBySize: cap,
      goldRoomLossBySize: grl,
      estDirtFrac: dirt,
    },
    foremanEstimateOz: 0,
    nominalRecoveryBySize: cap,
    skimOz: 0,
  };
}

function ctxAt(h: HarnessContext, week: number): EstimateContext {
  const spot = h.ctx.spotUsdPerFineOz * (1 + 0.004 * week);
  return { ...h.ctx, ema13UsdPerFineOz: spot, spotUsdPerFineOz: spot };
}

function lastSeasonEnd(week: number): number | null {
  return week >= SEASON_END_WEEK ? SEASON_END_WEEK : null;
}

/** Builds the scenario's weekly evidence (untimed; reads truth to execute samples and weigh cleanups). */
export function buildEstimatorWeekScenario(seed = '2013'): EstimatorWeekScenario {
  const world = generateWorld(seed, { districtCount: 2, templateIds: ['northernFederal', 'aridFederal'] }, baseTuning);
  const h = harnessContext(world, baseTuning);
  const held = world.claimIds
    .map((id) => world.claims[id] as Claim)
    .filter((c) => c.status === 'heldNpc' && c.acres === 20 && c.nAlong * c.nAcross >= 20)
    .slice(0, 8);
  const roles: Role[] = [
    'operating',
    'operating',
    'prospecting',
    'watched',
    'watched',
    'watched',
    'watched',
    'watched',
  ];
  const ctx = [...Array(SCENARIO_WEEKS).keys()].map((w) => ctxAt(h, w));
  const claims: ClaimTimeline[] = held.map((claim, ci) => {
    const role = roles[ci] as Role;
    const priors = claimPriors(world, claim.id, 'held');
    const planning = planningFor(h, priors);
    const n = claim.nAlong * claim.nAcross;
    const sampler = new Sampler(world, claim, 1000 * (ci + 1));
    let samples: SampleRecord[] = [];
    // Week 0: pans on every block for all; a pit grid on operating claims.
    for (let i = 0; i < n; i++) samples.push(sampler.sample(i, 'pan', 0));
    if (role === 'operating') for (let i = 0; i < n; i++) samples.push(sampler.sample(i, 'excavatorPit', 0, 5));
    const blockState: Record<BlockId, KnownBlockState> = {};
    const weeks: EvidenceSet[] = [];
    let anchor: EstimateAnchor | null = null;
    let minedSince: Record<number, number> = {};
    let current = Math.floor(n / 2);
    let prodId = 900000 * (ci + 1);
    for (let week = 0; week < SCENARIO_WEEKS; week++) {
      if (role === 'prospecting' && week > 0 && week % 4 === 0 && week <= 24) {
        for (let k = 0; k < 5; k++) samples.push(sampler.sample(((week / 4) * 3 + k) % n, 'excavatorPit', week, 5));
      }
      if (role === 'operating' && week >= 2 && week < SEASON_END_WEEK) {
        // Strip the next block ahead and mine 10% of the current block's pay each week.
        const nextId = formatId('blk', claim.blockIdBase + ((current + 1) % n)) as BlockId;
        const ns = blockState[nextId] ?? { minedFrac: 0, sampledBcy: 0, strippedFt: 0 };
        blockState[nextId] = { ...ns, strippedFt: ns.strippedFt + 2 };
        const id = formatId('blk', claim.blockIdBase + current) as BlockId;
        const st = blockState[id] ?? { minedFrac: 0, sampledBcy: 0, strippedFt: 0 };
        const frac = Math.min(0.1, 1 - st.minedFrac);
        blockState[id] = { ...st, minedFrac: st.minedFrac + frac };
        minedSince[current] = (minedSince[current] ?? 0) + frac * payBcy(world, claim, priors, current);
        if (st.minedFrac + frac >= 1 - 1e-9) current = (current + 1) % n;
        if (week % 2 === 1) {
          // The cleanup is attributed against the estimate at the start of step 12 (this week's evidence, before it).
          const ev: EvidenceSet = { ...emptyEvidence(claim.id), samples, blockState: { ...blockState } };
          anchor = refreshAnchor(anchor, ev, lastSeasonEnd(week), h.params.fullSolveEveryProdRows);
          const est: EstimateResult = estimateAnchored(priors, ev, anchor, planning, ctx[week] as EstimateContext);
          const p50 = new Map(est.blocks.map((b) => [b.blockId, b.gradeP50]));
          const recs = productionRecords({
            claimId: claim.id,
            cleanup: cleanupOf(world, claim, h, week, minedSince),
            gradeP50: (bid) => p50.get(bid),
          }).map((d) => ({ ...d, id: formatId('smp', ++prodId) as SampleId }));
          samples = [...samples, ...recs];
          minedSince = {};
        }
      }
      weeks.push({
        ...emptyEvidence(claim.id),
        samples: samples.filter((s) => s.availableTurn <= week),
        blockState: { ...blockState },
      });
    }
    return { claimId: claim.id, role, priors, planning, weeks };
  });
  return { claims, ctx, everyRows: h.params.fullSolveEveryProdRows };
}

/** The deepest memo layer a refresh computed: a full (anchor) solve, an appended production batch, the state layer
 * (block state moved), the economic layer (the planning price crossed a grid line), or a hit on every layer. */
export type RefreshKind = 'full' | 'append' | 'state' | 'econ' | 'hit';
export const REFRESH_KINDS: readonly RefreshKind[] = ['full', 'append', 'state', 'econ', 'hit'];

export interface RefreshCall {
  readonly week: number;
  readonly claim: number;
  readonly role: Role;
  readonly kind: RefreshKind;
  readonly ms: number;
}

export interface EstimatorWeekResult {
  /** The refresh of all 8 claims, per week. */
  readonly weekMs: readonly number[];
  readonly meanMs: number;
  readonly p95Ms: number;
  /** Mean over weeks 2–51, after every claim's first refreshes (prior model built, first evidence solved): the
   * steady state a long game amortizes toward. */
  readonly steadyMeanMs: number;
  /** Mean time per week by claim role. */
  readonly byRoleMs: Readonly<Record<Role, number>>;
  readonly calls: readonly RefreshCall[];
  readonly countByKind: Readonly<Record<RefreshKind, number>>;
}

function refreshKind(
  before: ReturnType<typeof estimatorMemoStats>,
  after: ReturnType<typeof estimatorMemoStats>,
): RefreshKind {
  if (after.anchor.misses > before.anchor.misses) return 'full';
  if (after.appended.misses > before.appended.misses) return 'append';
  if (after.state.misses > before.state.misses) return 'state';
  if (after.estimate.misses > before.estimate.misses) return 'econ';
  return 'hit';
}

/** Refreshes every claim every week from a cold memo, as step 16 would; times each refresh and the week's total. */
export function runEstimatorWeeks(sc: EstimatorWeekScenario, now: () => number): EstimatorWeekResult {
  clearAllMemos();
  const anchors: (EstimateAnchor | null)[] = sc.claims.map(() => null);
  const weekMs: number[] = [];
  const calls: RefreshCall[] = [];
  const byRole: Record<Role, number> = { operating: 0, prospecting: 0, watched: 0 };
  const countByKind: Record<RefreshKind, number> = { full: 0, append: 0, state: 0, econ: 0, hit: 0 };
  for (let week = 0; week < SCENARIO_WEEKS; week++) {
    let total = 0;
    sc.claims.forEach((c, i) => {
      const before = estimatorMemoStats();
      const t0 = now();
      const ev = c.weeks[week] as EvidenceSet;
      const anchor = refreshAnchor(anchors[i] ?? null, ev, lastSeasonEnd(week), sc.everyRows);
      anchors[i] = anchor;
      estimateAnchored(c.priors, ev, anchor, c.planning, sc.ctx[week] as EstimateContext);
      const ms = now() - t0;
      const kind = refreshKind(before, estimatorMemoStats());
      calls.push({ week, claim: i, role: c.role, kind, ms });
      countByKind[kind]++;
      total += ms;
      byRole[c.role] += ms;
    });
    weekMs.push(total);
  }
  const sorted = weekMs.slice().sort((a, b) => a - b);
  return {
    weekMs,
    meanMs: weekMs.reduce((a, b) => a + b, 0) / weekMs.length,
    p95Ms: sorted[Math.floor(0.95 * (sorted.length - 1))] as number,
    steadyMeanMs: weekMs.slice(STEADY_FROM_WEEK).reduce((a, b) => a + b, 0) / (SCENARIO_WEEKS - STEADY_FROM_WEEK),
    byRoleMs: {
      operating: byRole.operating / SCENARIO_WEEKS,
      prospecting: byRole.prospecting / SCENARIO_WEEKS,
      watched: byRole.watched / SCENARIO_WEEKS,
    },
    calls,
    countByKind,
  };
}
