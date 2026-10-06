// The statistical layer of the estimate (DESIGN §4.4–4.7): everything that depends on the prior and the evidence but
// not on prices or planning, built in three parts so the incremental production path (§4.5.2, D-4.41) can reuse the
// expensive one:
//  1. the ANCHOR solve: two fixed passes (D-4.18; pass 1 at the prior working grade, pass 2 at the pass-1 posterior),
//     each ending with the site-refinement sweeps, hypotheses below the prune weight dropped after pass 1. It reads
//     the evidence up to the anchor and the block state as of the anchor, quantized (s04 #1): the fully mined blocks
//     (old-timer neutrality) and the stripped feet (the recent-operator rule and the depth frame of the geometry);
//  2. the solve SUMMARY: block grade mixtures, paystreak probabilities and exp(C) for one solve (anchor or appended);
//  3. the STATE layer: the current continuous block state (remaining pay f_rem from mined and sampled fractions, the
//     overburden stripped since the anchor), the aggregation, fineness and production gates. Cheap; reruns weekly
//     on an operating claim without touching parts 1–2.
// A full solve is the anchor solve over all evidence with the current block state; it reproduces P0's single-layer
// estimate bit for bit.
import { exp, log, normCdf, sqrt } from '../../core/dmath';
import type { BlockId } from '../../core/ids';
import { sortedKeys } from '../../core/iter';
import { BCY_PER_ACRE_FT } from '../world/constants';
import type { SizeRecord } from '../world/types';
import { blockMeans, summarizeSet, type AggregateInputs, type SetSummary } from './aggregate';
import { coarseMeanMass, coarsePosterior, coarseTerms, type CoarsePosterior } from './coarse';
import {
  coarseDepletionMult,
  DEPL_WORKED,
  depletionModel,
  footprintStreakMoments,
  hypothesisPsProb,
  selectionVarRatio,
  streakMeans,
  type DepletionModel,
} from './depletion';
import { finenessPosterior } from './fineness';
import { geometryPosterior, type GeometryPosterior } from './geometry';
import { mixtureQuantile, type Mixture } from './mixture';
import {
  allHypotheses,
  blockCovariance,
  pruneHypotheses,
  refineSites,
  solvePosterior,
  type Hyps,
  type Solve,
} from './posterior';
import { withBlockFieldScale, type PriorModel } from './prior';
import { prepareProduction, type PreparedProduction } from './production';
import { buildRows, pocketHits, positionOf, withProductionRows, type Position, type Rows } from './rows';
import {
  bedrockPosterior,
  classMasses,
  pooledMasses,
  prepareSamples,
  type BedrockPosterior,
  type Mass4,
  type PreparedSample,
} from './samples';
import type { EvidenceSet, FinenessAssay, KnownBlockState, RecordFinding, SampleRecord } from './types';

export interface BlockGround {
  readonly clay: Float64Array;
  readonly boulders: Float64Array;
  readonly frozen: Float64Array;
  readonly cement: Float64Array;
}

export interface BlockSampleStats {
  readonly count: Int32Array;
  readonly volumeBcy: Float64Array;
  readonly bedrock: Int32Array;
  readonly maxPaySampleBcy: Float64Array;
  readonly bulk: Uint8Array;
}

/** Production behind the estimate (§4.8 support gates): every production row, anchored or appended. */
export interface ProductionStats {
  /** Σ in-situ pay bcy of the production rows on each block. */
  readonly bcyByBlock: Float64Array;
  /** 1 where an own-fleet bulk-sample cleanup was attributed to the block. */
  readonly bulkByBlock: Uint8Array;
  readonly totalBcy: number;
  readonly rows: number;
}

/** The block state an anchor solve reads (s04 #1): as of the anchor, quantized. */
export interface AnchorBlockState {
  /** Blocks fully mined out (Block.state minedFrac ≥ 1). */
  readonly minedBlockIds: readonly BlockId[];
  /** Overburden stripped from each block, ft (> 0 only): the recent-operator rule and the geometry's depth frame. */
  readonly strippedFt: Readonly<Partial<Record<BlockId, number>>>;
}

/** What one anchor solve reads: samples and production rows up to the anchor, records, the anchor's block state. */
export interface AnchorEvidence {
  readonly samples: readonly SampleRecord[];
  readonly records: readonly RecordFinding[];
  readonly state: AnchorBlockState;
}

/** The anchor solve and every quantity the incremental path keeps frozen (§4.5.2). */
export interface AnchorSolve {
  readonly model: PriorModel;
  readonly samples: readonly PreparedSample[];
  /** Production rows inside the anchor (cleanupTurn ≤ the anchor turn), ascending SampleId. */
  readonly production: readonly PreparedProduction[];
  readonly geo: GeometryPosterior;
  readonly bed: BedrockPosterior;
  readonly depl: DepletionModel;
  /** μ_e per configuration (S × n) and its old-timer removal part (S × n). */
  readonly muE: Float64Array;
  readonly removal: Float64Array;
  readonly Vm: number;
  readonly coarse: CoarsePosterior;
  readonly ncShare: Mass4;
  /**
   * The final pass's coarse inputs (thinning a_b, R̃, E[w_b] of the final rows, pocket exclusions, pooled sample masses):
   * the incremental path refreshes the coarse posterior with appended sieved masses on them (incremental.ts).
   */
  readonly coarseInputs: {
    readonly a: Float64Array;
    readonly rTilde: number;
    readonly Ew: Float64Array;
    readonly excluded: Uint8Array;
    readonly pooled: Mass4;
  };
  readonly confirmedOz: Float64Array;
  /** Final rows (site refinements applied) and the solve on them; sol.L factors their K. */
  readonly rows: Rows;
  readonly sol: Solve;
  readonly CG: Float64Array;
  readonly evaluatedHypotheses: number;
  readonly ground: BlockGround;
  readonly stats: BlockSampleStats;
  /** Stripped feet the geometry was solved with (the anchor's), per block. */
  readonly strippedFt: Float64Array;
}

/**
 * A posterior over the anchor's hypotheses: the anchor's own, or the anchor with production rows appended
 * (incremental.ts), with the coarse posterior and non-coarse shares it carries.
 */
export interface PosteriorSolve {
  readonly rows: Rows;
  readonly sol: Solve;
  readonly CG: Float64Array;
  readonly coarse: CoarsePosterior;
  readonly ncShare: Mass4;
}

/** The anchor's own posterior. */
export function anchorPosterior(an: AnchorSolve): PosteriorSolve {
  return { rows: an.rows, sol: an.sol, CG: an.CG, coarse: an.coarse, ncShare: an.ncShare };
}

/** Per-solve summaries that do not depend on the current block state. */
export interface SolveSummary {
  readonly fPost: Float64Array;
  readonly pStreak: Float64Array;
  readonly pBarren: number;
  readonly gradeQ: { readonly p10: Float64Array; readonly p50: Float64Array; readonly p90: Float64Array };
  readonly lnGMean: Float64Array;
  readonly lnGSd: Float64Array;
  readonly cDiag: Float64Array;
  readonly expC: Float64Array;
}

export interface StatLayer {
  readonly model: PriorModel;
  readonly samples: readonly PreparedSample[];
  readonly hyps: Hyps;
  readonly evaluatedHypotheses: number;
  readonly weights: Float64Array;
  /** Posterior mean of ln G_b per hypothesis (H × n) and the shared covariance (n × n). */
  readonly meanLnG: Float64Array;
  readonly CG: Float64Array;
  readonly geo: GeometryPosterior;
  readonly bed: BedrockPosterior;
  readonly depl: DepletionModel;
  readonly coarse: CoarsePosterior;
  readonly fPost: Float64Array;
  readonly pStreak: Float64Array;
  readonly pBarren: number;
  readonly fRem: Float64Array;
  readonly T50: Float64Array;
  readonly confirmedOz: Float64Array;
  readonly sizeMixP50: SizeRecord;
  readonly fineness: { readonly p50: number; readonly sd: number };
  readonly ground: BlockGround;
  readonly stats: BlockSampleStats;
  readonly production: ProductionStats;
  /**
   * Overburden stripped since the anchor, ft, per block: the post-solve shift of the geometry's depth frame (s04 #1).
   * Overburden and depth to bedrock read D − shift; 0 on a full solve.
   */
  readonly obShiftFt: Float64Array;
  readonly agg: AggregateInputs;
  readonly A: Float64Array;
  readonly contained: SetSummary;
  /** Block log-grade mixture: P10/P50/P90 of G (oz/bcy), mean and sd of ln G. */
  readonly gradeQ: { readonly p10: Float64Array; readonly p50: Float64Array; readonly p90: Float64Array };
  readonly lnGMean: Float64Array;
  readonly lnGSd: Float64Array;
}

function mean4(m: SizeRecord): Mass4 {
  return [m.coarse, m.medium, m.fine, m.ultrafine];
}

/** Non-coarse class shares from pooled capture-corrected masses with the prior pseudo-mass (§4.7 Size mix). */
export function ncShares(model: PriorModel, pooled: Mass4): Mass4 {
  const prior = mean4(model.sizeMixPrior);
  const ncPrior = (prior[1] as number) + (prior[2] as number) + (prior[3] as number);
  const out: Mass4 = [0, 0, 0, 0];
  let tot = 0;
  for (let c = 1; c < 4; c++) {
    const a = (model.params.sizeMixPriorMg * (prior[c] as number)) / ncPrior;
    out[c] = a + (pooled[c] as number);
    tot += out[c] as number;
  }
  for (let c = 1; c < 4; c++) out[c] = (out[c] as number) / tot;
  return out;
}

/**
 * The geologist flag of §4.6's false-bedrock check, derived from the evidence (s04 #10): a geologist works the claim
 * when any bedrock-logged sample was logged by the owner-geologist, a staff geologist or a consultant. It changes only
 * with new samples, so it never forces a re-solve on its own.
 */
export function geologistOnClaim(samples: readonly SampleRecord[]): boolean {
  return samples.some((s) => s.source !== 'production' && s.bedrockLogged && s.loggedBy.kind !== 'none');
}

/** The anchor block state of the current state: the fully mined blocks and the stripped feet (s04 #1). */
export function quantizeBlockState(blockState: EvidenceSet['blockState']): AnchorBlockState {
  const minedBlockIds: BlockId[] = [];
  const strippedFt: Partial<Record<BlockId, number>> = {};
  for (const id of sortedKeys(blockState as Readonly<Record<BlockId, KnownBlockState>>)) {
    const st = blockState[id];
    if (st === undefined) continue;
    if (st.minedFrac >= 1) minedBlockIds.push(id);
    if (st.strippedFt > 0) strippedFt[id] = st.strippedFt;
  }
  return { minedBlockIds, strippedFt };
}

function anchorStateArrays(
  model: PriorModel,
  st: AnchorBlockState,
): { minedFrac: Float64Array; strippedFt: Float64Array } {
  const n = model.n;
  const minedFrac = new Float64Array(n);
  const strippedFt = new Float64Array(n);
  for (const id of st.minedBlockIds) {
    const b = model.indexOf[id];
    if (b !== undefined) minedFrac[b] = 1;
  }
  for (let b = 0; b < n; b++) {
    const s = st.strippedFt[model.blockIds[b] as BlockId];
    if (s !== undefined) strippedFt[b] = Math.max(0, s);
  }
  return { minedFrac, strippedFt };
}

/** The current continuous block state, per block. */
export interface ContinuousState {
  readonly minedFrac: Float64Array;
  readonly sampledBcy: Float64Array;
  readonly strippedFt: Float64Array;
}

export function continuousState(
  model: PriorModel,
  blockState: Readonly<Partial<Record<BlockId, KnownBlockState>>>,
): ContinuousState {
  const n = model.n;
  const minedFrac = new Float64Array(n);
  const sampledBcy = new Float64Array(n);
  const strippedFt = new Float64Array(n);
  for (let b = 0; b < n; b++) {
    const st = blockState[model.blockIds[b] as BlockId];
    if (st === undefined) continue;
    minedFrac[b] = Math.min(1, Math.max(0, st.minedFrac));
    sampledBcy[b] = Math.max(0, st.sampledBcy);
    strippedFt[b] = Math.max(0, st.strippedFt);
  }
  return { minedFrac, sampledBcy, strippedFt };
}

function groundAndStats(
  model: PriorModel,
  samples: readonly PreparedSample[],
): { ground: BlockGround; stats: BlockSampleStats } {
  const n = model.n;
  const P = model.params;
  const tv = P.tercileValue;
  const clayS = new Float64Array(n);
  const clayN = new Int32Array(n);
  const bouS = new Float64Array(n);
  const bouN = new Int32Array(n);
  const frzS = new Float64Array(n);
  const frzN = new Int32Array(n);
  const count = new Int32Array(n);
  const volumeBcy = new Float64Array(n);
  const bedrock = new Int32Array(n);
  const maxPaySampleBcy = new Float64Array(n);
  const bulk = new Uint8Array(n);
  let claimFrz = 0;
  let claimFrzN = 0;
  for (const s of samples) {
    const b = s.b;
    count[b] = (count[b] as number) + 1;
    volumeBcy[b] = (volumeBcy[b] as number) + s.V;
    if (s.interval === 'fullColumn') bedrock[b] = (bedrock[b] as number) + 1;
    if (s.reachedPay) maxPaySampleBcy[b] = Math.max(maxPaySampleBcy[b] as number, s.V);
    if (s.rec.methodId === 'bulkSample' && s.reachedPay) bulk[b] = 1;
    const o = s.rec.observed;
    if (o.clay !== undefined) {
      clayS[b] = (clayS[b] as number) + tv[o.clay];
      clayN[b] = (clayN[b] as number) + 1;
    }
    if (o.boulders !== undefined) {
      bouS[b] = (bouS[b] as number) + tv[o.boulders];
      bouN[b] = (bouN[b] as number) + 1;
    }
    if (s.reachedPay && s.interval !== 'exposure') {
      const f = o.permafrost ? 1 : 0;
      frzS[b] = (frzS[b] as number) + f;
      frzN[b] = (frzN[b] as number) + 1;
      claimFrz += f;
      claimFrzN++;
    }
  }
  const tpl = model.tpl;
  const dep =
    model.priors.setting === 'valleyBottom'
      ? 'creek'
      : model.priors.setting === 'fan'
        ? 'desertFan'
        : model.priors.setting;
  const cementMed = tpl.cementMed[dep] ?? 0;
  // Frozen ground is a claim-level property in §3 (one frozen degree per claim), so the claim's logs inform
  // unsampled blocks before the visible prior does.
  const frozenClaim = claimFrzN > 0 ? claimFrz / claimFrzN : model.pFrozen;
  const clay = new Float64Array(n);
  const boulders = new Float64Array(n);
  const frozen = new Float64Array(n);
  const cement = new Float64Array(n).fill(cementMed);
  for (let b = 0; b < n; b++) {
    clay[b] = (clayN[b] as number) > 0 ? (clayS[b] as number) / (clayN[b] as number) : tpl.clayMed;
    // A visible dredge worked these blocks and left their boulders behind its stacker at boulderMult (§3.6).
    const dredged = model.dredgedVisible && model.priors.blocks[b]?.visibleWorkings === true;
    const boulderPrior = tpl.boulderMed * (dredged ? model.params.dredgeBoulderMult : 1);
    boulders[b] = (bouN[b] as number) > 0 ? (bouS[b] as number) / (bouN[b] as number) : boulderPrior;
    frozen[b] = (frzN[b] as number) > 0 ? (frzS[b] as number) / (frzN[b] as number) : frozenClaim;
  }
  return { ground: { clay, boulders, frozen, cement }, stats: { count, volumeBcy, bedrock, maxPaySampleBcy, bulk } };
}

/** Pooled capture-corrected masses with production's in-situ non-coarse masses added (size mix only, §4.4.6). */
export function pooledForSizeMix(pooled: Mass4, production: readonly PreparedProduction[]): Mass4 {
  if (production.length === 0) return pooled;
  const out: Mass4 = [pooled[0], pooled[1], pooled[2], pooled[3]];
  for (const p of production) {
    out[1] = (out[1] as number) + p.ncInSituMg[0];
    out[2] = (out[2] as number) + p.ncInSituMg[1];
    out[3] = (out[3] as number) + p.ncInSituMg[2];
  }
  return out;
}

/** The anchor solve (§4.5.2): the full two-pass solve over the anchor's evidence and block state. */
export function anchorSolve(model0: PriorModel, ev: AnchorEvidence): AnchorSolve {
  const P = model0.params;
  const n = model0.n;
  const samples = prepareSamples(model0, ev.samples, geologistOnClaim(ev.samples), P);
  const production = prepareProduction(model0.indexOf, ev.samples, P);
  const bs = anchorStateArrays(model0, ev.state);
  const bed = bedrockPosterior(samples, model0);
  const depl = depletionModel(model0, ev, samples, bs.minedFrac, bs.strippedFt);
  const handCut: number[] = [];
  for (let b = 0; b < n; b++) if (depl.state[b] === DEPL_WORKED && depl.workedKind[b] === 'handCut') handCut.push(b);
  const streak = footprintStreakMoments(model0, depl);
  const geo = geometryPosterior(model0, samples, bed, bs.strippedFt, {
    ...(handCut.length > 0
      ? { thinCover: { blocks: handCut, maxObFt: P.handCutMaxObFt, weight: P.thinCoverSiteWeight } }
      : {}),
    ...(streak !== null ? { streak } : {}),
  });
  const handCutEligible = new Float64Array(n);
  for (let b = 0; b < n; b++) {
    const D50 = exp(geo.D.mean[b] as number);
    const T50b = exp(geo.T.mean[b] as number);
    const ob = Math.max(0, D50 - T50b + geo.bHat);
    const sd = sqrt(D50 * D50 * (geo.D.varDiag[b] as number) + T50b * T50b * (geo.T.varDiag[b] as number));
    handCutEligible[b] = normCdf((P.handCutMaxObFt - ob) / Math.max(sd, 1e-6));
  }
  const { mu: muE, removal, penalty } = streakMeans(model0, depl, handCutEligible);
  // The old-timers' selection also narrows the block field on worked and passed-over blocks (depletion.ts).
  const selRatio = selectionVarRatio(model0, depl, hypothesisPsProb(model0, penalty), handCutEligible);
  const model = selRatio === null ? model0 : withBlockFieldScale(model0, selRatio);
  const Vm = model.VmBase + depl.vDepl;

  const positions: (Position | null)[] = samples.map((s) => positionOf(model, geo, depl, bed.sbHat, s));
  const pooled = pooledMasses(samples);
  const ncShare = ncShares(model, pooledForSizeMix(pooled.massByClass, production));
  const coarseMg = coarseMeanMass(model, pooled);
  const masses = samples.map((s) => classMasses(s, coarseMg, ncShare, P.phys.particleMeanMg));
  const pockets = pocketHits(model, samples, muE, Vm, coarseMg, ncShare);
  const prodRows = production.map((p) => p.row);
  const prodCoarse = production.map((p) => p.coarse);

  // Working grades for pass 1: the prior non-coarse grade exp(M + E[μ_e] − E[w]) at R0 (gold-bearing hypotheses).
  const thin = P.coarseStreakThin;
  const cMult = coarseDepletionMult(model, depl, bed.bHat, bed.sbHat);
  let a = new Float64Array(n);
  const gt = new Float64Array(n);
  for (let b = 0; b < n; b++) {
    a[b] = (thin + (1 - thin) * (model.fbar[b] as number)) * (cMult[b] as number);
    let m = 0;
    for (let s = 0; s < model.S; s++) m += (model.streakPrior[s] as number) * (muE[s * n + b] as number);
    gt[b] = exp(model.M + model.selection.gold.shift + m - log(1 + (a[b] as number) * model.coarse.R0));
  }
  let hyps = allHypotheses(model, penalty);
  const evaluatedHypotheses = hyps.count;
  let rTilde = model.coarse.R0;
  const rowInputs = {
    model,
    geo,
    depl,
    sbHat: bed.sbHat,
    samples,
    positions,
    masses,
    excluded: pockets.excluded,
    records: ev.records,
    ncShare,
  };
  let co = coarsePosterior(model, samples, a, rTilde, coarseMg, ncShare, pockets.excluded, prodCoarse);
  let ct = coarseTerms(a, co.mr, co.vr);
  let sol = null as Solve | null;
  let rows = null as Rows | null;
  const passes = Math.max(1, P.varIterations);
  for (let pass = 0; pass < passes; pass++) {
    co = coarsePosterior(model, samples, a, rTilde, coarseMg, ncShare, pockets.excluded, prodCoarse);
    ct = coarseTerms(a, co.mr, co.vr);
    rows = withProductionRows(buildRows(rowInputs, gt, ct), prodRows);
    sol = solvePosterior(model, rows, muE, Vm, co.vr, hyps);
    for (let sweep = 0; sweep < P.siteRefineSweeps; sweep++) {
      if (!refineSites(model, rows, Vm, co.vr, sol)) break;
      sol = solvePosterior(model, rows, muE, Vm, co.vr, hyps);
    }
    // Next pass: working grades at the mixture posterior, coarse thinning at the posterior paystreak fraction.
    const H = sol.hyps.count;
    const nextA = new Float64Array(n);
    for (let b = 0; b < n; b++) {
      let mm = 0;
      let fp = 0;
      for (let h = 0; h < H; h++) {
        const w = sol.weights[h] as number;
        mm += w * (sol.meanLnG[h * n + b] as number);
        fp += w * (model.streakF[(sol.hyps.streak[h] as number) * n + b] as number);
      }
      gt[b] = exp(mm - (ct.Ew[b] as number));
      nextA[b] = (thin + (1 - thin) * fp) * (cMult[b] as number);
    }
    if (pass === passes - 1) break;
    a = nextA;
    rTilde = exp(co.mr);
    if (pass === 0) hyps = pruneHypotheses(sol.hyps, sol.weights, model.pruneWeight);
  }
  if (sol === null || rows === null) throw new Error('estimator: no pass ran');
  const CG = blockCovariance(model, rows, Vm, sol);
  const gs = groundAndStats(model, samples);
  return {
    model,
    samples,
    production,
    geo,
    bed,
    depl,
    muE,
    removal,
    Vm,
    coarse: co,
    ncShare,
    coarseInputs: { a, rTilde, Ew: ct.Ew, excluded: pockets.excluded, pooled: pooled.massByClass },
    confirmedOz: pockets.confirmedOz,
    rows,
    sol,
    CG,
    evaluatedHypotheses,
    ground: gs.ground,
    stats: gs.stats,
    strippedFt: bs.strippedFt,
  };
}

/** Block grade mixtures and paystreak summaries of one solve (§4.5.5): independent of the current block state. */
export function solveSummary(an: AnchorSolve, sol: Solve, CG: Float64Array): SolveSummary {
  const model = an.model;
  const P = model.params;
  const n = model.n;
  const H = sol.hyps.count;
  const fPost = new Float64Array(n);
  const pStreak = new Float64Array(n);
  let pBarren = 0;
  for (let h = 0; h < H; h++) {
    const w = sol.weights[h] as number;
    if (sol.hyps.barren[h] === 1) pBarren += w;
    const s = sol.hyps.streak[h] as number;
    for (let b = 0; b < n; b++) {
      const f = model.streakF[s * n + b] as number;
      fPost[b] = (fPost[b] as number) + w * f;
      if (f >= P.streakMinF) pStreak[b] = (pStreak[b] as number) + w;
    }
  }
  const CT = an.geo.T.cov;
  const cDiag = new Float64Array(n);
  const expC = new Float64Array(n * n);
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      const c = (CG[x * n + y] as number) + (CT[x * n + y] as number);
      expC[x * n + y] = exp(c);
      if (x === y) cDiag[x] = c;
    }
  }
  const p10 = new Float64Array(n);
  const p50 = new Float64Array(n);
  const p90 = new Float64Array(n);
  const lnGMean = new Float64Array(n);
  const lnGSd = new Float64Array(n);
  const mu = new Float64Array(H);
  const sd = new Float64Array(H);
  const wts = new Float64Array(H);
  for (let h = 0; h < H; h++) wts[h] = (sol.weights[h] as number) >= 1e-9 ? (sol.weights[h] as number) : 0;
  for (let b = 0; b < n; b++) {
    const sb = sqrt(Math.max(CG[b * n + b] as number, 1e-12));
    let m1 = 0;
    let m2 = 0;
    for (let h = 0; h < H; h++) {
      const x = sol.meanLnG[h * n + b] as number;
      mu[h] = x;
      sd[h] = sb;
      const w = sol.weights[h] as number;
      m1 += w * x;
      m2 += w * x * x;
    }
    const mix: Mixture = { count: H, w: wts, mu, sd };
    lnGMean[b] = m1;
    lnGSd[b] = sqrt(Math.max(0, m2 - m1 * m1) + sb * sb);
    p10[b] = exp(mixtureQuantile(mix, 0.1));
    p50[b] = exp(mixtureQuantile(mix, 0.5));
    p90[b] = exp(mixtureQuantile(mix, 0.9));
  }
  return { fPost, pStreak, pBarren, gradeQ: { p10, p50, p90 }, lnGMean, lnGSd, cDiag, expC };
}

/** Production gates' inputs over every production row (§4.8). */
export function productionStats(n: number, production: readonly PreparedProduction[]): ProductionStats {
  const bcyByBlock = new Float64Array(n);
  const bulkByBlock = new Uint8Array(n);
  let totalBcy = 0;
  for (const p of production) {
    bcyByBlock[p.b] = (bcyByBlock[p.b] as number) + p.p.inSituBcy;
    totalBcy += p.p.inSituBcy;
    if (p.p.bulkSampleProgramId !== undefined) bulkByBlock[p.b] = 1;
  }
  return { bcyByBlock, bulkByBlock, totalBcy, rows: production.length };
}

/**
 * The state layer: f_rem and the aggregation at the current block state, the overburden shift since the anchor, the
 * size mix and fineness, and the production gates. `production` lists every production row (anchored and appended).
 */
export function stateLayer(
  an: AnchorSolve,
  ps: PosteriorSolve,
  sum: SolveSummary,
  state: ContinuousState,
  assays: readonly FinenessAssay[],
  production: readonly PreparedProduction[],
): StatLayer {
  const model = an.model;
  const P = model.params;
  const n = model.n;
  const { sol, CG } = ps;
  const H = sol.hyps.count;
  const geo = an.geo;
  const T50 = new Float64Array(n);
  const fRem = new Float64Array(n);
  const alive = new Uint8Array(n);
  const obShiftFt = new Float64Array(n);
  for (let b = 0; b < n; b++) {
    T50[b] = exp(geo.T.mean[b] as number);
    const payBcy = (T50[b] as number) * BCY_PER_ACRE_FT * (model.acres[b] as number);
    fRem[b] = Math.max(0, 1 - (state.minedFrac[b] as number) - (state.sampledBcy[b] as number) / payBcy);
    alive[b] = (fRem[b] as number) > 1e-9 ? 1 : 0;
    obShiftFt[b] = (state.strippedFt[b] as number) - (an.strippedFt[b] as number);
  }

  // Pockets: P(no sample hit an existing pocket) per block, and the per-hypothesis rate and grade. Mined production
  // ground is in f_rem, not here: a pocket in the mined share would have shown in the cleanup.
  const missP = new Float64Array(n).fill(1);
  for (const s of an.samples) {
    if (!s.reachedPay || s.interval === 'exposure') continue;
    const Vb = (T50[s.b] as number) * BCY_PER_ACRE_FT * (model.acres[s.b] as number);
    missP[s.b] = (missP[s.b] as number) * Math.max(0, 1 - (P.pocketBcyMean + s.V) / Vb);
  }
  const muX = new Float64Array(H * n);
  const pocketLambda = new Float64Array(H * n);
  const pocketGrade = new Float64Array(H * n);
  const pps = model.priors.pocket.pPerStreakBlock;
  for (let h = 0; h < H; h++) {
    const s = sol.hyps.streak[h] as number;
    for (let b = 0; b < n; b++) {
      if (alive[b] !== 1) continue;
      const lg = sol.meanLnG[h * n + b] as number;
      muX[h * n + b] =
        lg +
        (geo.TbyStreak[s * n + b] as number) +
        log(BCY_PER_ACRE_FT * (model.acres[b] as number) * (fRem[b] as number));
      const f = model.streakF[s * n + b] as number;
      // A mined-out share holds no pocket either (f_rem; DESIGN §4.7 counts the whole block).
      pocketLambda[h * n + b] = f >= P.streakMinF ? pps * (missP[b] as number) * (fRem[b] as number) : 0;
      // §3's pocket law clamps the VIRGIN pocket grade to ≥ gradeMin; old-timer removal then scales it (§3.6 deplete).
      const rm = an.removal[s * n + b] as number;
      pocketGrade[h * n + b] = Math.max(P.pocketGradeMin, P.pocketGradeMult * exp(lg - rm)) * exp(rm);
    }
  }
  const agg: AggregateInputs = {
    n,
    H,
    weights: sol.weights,
    muX,
    cDiag: sum.cDiag,
    expC: sum.expC,
    alive,
    pocketLambda,
    pocketGrade,
    confirmedOz: an.confirmedOz,
    pocketBcyMean: P.pocketBcyMean,
    pocketBcy2Mean: P.pocketBcy2Mean,
    pocketGradeCv2: P.pocketGradeCv2,
  };
  const A = blockMeans(agg);
  const contained = summarizeSet(agg, A, new Uint8Array(n).fill(1), 1);

  // Size mix (§4.7): paystreak-centre coarse share from R50, non-coarse split from pooled masses.
  const R50 = exp(ps.coarse.mr);
  const pc = R50 / (1 + R50);
  const ncShare = ps.ncShare;
  const sizeMixP50: SizeRecord = {
    coarse: pc,
    medium: (1 - pc) * (ncShare[1] as number),
    fine: (1 - pc) * (ncShare[2] as number),
    ultrafine: (1 - pc) * (ncShare[3] as number),
  };
  return {
    model,
    samples: an.samples,
    hyps: sol.hyps,
    evaluatedHypotheses: an.evaluatedHypotheses,
    weights: sol.weights,
    meanLnG: sol.meanLnG,
    CG,
    geo,
    bed: an.bed,
    depl: an.depl,
    coarse: ps.coarse,
    fPost: sum.fPost,
    pStreak: sum.pStreak,
    pBarren: sum.pBarren,
    fRem,
    T50,
    confirmedOz: an.confirmedOz,
    sizeMixP50,
    fineness: finenessPosterior(model.priors.fineness, assays),
    ground: an.ground,
    stats: an.stats,
    production: productionStats(n, production),
    obShiftFt,
    agg,
    A,
    contained,
    gradeQ: sum.gradeQ,
    lnGMean: sum.lnGMean,
    lnGSd: sum.lnGSd,
  };
}

/** The full solve of an evidence set at its current block state (P0's statistical layer; no incremental path). */
export function statisticalLayer(model0: PriorModel, evidence: EvidenceSet): StatLayer {
  const an = anchorSolve(model0, {
    samples: evidence.samples,
    records: evidence.records,
    state: quantizeBlockState(evidence.blockState),
  });
  const sum = solveSummary(an, an.sol, an.CG);
  return stateLayer(
    an,
    anchorPosterior(an),
    sum,
    continuousState(an.model, evidence.blockState),
    evidence.assays,
    an.production,
  );
}
