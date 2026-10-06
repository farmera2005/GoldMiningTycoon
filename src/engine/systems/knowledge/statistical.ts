// The statistical layer of the estimate (DESIGN §4.4–4.7): everything that depends on the prior and the evidence but
// not on prices or planning. Two fixed passes (D-4.18): pass 1 evaluates N_eff and the coarse factor at the prior
// working grade, pass 2 at the pass-1 posterior; each pass ends with the site-refinement sweeps; hypotheses below
// the prune weight after pass 1 are dropped.
import { exp, log, normCdf, sqrt } from '../../core/dmath';
import type { BlockId } from '../../core/ids';
import { BCY_PER_ACRE_FT } from '../world/constants';
import type { SizeRecord } from '../world/types';
import { blockMeans, summarizeSet, type AggregateInputs, type SetSummary } from './aggregate';
import { coarseMeanMass, coarsePosterior, coarseTerms, type CoarsePosterior } from './coarse';
import {
  coarseDepletionMult,
  depletionModel,
  hypothesisPsProb,
  selectionVarRatio,
  streakMeans,
  type DepletionModel,
} from './depletion';
import { geometryPosterior, type GeometryPosterior } from './geometry';
import { mixtureQuantile, type Mixture } from './mixture';
import { allHypotheses, blockCovariance, pruneHypotheses, refineSites, solvePosterior, type Hyps } from './posterior';
import { withBlockFieldScale, type PriorModel } from './prior';
import { buildRows, pocketHits, positionOf, type Position } from './rows';
import {
  bedrockPosterior,
  classMasses,
  pooledMasses,
  prepareSamples,
  type BedrockPosterior,
  type Mass4,
  type PreparedSample,
} from './samples';
import type { EvidenceSet } from './types';

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
function ncShares(model: PriorModel, pooled: Mass4): Mass4 {
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

function blockStateArrays(
  model: PriorModel,
  evidence: EvidenceSet,
): {
  minedFrac: Float64Array;
  sampledBcy: Float64Array;
  strippedFt: Float64Array;
} {
  const n = model.n;
  const minedFrac = new Float64Array(n);
  const sampledBcy = new Float64Array(n);
  const strippedFt = new Float64Array(n);
  for (let b = 0; b < n; b++) {
    const st = evidence.blockState[model.blockIds[b] as BlockId];
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
    boulders[b] = (bouN[b] as number) > 0 ? (bouS[b] as number) / (bouN[b] as number) : tpl.boulderMed;
    frozen[b] = (frzN[b] as number) > 0 ? (frzS[b] as number) / (frzN[b] as number) : frozenClaim;
  }
  return { ground: { clay, boulders, frozen, cement }, stats: { count, volumeBcy, bedrock, maxPaySampleBcy, bulk } };
}

function fineness(model: PriorModel, evidence: EvidenceSet): { p50: number; sd: number } {
  const f = model.priors.fineness;
  let prec = 1 / (f.districtSd * f.districtSd + f.claimSd * f.claimSd);
  let num = f.mean * prec;
  for (const a of evidence.assays) {
    if (!(a.sd > 0)) continue;
    const p = 1 / (a.sd * a.sd);
    prec += p;
    num += a.value * p;
  }
  return { p50: num / prec, sd: sqrt(1 / prec) };
}

export function statisticalLayer(model0: PriorModel, evidence: EvidenceSet): StatLayer {
  const P = model0.params;
  const n = model0.n;
  const samples = prepareSamples(model0, evidence.samples, evidence.geologistOnClaim, P);
  const bs = blockStateArrays(model0, evidence);
  const bed = bedrockPosterior(samples, model0);
  const depl = depletionModel(model0, evidence, samples, bs.minedFrac, bs.strippedFt);
  const geo = geometryPosterior(model0, samples, bed, bs.strippedFt);
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
  const ncShare = ncShares(model, pooled.massByClass);
  const coarseMg = coarseMeanMass(model, pooled);
  const masses = samples.map((s) => classMasses(s, coarseMg, ncShare, P.phys.particleMeanMg));
  const pockets = pocketHits(model, samples, muE, Vm, coarseMg, ncShare);

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
    records: evidence.records,
    ncShare,
  };
  let co = coarsePosterior(model, samples, a, rTilde, coarseMg, ncShare, pockets.excluded);
  let sol = null as ReturnType<typeof solvePosterior> | null;
  let rows = null as ReturnType<typeof buildRows> | null;
  const passes = Math.max(1, P.varIterations);
  for (let pass = 0; pass < passes; pass++) {
    co = coarsePosterior(model, samples, a, rTilde, coarseMg, ncShare, pockets.excluded);
    const ct = coarseTerms(a, co.mr, co.vr);
    rows = buildRows(rowInputs, gt, ct);
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
  const H = sol.hyps.count;

  // Posterior summaries per block.
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
  const T50 = new Float64Array(n);
  const fRem = new Float64Array(n);
  const alive = new Uint8Array(n);
  for (let b = 0; b < n; b++) {
    T50[b] = exp(geo.T.mean[b] as number);
    const payBcy = (T50[b] as number) * BCY_PER_ACRE_FT * (model.acres[b] as number);
    fRem[b] = Math.max(0, 1 - (bs.minedFrac[b] as number) - (bs.sampledBcy[b] as number) / payBcy);
    alive[b] = (fRem[b] as number) > 1e-9 ? 1 : 0;
  }

  // Pockets: P(no sample hit an existing pocket) per block, and the per-hypothesis rate and grade.
  const missP = new Float64Array(n).fill(1);
  for (const s of samples) {
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
      const rm = removal[s * n + b] as number;
      pocketGrade[h * n + b] = Math.max(P.pocketGradeMin, P.pocketGradeMult * exp(lg - rm)) * exp(rm);
    }
  }
  const CT = geo.T.cov;
  const cDiag = new Float64Array(n);
  const expC = new Float64Array(n * n);
  for (let x = 0; x < n; x++) {
    for (let y = 0; y < n; y++) {
      const c = (CG[x * n + y] as number) + (CT[x * n + y] as number);
      expC[x * n + y] = exp(c);
      if (x === y) cDiag[x] = c;
    }
  }
  const agg: AggregateInputs = {
    n,
    H,
    weights: sol.weights,
    muX,
    cDiag,
    expC,
    alive,
    pocketLambda,
    pocketGrade,
    confirmedOz: pockets.confirmedOz,
    pocketBcyMean: P.pocketBcyMean,
    pocketBcy2Mean: P.pocketBcy2Mean,
    pocketGradeCv2: P.pocketGradeCv2,
  };
  const A = blockMeans(agg);
  const contained = summarizeSet(agg, A, new Uint8Array(n).fill(1), 1);

  // Block grade mixtures (§4.5.5).
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

  // Size mix (§4.7): paystreak-centre coarse share from R50, non-coarse split from pooled masses.
  const R50 = exp(co.mr);
  const pc = R50 / (1 + R50);
  const sizeMixP50: SizeRecord = {
    coarse: pc,
    medium: (1 - pc) * (ncShare[1] as number),
    fine: (1 - pc) * (ncShare[2] as number),
    ultrafine: (1 - pc) * (ncShare[3] as number),
  };
  const gs = groundAndStats(model, samples);
  return {
    model,
    samples,
    hyps: sol.hyps,
    evaluatedHypotheses,
    weights: sol.weights,
    meanLnG: sol.meanLnG,
    CG,
    geo,
    bed,
    depl,
    coarse: co,
    fPost,
    pStreak,
    pBarren,
    fRem,
    T50,
    confirmedOz: pockets.confirmedOz,
    sizeMixP50,
    fineness: fineness(model, evidence),
    ground: gs.ground,
    stats: gs.stats,
    agg,
    A,
    contained,
    gradeQ: { p10, p50, p90 },
    lnGMean,
    lnGSd,
  };
}
