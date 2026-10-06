// Quantiles of a weighted mixture of normals (in log space), DESIGN §4.5.5 and §4.7: the CDF is monotone and smooth,
// so Halley steps (the mixture's density and its slope come free with Φ) safeguarded by a shrinking bracket converge
// in a few evaluations; a fixed tolerance and iteration cap keep the result a pure function of the inputs (bisection
// would need 60 CDF evaluations). Φ and φ come from the deterministic table of normal.ts (D-4.58): block and claim
// quantiles evaluate them hundreds of thousands of times per estimate, and dmath's exact forms dominated the
// statistical layer (§2.13).
import { normInv, sqrt } from '../../core/dmath';
import { NORMAL_INTERVALS, NORMAL_STEPS_PER_UNIT, NORMAL_Z_FAR, PDF_C, PHI_C, stdNormCdf } from './normal';

// Module-local references to the table: a transpiled module may reach an imported binding through a getter on every
// access, which the inner loop must not pay (§2.13).
const PHI = PHI_C;
const PDF = PDF_C;
const STEPS = NORMAL_STEPS_PER_UNIT;
const INTERVALS = NORMAL_INTERVALS;
const Z_FAR = NORMAL_Z_FAR;
const MAX_ITER = 100;
const X_TOL = 1e-10;
const Z10 = -1.2815515655446004;

export interface Mixture {
  readonly count: number;
  readonly w: Float64Array;
  readonly mu: Float64Array;
  /** Component standard deviations (> 0). */
  readonly sd: Float64Array;
}

export function mixtureCdf(m: Mixture, x: number): number {
  let F = 0;
  for (let i = 0; i < m.count; i++)
    F += (m.w[i] as number) * stdNormCdf((x - (m.mu[i] as number)) / (m.sd[i] as number));
  return F;
}

/** The mixture's active components (weight > 0), its moments and its 9-sd bracket, in scratch arrays. */
interface Active {
  k: number;
  w: Float64Array;
  mu: Float64Array;
  invSd: Float64Array;
  wsum: number;
  mean: number;
  sd: number;
  lo: number;
  hi: number;
}

// Scratch for the active components of one quantile solve (grown on demand; never read across calls).
const act: Active = {
  k: 0,
  w: new Float64Array(64),
  mu: new Float64Array(64),
  invSd: new Float64Array(64),
  wsum: 0,
  mean: 0,
  sd: 0,
  lo: 0,
  hi: 0,
};

function activate(m: Mixture): Active {
  if (act.w.length < m.count) {
    act.w = new Float64Array(m.count);
    act.mu = new Float64Array(m.count);
    act.invSd = new Float64Array(m.count);
  }
  let k = 0;
  let lo = Infinity;
  let hi = -Infinity;
  let mean = 0;
  let second = 0;
  let wsum = 0;
  for (let i = 0; i < m.count; i++) {
    const w = m.w[i] as number;
    if (!(w > 0)) continue;
    const mu = m.mu[i] as number;
    const sd = m.sd[i] as number;
    lo = Math.min(lo, mu - 9 * sd);
    hi = Math.max(hi, mu + 9 * sd);
    mean += w * mu;
    second += w * (mu * mu + sd * sd);
    wsum += w;
    act.w[k] = w;
    act.mu[k] = mu;
    act.invSd[k] = 1 / sd;
    k++;
  }
  act.k = k;
  act.wsum = wsum;
  act.mean = wsum > 0 ? mean / wsum : NaN;
  act.sd = wsum > 0 ? sqrt(Math.max(0, second / wsum - act.mean * act.mean)) : NaN;
  act.lo = lo;
  act.hi = hi;
  return act;
}

/**
 * Solves F(x) = q·wsum on the active components from `x0` inside [lo, hi]: Halley steps x − 2gf/(2f² − g·f′) with
 * F′ = Σ w φ(z)/s and F″ = −Σ w z φ(z)/s², falling back to bisection when a step leaves the bracket. Beyond
 * |z| = 8.5 a component's CDF is 0 or 1 and its density 0 to double precision, so it costs a comparison.
 */
function solve(a: Active, q: number, x0: number, lo0: number, hi0: number): number {
  let lo = lo0;
  let hi = hi0;
  let x = Math.min(hi, Math.max(lo, x0));
  const target = q * a.wsum;
  const k = a.k;
  const W = a.w;
  const MU = a.mu;
  const INV = a.invSd;
  for (let it = 0; it < MAX_ITER; it++) {
    let F = 0;
    let f = 0;
    let f1 = 0;
    for (let i = 0; i < k; i++) {
      const inv = INV[i] as number;
      const z = (x - (MU[i] as number)) * inv;
      if (z >= Z_FAR) {
        F += W[i] as number;
        continue;
      }
      if (z <= -Z_FAR) continue;
      // normal.ts's table, inline (stdNormCdfPdf).
      const uu = (z + Z_FAR) * STEPS;
      let ii = Math.floor(uu);
      if (ii >= INTERVALS) ii = INTERVALS - 1;
      const t = uu - ii;
      const c = 4 * ii;
      const cdf =
        (PHI[c] as number) + t * ((PHI[c + 1] as number) + t * ((PHI[c + 2] as number) + t * (PHI[c + 3] as number)));
      const pdf =
        (PDF[c] as number) + t * ((PDF[c + 1] as number) + t * ((PDF[c + 2] as number) + t * (PDF[c + 3] as number)));
      const w = W[i] as number;
      const d = w * pdf * inv;
      F += w * cdf;
      f += d;
      f1 -= d * z * inv;
    }
    const g = F - target;
    if (g < 0) lo = x;
    else hi = x;
    const den = 2 * f * f - g * f1;
    let next = f > 0 ? (den > 0 ? x - (2 * g * f) / den : x - g / f) : NaN;
    if (!(next > lo && next < hi)) next = 0.5 * (lo + hi);
    if (Math.abs(next - x) < X_TOL || hi - lo < X_TOL) return next;
    x = next;
  }
  return x;
}

/**
 * The q-quantile x of the mixture (log space). Components with zero weight are ignored. The solve starts from the
 * moment-matched normal's quantile, which is close for the unimodal mixtures the estimator builds.
 */
export function mixtureQuantile(m: Mixture, q: number): number {
  const a = activate(m);
  if (!(a.wsum > 0)) return NaN;
  const x0 = a.mean + (q > 0 && q < 1 ? normInv(q) : 0) * a.sd;
  return solve(a, q, x0, a.lo, a.hi);
}

/**
 * P10, P50 and P90 of the mixture with one pass over its components to set up: the median first, then the outer
 * quantiles inside [lo, P50] and [P50, hi], started one moment-matched 1.2816 sd out (every block and claim summary).
 */
export function mixtureQuantiles3(m: Mixture): { p10: number; p50: number; p90: number } {
  const a = activate(m);
  if (!(a.wsum > 0)) return { p10: NaN, p50: NaN, p90: NaN };
  const p50 = solve(a, 0.5, a.mean, a.lo, a.hi);
  const p10 = solve(a, 0.1, p50 + Z10 * a.sd, a.lo, p50);
  const p90 = solve(a, 0.9, p50 - Z10 * a.sd, p50, a.hi);
  return { p10, p50, p90 };
}

/** Mixture mean and standard deviation (moments of the normal mixture). */
export function mixtureMoments(m: Mixture): { mean: number; sd: number } {
  let wsum = 0;
  let m1 = 0;
  let m2 = 0;
  for (let i = 0; i < m.count; i++) {
    const w = m.w[i] as number;
    const mu = m.mu[i] as number;
    const sd = m.sd[i] as number;
    wsum += w;
    m1 += w * mu;
    m2 += w * (mu * mu + sd * sd);
  }
  const mean = m1 / wsum;
  return { mean, sd: sqrt(Math.max(0, m2 / wsum - mean * mean)) };
}
