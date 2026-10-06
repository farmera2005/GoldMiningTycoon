// The public prior as the estimator uses it (DESIGN §4.5.1, §4.6, §4.5.3): §3's hierarchy and covariance plus the
// discrete paystreak hypotheses, the geometry priors by the delta method and the coarse-factor Gamma prior. Built
// only from ClaimPriors (§3 claimPriors: template constants and visible facts) and the resolved parameters, so
// scrambling any hidden field leaves it unchanged (§4.22 "No truth leakage"). Memoized per priors object.
import type { BlockId } from '../../core/ids';
import { exp, log, sqrt } from '../../core/dmath';
import { createWeakMemo } from '../../core/memo';
import { BLOCK_FT } from '../world/constants';
import { DEPOSIT_TYPES, OLD_TIMER_KINDS } from '../world/enums';
import { listingSettingOf, visibleDepositType } from '../world/priors';
import type { ClaimPriors, DepositType, SizeRecord } from '../world/types';
import type { EstimatorParams, TemplateConsts } from './params';
import { digamma, invTrigamma } from './special';

const HALF_BLOCK_FT = BLOCK_FT / 2;

/**
 * §4.5.1 half-width nodes and weights: the three-point Gauss–Hermite rule for a standard normal, ±√3 with weights
 * 1/6, 2/3, 1/6 (design delta: DESIGN prints the physicists' nodes ±1.2247 = √1.5 with the normalized weights, which
 * gives the half-width half its variance).
 */
const HW_Z = [-1.7320508075688772, 0, 1.7320508075688772] as const;
const HW_W = [1 / 6, 2 / 3, 1 / 6] as const;
/** Five-point Gauss–Hermite rule for a standard normal (row misfit of the centre). */
const Z5 = [-2.8569700138728056, -1.3556261799742659, 0, 1.3556261799742659, 2.8569700138728056] as const;
const W5 = [
  0.011257411327720691, 0.22207592200561266, 0.5333333333333333, 0.22207592200561266, 0.011257411327720691,
] as const;

/**
 * Var[c(x) | c(0), c(L)] / σ² for §3's AR(1) paystreak centre (range R): what a straight line between the end rows
 * leaves unexplained at along-distance x (0 at the ends; ≈ 1 mid-claim on a 40-row claim).
 */
export function centreMisfitVar(x: number, L: number, R: number): number {
  if (!(L > 0)) return 0;
  const r1 = exp(-x / R);
  const r2 = exp(-(L - x) / R);
  const rL = exp(-L / R);
  const den = 1 - rL * rL;
  if (!(den > 1e-12)) return 0;
  return Math.max(0, 1 - (r1 * r1 + r2 * r2 - 2 * r1 * r2 * rL) / den);
}

/** Mean correlation of §3's AR(1) ln half-width (range R) between row i and the claim's rows, and over all row pairs. */
function rowCorrMeans(i: number, nAlong: number, R: number): { ri: number; rr: number } {
  const rho = (a: number, b: number): number => exp(-(Math.abs(a - b) * BLOCK_FT) / R);
  let ri = 0;
  let rr = 0;
  for (let j = 0; j < nAlong; j++) {
    ri += rho(i, j);
    for (let k = 0; k < nAlong; k++) rr += rho(j, k);
  }
  return { ri: ri / nAlong, rr: rr / (nAlong * nAlong) };
}

/** Var[z_i − mean_j z_j] / σ² for §3's AR(1) ln half-width over nAlong rows: the row's spread about the claim's. */
export function halfWidthMisfitVar(i: number, nAlong: number, R: number): number {
  const { ri, rr } = rowCorrMeans(i, nAlong, R);
  return Math.max(0, 1 - 2 * ri + rr);
}

/** Var[mean_j z_j] / σ²: the claim-level half-width's share of §3's row variance (1 for one row, → 0 on long claims). */
export function halfWidthClaimVar(nAlong: number, R: number): number {
  return rowCorrMeans(0, nAlong, R).rr;
}

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
/**
 * The hidden deposit types behind the visible setting (design delta): §3's prior reads valley-bottom ground as 'creek',
 * but a share of it is deep muck (§3.2: ×1.3 grade under thick cover, overlooked by stakers, never hand-cut or
 * dredged). P(dep) ∝ depositMix[dep] × Σ oldTimerMix[dep][k] over the old-timer kinds the visible features allow
 * (ClaimPriors.oldTimer.pKind's kinds), with each type's log grade offset against the visible type.
 */
export function hiddenDeposits(
  priors: ClaimPriors,
  tpl: TemplateConsts,
): { dep: DepositType; p: number; lnMult: number }[] {
  const vis = visibleDepositType(priors.setting);
  const kinds = OLD_TIMER_KINDS.filter((k) => (priors.oldTimer.pKind[k] ?? 0) > 0);
  const out: { dep: DepositType; p: number; lnMult: number }[] = [];
  let total = 0;
  for (const dep of DEPOSIT_TYPES) {
    if (listingSettingOf(dep) !== priors.setting) continue;
    const mix = tpl.oldTimerMix[dep] ?? { none: 1 };
    let k = 0;
    for (const kind of kinds) k += mix[kind] ?? 0;
    const w = (tpl.depositMix[dep] ?? 0) * (kinds.length > 0 ? k : 1);
    if (!(w > 0)) continue;
    total += w;
    out.push({ dep, p: w, lnMult: log((tpl.depositGradeMult[dep] ?? 1) / (tpl.depositGradeMult[vis] ?? 1)) });
  }
  if (!(total > 0)) return [{ dep: vis, p: 1, lnMult: 0 }];
  return out.map((d) => ({ ...d, p: d.p / total }));
}

function heldSelection(
  priors: ClaimPriors,
  params: EstimatorParams,
  tpl: TemplateConsts,
  Se: Float64Array,
  n: number,
  psProb: Float64Array,
  resid2: number,
  misfitVar: Float64Array,
  VmBase: number,
): HeldSelection {
  const deps = hiddenDeposits(priors, tpl);
  const sel = params.selection;
  const slopeOf = (dep: DepositType): number =>
    dep === 'bench' || dep === 'deepMuck' ? sel.slopeOverlooked : sel.slope;
  const a = log(tpl.stakedFraction / (1 - tpl.stakedFraction));
  // The likely paystreak blocks: P(f ≥ 0.4) ≥ ½ under the prior, else the most likely ones.
  const order = [...Array(n).keys()].sort((x, y) => (psProb[y] as number) - (psProb[x] as number) || x - y);
  let expected = 0;
  for (let k = 0; k < n; k++) expected += psProb[k] as number;
  const nPs = Math.max(1, Math.min(n, Math.round(expected)));
  const ps = order.slice(0, nPs);
  let cov = 0;
  let diag = 0;
  // §3 selects on virgin gStreak: neither the iid streak residual nor the row misfit of f is in it.
  for (const x of ps) {
    const own = resid2 + (misfitVar[x] as number);
    diag += (Se[x * n + x] as number) - own;
    for (const y of ps) cov += (Se[x * n + y] as number) - (x === y ? own : 0);
  }
  const varE = cov / (nPs * nPs);
  const sx2 = diag / nPs;
  const meanE = sx2 / 2 - varE / 2;
  const status = priors.priorStatus;
  const lnStatus = log(params.statusMult[status]);
  const u0 = priors.logGradeMedian - lnStatus - log(tpl.gMed) + meanE;
  const sU2 = VmBase + varE;
  // Each hidden deposit type is its own class (grade offset and §3.4 slope); the selection mixes them.
  const mixClass = (base: number, held: boolean): { z: number; m1: number; m2: number } => {
    let z = 0;
    let m1 = 0;
    let m2 = 0;
    for (const d of deps) {
      const u = base + d.lnMult;
      const t = held ? tiltedMoments(u, sU2, a, slopeOf(d.dep) / sel.zqLnScale) : { z: 1, m1: u, m2: sU2 + u * u };
      z += d.p * t.z;
      m1 += d.p * t.z * t.m1;
      m2 += d.p * t.z * t.m2;
    }
    return { z, m1: m1 / z, m2: m2 / z };
  };
  const held = status !== 'open';
  const gold = mixClass(u0, held);
  const lb = log(priors.barrenMult);
  const barren = mixClass(u0 + lb, held);
  let g0 = 0;
  let noPsShift = 0;
  for (const d of deps) {
    const gd = held ? logistic(a + slopeOf(d.dep) * sel.zqNoPaystreak) : 1;
    g0 += d.p * gd;
    noPsShift += d.p * gd * d.lnMult;
  }
  return {
    gold: { logWeight: log(gold.z), shift: gold.m1 - u0 },
    barren: { logWeight: log(barren.z), shift: barren.m1 - (u0 + lb) },
    noPaystreak: { logWeight: log(g0), shift: noPsShift / g0 },
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
  /** Σ_e (n × n): σ_block² exp(−|Δalong|/R_a − |Δacross|/R_c) + resid² + the row misfit on the diagonal. */
  readonly Se: Float64Array;
  /** E[ln(f + (1 − f)·bgRatio)] per configuration and block over the row misfit (S × n). */
  readonly streakLogMean: Float64Array;
  /** Prior-weighted variance of ln(f + (1 − f)·bgRatio) over the row misfit, per block (in Σ_e's diagonal). */
  readonly misfitVar: Float64Array;
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

function visibleDepositKey(
  setting: ClaimPriors['setting'],
): 'creek' | 'bench' | 'dredgedGround' | 'desertFan' | 'gulch' {
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

/**
 * The model with the block-field term of Σ_e rescaled per block: Σ_e' = Σ_e + (d_a d_b − 1) σ_block² ρ_ab, d_b =
 * √ratio_b (D Σ_block D stays positive semi-definite). Used for the old-timers' selection (depletion.ts).
 */
export function withBlockFieldScale(model: PriorModel, ratio: Float64Array): PriorModel {
  const n = model.n;
  const p = model.priors;
  const sb2 = model.sigmaBlock * model.sigmaBlock;
  const d = new Float64Array(n);
  for (let b = 0; b < n; b++) d[b] = sqrt(Math.max(0, ratio[b] as number));
  const Se = new Float64Array(model.Se);
  for (let a = 0; a < n; a++) {
    for (let b = 0; b < n; b++) {
      const k = (d[a] as number) * (d[b] as number) - 1;
      if (k === 0) continue;
      const da = Math.abs((model.bi[a] as number) - (model.bi[b] as number)) * BLOCK_FT;
      const dc = Math.abs((model.bj[a] as number) - (model.bj[b] as number)) * BLOCK_FT;
      Se[a * n + b] = (Se[a * n + b] as number) + k * sb2 * exp(-da / p.rangeAlongFt - dc / p.rangeAcrossFt);
    }
  }
  return { ...model, Se };
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
        sb2 * exp(-da / priors.rangeAlongFt - dc / priors.rangeAcrossFt) +
        rich2 * exp(-da / richRange) +
        (a === b ? resid2 : 0);
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
      for (const z2 of nodes)
        pairs.push({ zDown: z1, zUp: z2, w: exp(-(z1 * z1 - 2 * rho * z1 * z2 + z2 * z2) / den) });
    }
  }
  let pairTotal = 0;
  for (const p of pairs) pairTotal += p.w;
  const hwNodes = params.streakHwNodes === 3 ? HW_Z : ([0] as const);
  const hwWeights = params.streakHwNodes === 3 ? HW_W : ([1] as const);
  const S = pairs.length * hwNodes.length;
  const streakF = new Float64Array(S * n);
  const streakLogMean = new Float64Array(S * n);
  const streakLogVar = new Float64Array(S * n);
  const streakPrior = new Float64Array(S);
  const wander = priors.streak.wanderSdFt;
  const bg = priors.streak.bgRatio;
  // Row misfit (estStreakMisfitScale): sd of the centre (ft) and of ln half-width at each row about the configuration.
  const L = (nAlong - 1) * BLOCK_FT;
  const sc = params.streakMisfitScale;
  const rowSdC = new Float64Array(nAlong);
  const rowSdH = new Float64Array(nAlong);
  for (let i = 0; i < nAlong; i++) {
    rowSdC[i] = wander * sqrt(sc * centreMisfitVar(i * BLOCK_FT, L, params.wanderRangeFt));
    rowSdH[i] = priors.streak.sigHalfWidth * sqrt(sc * halfWidthMisfitVar(i, nAlong, params.halfWidthRangeFt));
  }
  const lnShare = (d: number, hw: number): number => {
    const f = overlapShare(d, hw);
    return log(f + (1 - f) * bg);
  };
  // The configuration's half-width is the claim's row average: its spread is σ_hw √(mean row correlation), and the
  // rows scatter about it by the misfit above (together §3's full σ_hw per row).
  const sdHwClaim = priors.streak.sigHalfWidth * sqrt(sc > 0 ? halfWidthClaimVar(nAlong, params.halfWidthRangeFt) : 1);
  let sIdx = 0;
  for (const p of pairs) {
    for (let h = 0; h < hwNodes.length; h++) {
      const hw = priors.streak.halfWidthMedFt * exp(sdHwClaim * (hwNodes[h] as number));
      for (let b = 0; b < n; b++) {
        const t = nAlong > 1 ? (bi[b] as number) / (nAlong - 1) : 0.5;
        const c = ((1 - t) * p.zDown + t * p.zUp) * wander;
        const d = (xFt[b] as number) - c;
        streakF[sIdx * n + b] = overlapShare(d, hw);
        const sdC = rowSdC[bi[b] as number] as number;
        const sdH = rowSdH[bi[b] as number] as number;
        if (!(sdC > 0) && !(sdH > 0)) {
          streakLogMean[sIdx * n + b] = lnShare(d, hw);
          continue;
        }
        let m1 = 0;
        let m2 = 0;
        for (let q = 0; q < 5; q++) {
          for (let r = 0; r < 3; r++) {
            const g = lnShare(d - sdC * (Z5[q] as number), hw * exp(sdH * (HW_Z[r] as number)));
            const w = (W5[q] as number) * (HW_W[r] as number);
            m1 += w * g;
            m2 += w * g * g;
          }
        }
        streakLogMean[sIdx * n + b] = m1;
        streakLogVar[sIdx * n + b] = Math.max(0, m2 - m1 * m1);
      }
      streakPrior[sIdx] = (p.w / pairTotal) * (hwWeights[h] as number);
      sIdx++;
    }
  }
  const misfitVar = new Float64Array(n);
  for (let k = 0; k < S; k++) {
    const w = streakPrior[k] as number;
    for (let b = 0; b < n; b++) misfitVar[b] = (misfitVar[b] as number) + w * (streakLogVar[k * n + b] as number);
  }
  for (let b = 0; b < n; b++) Se[b * n + b] = (Se[b * n + b] as number) + (misfitVar[b] as number);
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
  const selection = heldSelection(priors, params, tpl, Se, n, psProb, resid2, misfitVar, VmBase);
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
    streakLogMean,
    misfitVar,
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
