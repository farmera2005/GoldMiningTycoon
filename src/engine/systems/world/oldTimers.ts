// Old-timer workings and pre-game history (DESIGN §3.6). Old-timers took the richest paystreak blocks (f ≥ 0.4,
// sorted by virgin grade): drift miners hoisted the bottom pay, hand-cutters worked shallow ground, dredges turned over
// whole stretches, dry-washers skimmed the top of desert gulches, and recent cat-and-sluice operators mined the best
// remaining blocks outright. Stream: rng(seed,'world','oldtimers',K.id). Draw order: kind, two era years; the kind's
// own draws (per block in grade order, as below); recent-operator seasons, piles, reclamation and pre-strip; then for
// every claim: improvements LN, permit u, bond fraction, footprint-on-record u, one filed-season u per true season.
import type { Rng } from '../../core/rng';
import { BCY_PER_ACRE_FT } from './constants';
import { OLD_TIMER_KINDS } from './enums';
import type { GenClaim } from './genTypes';
import { lnMedian, pickKey, uniformIn } from './random';
import type { Mix4, WorkBlock } from './truth';
import { normalize4, payBcyOf } from './truth';
import type { GeoGenParams, OldTimerKind, PermitStubStatus, RegionTemplate, TrueSeason } from './types';
import { cumulativeGoldShare } from './vertical';

export interface OldTimerResult {
  readonly kind: OldTimerKind;
  readonly era: readonly [number, number] | null;
  /** recentCat: blocks mined outright before the game, with their season year and reclamation. */
  readonly mined: readonly { readonly idx: number; readonly year: number; readonly reclaimed: boolean }[];
  /** recentCat: paystreak blocks stripped in the last season (drained and partly thawed since). */
  readonly preStripped: readonly { readonly idx: number; readonly thawFt: number; readonly year: number }[];
  readonly history: readonly TrueSeason[];
  readonly lastSeason: number | null;
  readonly improvementsUsd: number;
  readonly permitStatus: PermitStubStatus;
  readonly bondFrac: number;
  readonly footprintOnRecord: boolean;
  readonly filedSeasons: readonly TrueSeason[];
}

/**
 * Removal per size class for a depletion of share x (§3.6 deplete): removed_k = min(cap·mix_k, c·w_k·mix_k) with c
 * found by water-filling so that Σ removed = x exactly; classes that hit the cap pass their excess to the rest.
 * Always feasible for x ≤ cap.
 */
export function depletionRemoval(mix: readonly number[], x: number, w: readonly number[], cap: number): Mix4 {
  const removed: Mix4 = [0, 0, 0, 0];
  let active = [0, 1, 2, 3];
  let budget = x;
  for (let iter = 0; iter < 5 && active.length > 0; iter++) {
    let denom = 0;
    for (const k of active) denom += (w[k] as number) * (mix[k] as number);
    if (!(denom > 0)) break;
    const c = budget / denom;
    const capped = active.filter((k) => c * (w[k] as number) > cap);
    if (capped.length === 0) {
      for (const k of active) removed[k] = c * (w[k] as number) * (mix[k] as number);
      break;
    }
    for (const k of capped) {
      removed[k] = cap * (mix[k] as number);
      budget -= removed[k];
    }
    active = active.filter((k) => !capped.includes(k));
  }
  return removed;
}

/** Applies a first depletion of share x of the block's virgin gold (§3.6 deplete). Mutates b. */
export function deplete(b: WorkBlock, x: number, w: readonly number[], cap: number): void {
  const removed = depletionRemoval(b.mix, x, w, cap);
  b.mix = normalize4(b.mix.map((m, k) => Math.max(0, m - (removed[k] as number))));
  b.minedOutFraction = x;
  b.gradeOzPerBcy = b.virginGradeOzPerBcy * (1 - x);
  // A rich pocket inside a worked block was worked too: it keeps its volume and loses the same share.
  if (b.pocket !== null) b.pocket = { bcy: b.pocket.bcy, gradeOzPerBcy: b.pocket.gradeOzPerBcy * (1 - x) };
}

/**
 * A second depletion that removes Δ more of the *virgin* gold (§3.6, §3.6.1): x' = min(maxX, x + Δ), applied as
 * deplete(b, (x' − x)/(1 − x)) on the current mix, then minedOutFraction = x'.
 */
export function depleteAgain(b: WorkBlock, delta: number, w: readonly number[], cap: number, maxX: number): void {
  const x0 = b.minedOutFraction;
  const x1 = Math.min(maxX, x0 + delta);
  if (!(x1 > x0)) return;
  const rel = (x1 - x0) / (1 - x0);
  const removed = depletionRemoval(b.mix, rel, w, cap);
  b.mix = normalize4(b.mix.map((m, k) => Math.max(0, m - (removed[k] as number))));
  b.minedOutFraction = x1;
  b.gradeOzPerBcy = b.virginGradeOzPerBcy * (1 - x1);
  if (b.pocket !== null) b.pocket = { bcy: b.pocket.bcy, gradeOzPerBcy: (b.pocket.gradeOzPerBcy * (1 - x1)) / (1 - x0) };
}

/** Old workings' losses as a surface pile on the block (§3.6 tailingsPile): lost = x·virgin·payBcy·(1 − histRec). */
export function tailingsPile(b: WorkBlock, x: number, histRec: number, pileBcy: number, mix: readonly number[]): void {
  const removedOz = x * b.virginGradeOzPerBcy * payBcyOf(b);
  const lostOz = removedOz * (1 - histRec);
  b.oldTailings = { bcy: pileBcy, gradeOzPerBcy: lostOz / pileBcy, mix: normalize4(mix) };
}

/** Drift miners' reach: the share of the column's gold between 1 ft into bedrock and 5 ft above it (§3.6). */
export function driftBottomShare(b: WorkBlock, gp: GeoGenParams): number {
  const p = {
    Tg: b.payThicknessFt,
    B: b.bedrockCleanupFt,
    sb: b.bedrockGoldShare,
    lambdaG: b.verticalDecayFt,
    lambdaB: gp.sample.bedrockDecayFt,
  };
  return cumulativeGoldShare(p, gp.oldTimer.driftBottom.topFt) - cumulativeGoldShare(p, -gp.oldTimer.driftBottom.bedrockFt);
}

/** Paystreak blocks (f ≥ 0.4) by virgin grade, richest first (ties: block index). */
export function paystreakByGrade(blocks: readonly WorkBlock[], minF: number): WorkBlock[] {
  return blocks
    .map((b, idx) => ({ b, idx }))
    .filter((x) => x.b.paystreakFraction >= minF)
    .sort((a, b) => b.b.virginGradeOzPerBcy - a.b.virginGradeOzPerBcy || a.idx - b.idx)
    .map((x) => x.b);
}

function idxOf(b: WorkBlock, nAcross: number): number {
  return b.i * nAcross + b.j;
}

export function applyOldTimers(
  r: Rng,
  K: GenClaim,
  blocks: WorkBlock[],
  tpl: RegionTemplate,
  gp: GeoGenParams,
): OldTimerResult {
  const O = gp.oldTimer;
  const kinds = O.kinds;
  const cap = O.depleteCap;
  const hand = O.depleteWeights.hand;
  const mix = tpl.oldTimerMix[K.depositType] ?? { none: 1 };
  const kind = pickKey(r, OLD_TIMER_KINDS, mix);
  const eraRange = eraRangeOf(kind, gp);
  const eraA = r.int(eraRange[0], eraRange[1]);
  const eraB = r.int(eraRange[0], eraRange[1]);
  let era: [number, number] | null =
    kind === 'none' || kind === 'recentCat' ? null : [Math.min(eraA, eraB), Math.max(eraA, eraB)];
  const PS = paystreakByGrade(blocks, gp.grade.pocketStreakMinF);
  const pileMix = O.pileMix;

  const mined: { idx: number; year: number; reclaimed: boolean }[] = [];
  const preStripped: { idx: number; thawFt: number; year: number }[] = [];
  const history: TrueSeason[] = [];
  let lastSeason: number | null = null;

  switch (kind) {
    case 'none':
      break;
    case 'drift': {
      const k = kinds.drift;
      const n = Math.round(uniformIn(r, k.top) * PS.length);
      for (const b of PS.slice(0, n)) {
        const workU = r.next();
        const ex = uniformIn(r, k.extract);
        const histRec = uniformIn(r, O.histRecoveryHand);
        const pileF = uniformIn(r, O.pileBcy.drift);
        if (!(workU < k.workP)) continue;
        const x = Math.min(O.maxExtraction, driftBottomShare(b, gp) * ex);
        deplete(b, x, hand, cap);
        tailingsPile(b, x, histRec, O.pileBcy.driftFt * BCY_PER_ACRE_FT * pileF, pileMix);
        // The bottom pay is gone: what is left sits higher in the gravel and less of it in bedrock.
        b.verticalDecayFt *= O.driftBottom.decayMult;
        b.bedrockGoldShare *= O.driftBottom.bedrockShareMult;
      }
      break;
    }
    case 'handCut': {
      const k = kinds.handCut;
      const n = Math.round(k.top * PS.length);
      for (const b of PS.filter((x) => x.overburdenFt < k.maxObFt).slice(0, n)) {
        const x = Math.min(O.maxExtraction, uniformIn(r, k.extract));
        const histRec = uniformIn(r, O.histRecoveryHand);
        const pileF = uniformIn(r, O.pileBcy.handCut);
        deplete(b, x, hand, cap);
        tailingsPile(b, x, histRec, payBcyOf(b) * pileF, pileMix);
      }
      break;
    }
    case 'dredge': {
      const k = kinds.dredge;
      const fx = O.dredgeEffects;
      for (const b of blocks) {
        const x = Math.min(O.maxExtraction, uniformIn(r, k.extract));
        if (b.paystreakFraction > k.minF) {
          deplete(b, x, O.depleteWeights.dredge, cap);
          // What the dredge left is fine gold or below dredge depth in bedrock.
          b.bedrockGoldShare = Math.max(b.bedrockGoldShare, fx.minBedrockShare);
        }
        b.overburdenFt = 0;
        b.permafrost = 0;
        b.boulders *= fx.boulderMult;
        b.verticalDecayFt = fx.decayFt;
      }
      break;
    }
    case 'dryWash': {
      const k = kinds.dryWash;
      const n = Math.round(k.top * PS.length);
      for (const b of PS.slice(0, n)) {
        const x = Math.min(O.maxExtraction, uniformIn(r, k.extract));
        const histRec = uniformIn(r, O.histRecoveryHand);
        const pileF = uniformIn(r, O.pileBcy.dryWash);
        deplete(b, x, hand, cap);
        tailingsPile(b, x, histRec, O.pileBcy.dryWashFt * BCY_PER_ACRE_FT * pileF, pileMix);
      }
      break;
    }
    case 'hydraulic': {
      // P6 (temperate benches): washed the bench face, reduced cover; its tailings fans lie downstream, off the claim.
      const k = kinds.hydraulic;
      for (const b of PS) {
        const x = Math.min(O.maxExtraction, uniformIn(r, k.extract));
        deplete(b, x, hand, cap);
        b.overburdenFt *= k.obMult;
      }
      break;
    }
    case 'recentCat': {
      const res = recentOperator(r, K, PS, gp);
      for (const m of res.mined) mined.push(m);
      for (const p of res.preStripped) preStripped.push(p);
      for (const s of res.history) history.push(s);
      lastSeason = res.lastSeason;
      if (history.length > 0) era = [(history[0] as TrueSeason).year, lastSeason as number];
      break;
    }
  }

  // Common tail (every claim takes these draws).
  const impLn = lnMedian(r, O.improvementsMedianUsd, O.improvementsSigma);
  const permitU = r.next();
  const bondFrac = uniformIn(r, gp.permitStub.bondFrac);
  const footU = r.next();
  const filedSeasons: TrueSeason[] = [];
  for (const s of history) {
    const u = r.next();
    if (s.year >= O.filedSeasonMinYear && u < O.filedSeasonP) filedSeasons.push(s);
  }
  const startYear = gp.startYear;
  const improvementsUsd =
    lastSeason === null ? 0 : Math.round(impLn * (lastSeason < startYear - O.improvementsOldYears ? O.improvementsOldMult : 1));
  const ps = gp.permitStub;
  const permitStatus: PermitStubStatus =
    lastSeason === null || lastSeason < ps.minLastSeasonYear
      ? 'none'
      : permitU < ps.planP
        ? 'planApproved'
        : permitU < ps.planP + ps.noticeP
          ? 'noticeOnFile'
          : 'none';
  return {
    kind,
    era,
    mined,
    preStripped,
    history,
    lastSeason,
    improvementsUsd,
    permitStatus,
    bondFrac,
    footprintOnRecord: kind !== 'none' && footU < O.footprintOnRecordP,
    filedSeasons,
  };
}

function eraRangeOf(kind: OldTimerKind, gp: GeoGenParams): readonly [number, number] {
  const k = gp.oldTimer.kinds;
  switch (kind) {
    case 'drift':
      return k.drift.era;
    case 'handCut':
      return k.handCut.era;
    case 'dredge':
      return k.dredge.era;
    case 'dryWash':
      return k.dryWash.era;
    case 'hydraulic':
      return k.hydraulic.era;
    case 'none':
    case 'recentCat':
      return [0, 0];
  }
}

/**
 * Recent cat-and-sluice operators (§3.6): they mined the top U(15%, 50%) of the undepleted paystreak outright, in
 * seasons of 1–3 blocks from a start year U{1985..2018}, recovering per size class recentCapture × operator skill;
 * the losses went to a pile on the same block. If their last season is recent, they may have pre-stripped 1–3 more.
 */
function recentOperator(
  r: Rng,
  K: GenClaim,
  PS: readonly WorkBlock[],
  gp: GeoGenParams,
): {
  mined: { idx: number; year: number; reclaimed: boolean }[];
  preStripped: { idx: number; thawFt: number; year: number }[];
  history: TrueSeason[];
  lastSeason: number | null;
} {
  const O = gp.oldTimer;
  const k = O.kinds.recentCat;
  const cands = PS.filter((b) => b.minedOutFraction === 0);
  const n = Math.round(uniformIn(r, k.top) * cands.length);
  const minedBlocks = cands.slice(0, n);
  const opSkill = uniformIn(r, O.recentOpSkill);
  const startY = r.int(O.recentStartYear[0], O.recentStartYear[1]);
  const groups: { year: number; blocks: WorkBlock[] }[] = [];
  let idx = 0;
  let year = startY;
  while (idx < n) {
    const kBlocks = r.int(k.seasonBlocks[0], k.seasonBlocks[1]);
    const gapU = r.next();
    groups.push({ year, blocks: minedBlocks.slice(idx, idx + kBlocks) });
    idx += kBlocks;
    year += 1 + (gapU < O.recentGapP ? 1 : 0);
  }
  // Seasons end before the game starts: shift a run that would reach the start year back.
  const lastRaw = groups.length > 0 ? (groups[groups.length - 1] as { year: number }).year : null;
  const shift = lastRaw !== null && lastRaw > gp.startYear - 1 ? lastRaw - (gp.startYear - 1) : 0;
  for (const g of groups) g.year -= shift;

  const mined: { idx: number; year: number; reclaimed: boolean }[] = [];
  const history: TrueSeason[] = [];
  const cap = O.recentCapture;
  for (const g of groups) {
    let bcy = 0;
    let rawOz = 0;
    const idxs: number[] = [];
    for (const b of g.blocks) {
      const pileF = uniformIn(r, k.pile);
      const reclaimU = r.next();
      const pay = payBcyOf(b);
      const contained = b.gradeOzPerBcy * pay;
      const lost: number[] = [];
      let recovered = 0;
      for (let c = 0; c < 4; c++) {
        const ck = contained * (b.mix[c] as number);
        const rec = Math.min(1, (cap[c] as number) * opSkill);
        recovered += ck * rec;
        lost.push(ck * (1 - rec));
      }
      const lostOz = lost.reduce((a, x) => a + x, 0);
      const pileBcy = pay * pileF;
      b.oldTailings = { bcy: pileBcy, gradeOzPerBcy: lostOz / pileBcy, mix: normalize4(lost) };
      bcy += pay;
      rawOz += recovered;
      const bi = idxOf(b, K.nAcross);
      idxs.push(bi);
      mined.push({ idx: bi, year: g.year, reclaimed: reclaimU < O.recentReclaimedP });
    }
    history.push({ year: g.year, bcy: Math.round(bcy), rawOz: Math.round(rawOz * 1000) / 1000, blockIdxs: idxs });
  }
  const lastSeason = groups.length > 0 ? (groups[groups.length - 1] as { year: number }).year : null;

  const psU = r.next();
  const psK = r.int(O.preStripBlocks[0], O.preStripBlocks[1]);
  const thaws: number[] = [];
  for (let i = 0; i < psK; i++) thaws.push(uniformIn(r, O.preStripThawFt));
  const preStripped: { idx: number; thawFt: number; year: number }[] = [];
  if (lastSeason !== null && lastSeason >= gp.startYear - O.preStripMaxAgeYr && psU < O.preStripP) {
    const minedSet = minedBlocks;
    const rest = PS.filter((b) => !minedSet.includes(b) && b.minedOutFraction === 0);
    rest.slice(0, psK).forEach((b, i) => {
      preStripped.push({ idx: idxOf(b, K.nAcross), thawFt: thaws[i] as number, year: lastSeason });
    });
  }
  return { mined, preStripped, history, lastSeason };
}

