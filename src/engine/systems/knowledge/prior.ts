// The public prior as the estimator uses it (DESIGN §4.5.1, §4.6, §4.5.3): §3's hierarchy and covariance plus the
// discrete paystreak hypotheses, the geometry priors by the delta method and the coarse-factor Gamma prior. Built
// only from ClaimPriors (§3 claimPriors: template constants and visible facts) and the resolved parameters, so
// scrambling any hidden field leaves it unchanged (§4.22 "No truth leakage"). Memoized per priors object.
import type { BlockId } from '../../core/ids';
import { exp, log, sqrt } from '../../core/dmath';
import { createWeakMemo } from '../../core/memo';
import { BLOCK_FT } from '../world/constants';
import type { ClaimPriors, SizeRecord } from '../world/types';
import type { EstimatorParams, TemplateConsts } from './params';
import { digamma, invTrigamma } from './special';

const HALF_BLOCK_FT = BLOCK_FT / 2;

/** §4.5.1 half-width nodes and weights (three-point rule as DESIGN prints it). */
const HW_Z = [-1.2247, 0, 1.2247] as const;
const HW_W = [1 / 6, 2 / 3, 1 / 6] as const;

/** Share of a 209-ft block inside the paystreak [c − hw, c + hw] for a block centred d ft from the centre (§3.5.3). */
export function overlapShare(d: number, halfWidthFt: number): number {
  const lo = Math.max(d - HALF_BLOCK_FT, -halfWidthFt);
  const hi = Math.min(d + HALF_BLOCK_FT, halfWidthFt);
  return Math.max(0, hi - lo) / BLOCK_FT;
}

export interface SelectionTerm {
  /** ln of the selection factor's expectation for the class (multiplies the hypothesis prior). */
  readonly logWeight: number;
  /** Shift of the claim mean m given selection. */
  readonly shift: number;
}

export interface HeldSelection {
  readonly gold: SelectionTerm;
  readonly barren: SelectionTerm;
  readonly noPaystreak: SelectionTerm;
  /** Var[u | held] / Var[u] for the gold-bearing class (shrinks V_m). */
  readonly varRatio: number;
  readonly sU2: number;
}

const NO_SELECTION: HeldSelection = {
  gold: { logWeight: 0, shift: 0 },
  barren: { logWeight: 0, shift: 0 },
  noPaystreak: { logWeight: 0, shift: 0 },
  varRatio: 1,
  sU2: 1,
};

function logistic(x: number): number {
  return x >= 0 ? 1 / (1 + exp(-x)) : exp(x) / (1 + exp(x));
}

/** Moments of N(mean, s²) tilted by logistic(a + c·u), on a fixed 121-point grid over ±6 sd. */
function tiltedMoments(mean: number, s2: number, a: number, c: number): { z: number; m1: number; m2: number } {
  const sd = sqrt(s2);
  let w0 = 0;
  let wz = 0;
  let w1 = 0;
  let w2 = 0;
  for (let k = 0; k <= 120; k++) {
    const z = -6 + k / 10;
    const u = mean + sd * z;
    const pdf = exp(-0.5 * z * z);
    const g = logistic(a + c * u);
    w0 += pdf;
    wz += pdf * g;
    w1 += pdf * g * u;
    w2 += pdf * g * u * u;
  }
  return { z: wz / w0, m1: w1 / wz, m2: w2 / wz };
}

/**
 * The held-selection factor (design delta, DESIGN D-4.16): §3.4 stakes a parcel with probability
 * logistic(logit(stakedFraction) + b·zq), zq = ln(mean virgin gStreak of its paystreak blocks / gMed) / zqLnScale, b the
 * template slope (weak on benches, whose quality is hard to see), zq = zqNoPaystreak without paystreak blocks. Held
 * status is visible, so the prior for held and listed claims (the listing pool is held claims that came to market)
 * carries that factor: barren creeks are rarely staked (P(barren | held valley claim) ≈ 0.03, not 0.20) and held
 * claims sit above gMed. u = ln(gStreak/gMed) of the claim ≈ (m − ln gMed) + ln(mean of e^{rich + block} over the
 * paystreak blocks); the tilted moments of u give each hypothesis class its weight and its shift of m.
 */
function heldSelection(
  priors: ClaimPriors,
  params: EstimatorParams,
  tpl: TemplateConsts,
  Se: Float64Array,
  n: number,
  psProb: Float64Array,
  resid2: number,
  VmBase: number,
): HeldSelection {
  if (priors.priorStatus === 'open') return NO_SELECTION;
  const sel = params.selection;
  const b = priors.setting === 'bench' ? sel.slopeOverlooked : sel.slope;
  const a = log(tpl.stakedFraction / (1 - tpl.stakedFraction));
  const c = b / sel.zqLnScale;
  // The likely paystreak blocks: P(f ≥ 0.4) ≥ ½ under the prior, else the most likely ones.
  const order = [...Array(n).keys()].sort((x, y) => (psProb[y] as number) - (psProb[x] as number) || x - y);
  let expected = 0;
  for (let k = 0; k < n; k++) expected += psProb[k] as number;
  const nPs = Math.max(1, Math.min(n, Math.round(expected)));
  const ps = order.slice(0, nPs);
  let cov = 0;
  let diag = 0;
  for (const x of ps) {
    diag += (Se[x * n + x] as number) - resid2;
    for (const y of ps) cov += (Se[x * n + y] as number) - (x === y ? resid2 : 0);
  }
  const varE = cov / (nPs * nPs);
  const sx2 = diag / nPs;
  const meanE = sx2 / 2 - varE / 2;
  const status = priors.priorStatus;
  const lnStatus = log(params.statusMult[status]);
  const u0 = priors.logGradeMedian - lnStatus - log(tpl.gMed) + meanE;
  const sU2 = VmBase + varE;
  const gold = tiltedMoments(u0, sU2, a, c);
  const barren = tiltedMoments(u0 + log(priors.barrenMult), sU2, a, c);
  const g0 = logistic(a + b * sel.zqNoPaystreak);
  return {
    gold: { logWeight: log(gold.z), shift: gold.m1 - u0 },
    barren: { logWeight: log(barren.z), shift: barren.m1 - (u0 + log(priors.barrenMult)) },
    noPaystreak: { logWeight: log(g0), shift: 0 },
    varRatio: (gold.m2 - gold.m1 * gold.m1) / sU2,
    sU2,
  };
}

export interface PriorModel {
  readonly priors: ClaimPriors;
  readonly params: EstimatorParams;
  readonly tpl: TemplateConsts;
  readonly n: number;
  readonly nAlong: number;
  readonly nAcross: number;
  readonly bi: Int32Array;
  readonly bj: Int32Array;
  readonly xFt: Float64Array;
  readonly acres: Float64Array;
  readonly blockIds: readonly BlockId[];
  readonly indexOf: Readonly<Partial<Record<BlockId, number>>>;
  /** ln of the prior median grade, with the calibration valve (§4.5.1 M). */
  readonly M: number;
  /**
   * σ_district² + σ_creek² + σ_claim² (v_depl is added per estimate). §3 draws the rich/poor stretch term as an AR(1)
   * along the creek (range tpl.richRangeFt), so it sits in Σ_e with that correlation instead of in V_m (design delta:
   * DESIGN §4.5.1 puts σ_rich² in V_m, identical for short claims and wrong for 160-acre ones).
   */
  readonly VmBase: number;
  readonly sigmaBlock: number;
  /** Σ_e (n × n): σ_block² exp(−|Δalong|/R_a − |Δacross|/R_c) + resid² on the diagonal. */
  readonly Se: Float64Array;
  /** Paystreak configurations (cDown, cUp, hw): f per block (S × n) and normalized prior weight. */
  readonly S: number;
  readonly streakF: Float64Array;
  readonly streakPrior: Float64Array;
  readonly pBarren: number;
  readonly lnBarrenMult: number;
  /** Does the configuration put any block on the paystreak (f ≥ 0.4)? */
  readonly streakHasPS: Uint8Array;
  /** The held-selection factor of §3.4 by hypothesis class (see heldSelection). */
  readonly selection: HeldSelection;
  readonly large: boolean;
  readonly pruneWeight: number;
  /** Prior mean and sd of f_b over the configurations. */
  readonly fbar: Float64Array;
  readonly fsd: Float64Array;
  readonly coarse: { readonly R0: number; readonly alpha0: number; readonly beta0: number; readonly sdLnR: number };
  /** Overburden median before stripping (0 on visibly dredged ground), ft. */
  readonly ob50: Float64Array;
  readonly sizeMixPrior: SizeRecord;
  readonly dredgedVisible: boolean;
  readonly pFrozen: number;
}

function visibleDepositKey(setting: ClaimPriors['setting']): 'creek' | 'bench' | 'dredgedGround' | 'desertFan' | 'gulch' {
  switch (setting) {
    case 'valleyBottom':
      return 'creek';
    case 'bench':
      return 'bench';
    case 'dredgedGround':
      return 'dredgedGround';
    case 'fan':
      return 'desertFan';
    case 'gulch':
      return 'gulch';
  }
}

/**
 * Coarse-ratio prior implied by §3's per-class size-mix jitter LN(1, σ) then normalization (§4.5.3): ln R =
 * ln p₀ + σZ₀ − ln Σ_{k≥1} p_k e^{σZ_k}; the sum of lognormals by Fenton–Wilkinson gives
 * Var[ln R] = σ² + σ_S², E[ln R] = ln(p₀/Σp_k) − σ²/2 + σ_S²/2 (mid-reach: sd 0.30, R0 0.327).
 */
export function coarseRatioPrior(mix: SizeRecord, jitterLogSd: number): { meanLnR: number; varLnR: number } {
  const s2 = jitterLogSd * jitterLogSd;
  const rest = [mix.medium, mix.fine, mix.ultrafine];
  let sum = 0;
  let sumSq = 0;
  for (const p of rest) {
    sum += p;
    sumSq += p * p;
  }
  const sS2 = log(1 + ((exp(s2) - 1) * sumSq) / (sum * sum));
  return { meanLnR: log(mix.coarse / sum) - s2 / 2 + sS2 / 2, varLnR: s2 + sS2 };
}

function hypothesisNodes(nodes: number): number[] {
  const out: number[] = [];
  for (let a = 0; a < nodes; a++) out.push(nodes === 1 ? 0 : -3 + (6 * a) / (nodes - 1));
  return out;
}

function buildPriorModel(priors: ClaimPriors, params: EstimatorParams): PriorModel {
  const tpl = params.templates[priors.templateId];
  if (tpl === undefined) throw new RangeError(`estimator: no template constants for ${priors.templateId}`);
  const n = priors.blocks.length;
  const bi = new Int32Array(n);
  const bj = new Int32Array(n);
  const xFt = new Float64Array(n);
  const acres = new Float64Array(n);
  const blockIds: BlockId[] = [];
  const indexOf: Partial<Record<BlockId, number>> = {};
  let nAlong = 0;
  let nAcross = 0;
  priors.blocks.forEach((b, k) => {
    bi[k] = b.i;
    bj[k] = b.j;
    xFt[k] = b.xFt;
    acres[k] = b.acres;
    blockIds.push(b.blockId);
    indexOf[b.blockId] = k;
    nAlong = Math.max(nAlong, b.i + 1);
    nAcross = Math.max(nAcross, b.j + 1);
  });

  const s = priors.sigma;
  const VmBase = s.district * s.district + s.creek * s.creek + s.claim * s.claim;
  const rich2 = s.rich * s.rich;
  const richRange = params.richRangeFt[priors.templateId] ?? priors.rangeAlongFt;
  const M = priors.logGradeMedian + (params.priorMedianAdj[priors.templateId] ?? 0);

  // Block field covariance (§4.5.1, D-4.3): §3's separable exponential plus the iid streak residual.
  const Se = new Float64Array(n * n);
  const sb2 = s.block * s.block;
  const resid2 = params.streakResidLogSd * params.streakResidLogSd;
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) {
      const da = Math.abs((bi[a] as number) - (bi[b] as number)) * BLOCK_FT;
      const dc = Math.abs((bj[a] as number) - (bj[b] as number)) * BLOCK_FT;
      Se[a * n + b] =
        sb2 * exp(-da / priors.rangeAlongFt - dc / priors.rangeAcrossFt) + rich2 * exp(-da / richRange) + (a === b ? resid2 : 0);
    }
  }

  // Paystreak hypotheses (§4.5.1): centre offsets at the downstream and upstream rows on a node grid, weighted by
  // their bivariate normal density with the AR correlation over the claim's length; three half-width nodes.
  const large = n > params.largeClaimBlocks;
  const nodes = hypothesisNodes(large ? params.streakNodesLarge : params.streakNodes);
  const nz = nodes.length;
  const rho = exp(-((nAlong - 1) * BLOCK_FT) / params.streakRangeAlongFt);
  const pairs: { zDown: number; zUp: number; w: number }[] = [];
  if (1 - rho * rho < 1e-9) {
    for (const z of nodes) pairs.push({ zDown: z, zUp: z, w: exp((-z * z) / 2) });
  } else {
    const den = 2 * (1 - rho * rho);
    for (const z1 of nodes) {
      for (const z2 of nodes) pairs.push({ zDown: z1, zUp: z2, w: exp(-(z1 * z1 - 2 * rho * z1 * z2 + z2 * z2) / den) });
    }
  }
  let pairTotal = 0;
  for (const p of pairs) pairTotal += p.w;
  const hwNodes = params.streakHwNodes === 3 ? HW_Z : ([0] as const);
  const hwWeights = params.streakHwNodes === 3 ? HW_W : ([1] as const);
  const S = pairs.length * hwNodes.length;
  const streakF = new Float64Array(S * n);
  const streakPrior = new Float64Array(S);
  const wander = priors.streak.wanderSdFt;
  let sIdx = 0;
  for (const p of pairs) {
    for (let h = 0; h < hwNodes.length; h++) {
      const hw = priors.streak.halfWidthMedFt * exp(priors.streak.sigHalfWidth * (hwNodes[h] as number));
      for (let b = 0; b < n; b++) {
        const t = nAlong > 1 ? (bi[b] as number) / (nAlong - 1) : 0.5;
        const c = ((1 - t) * p.zDown + t * p.zUp) * wander;
        streakF[sIdx * n + b] = overlapShare((xFt[b] as number) - c, hw);
      }
      streakPrior[sIdx] = (p.w / pairTotal) * (hwWeights[h] as number);
      sIdx++;
    }
  }
  void nz;
  const fbar = new Float64Array(n);
  const fsd = new Float64Array(n);
  for (let b = 0; b < n; b++) {
    let m1 = 0;
    let m2 = 0;
    for (let k = 0; k < S; k++) {
      const f = streakF[k * n + b] as number;
      const w = streakPrior[k] as number;
      m1 += w * f;
      m2 += w * f * f;
    }
    fbar[b] = m1;
    fsd[b] = sqrt(Math.max(0, m2 - m1 * m1));
  }

  const streakHasPS = new Uint8Array(S);
  const psProb = new Float64Array(n);
  for (let k = 0; k < S; k++) {
    let any = 0;
    for (let b = 0; b < n; b++) {
      if ((streakF[k * n + b] as number) >= params.streakMinF) {
        any = 1;
        psProb[b] = (psProb[b] as number) + (streakPrior[k] as number);
      }
    }
    streakHasPS[k] = any;
  }
  const selection = heldSelection(priors, params, tpl, Se, n, psProb, resid2, VmBase);
  // Selection narrows u = m + ē; its variance reduction is credited to m (V_m).
  const VmSel = VmBase - (1 - selection.varRatio) * ((VmBase * VmBase) / selection.sU2);

  const cr = coarseRatioPrior(priors.sizeMixPrior, priors.sizeMixJitterLogSd);
  const alpha0 = invTrigamma(cr.varLnR);
  const R0 = exp(cr.meanLnR);
  const beta0 = exp(digamma(alpha0)) / R0;

  const dredgedVisible = priors.oldTimer.pKind.dredge === 1;
  const ob50 = new Float64Array(n);
  for (let b = 0; b < n; b++) {
    const a = (xFt[b] as number) / params.obAxisScaleFt;
    // Muck is thickest on the valley axis (§3.5.3); a dredge left no overburden (§3.6), which its tailings show.
    ob50[b] = dredgedVisible ? 0 : priors.geometry.obMedFt * (1 + params.obAxisBoost * exp(-a * a));
  }

  return {
    priors,
    params,
    tpl,
    n,
    nAlong,
    nAcross,
    bi,
    bj,
    xFt,
    acres,
    blockIds,
    indexOf,
    M,
    VmBase: VmSel,
    sigmaBlock: s.block,
    Se,
    S,
    streakF,
    streakPrior,
    pBarren: priors.pBarrenCreek,
    lnBarrenMult: log(priors.barrenMult),
    streakHasPS,
    selection,
    large,
    pruneWeight: large ? params.hypPruneWeightLarge : params.hypPruneWeight,
    fbar,
    fsd,
    coarse: { R0, alpha0, beta0, sdLnR: sqrt(cr.varLnR) },
    ob50,
    sizeMixPrior: priors.sizeMixPrior,
    dredgedVisible,
    pFrozen: tpl.permafrostP[visibleDepositKey(priors.setting)] ?? 0,
  };
}

interface PriorEntry {
  readonly params: EstimatorParams;
  readonly model: PriorModel;
}

const priorMemo = createWeakMemo<ClaimPriors, PriorEntry>('knowledge.priorModel');

/** The claim's prior model; ClaimPriors objects are immutable and memoized by §3 per claim and status. */
export function priorModel(priors: ClaimPriors, params: EstimatorParams): PriorModel {
  const hit = priorMemo.get(priors);
  if (hit !== undefined && hit.params === params) return hit.model;
  const model = buildPriorModel(priors, params);
  priorMemo.set(priors, { params, model });
  return model;
}
