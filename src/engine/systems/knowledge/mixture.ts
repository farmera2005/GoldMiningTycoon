// Quantiles of a weighted mixture of normals (in log space), DESIGN §4.5.5 and §4.7: the CDF is monotone and smooth,
// so a Newton step safeguarded by a shrinking bracket converges in a handful of evaluations; a fixed tolerance and
// iteration cap keep the result a pure function of the inputs (bisection would need 60 CDF evaluations).
import { exp, normCdf, normInv, sqrt } from '../../core/dmath';

const INV_SQRT_2PI = 0.3989422804014327;
const MAX_ITER = 100;
const X_TOL = 1e-10;
/**
 * Beyond |z| = 8.5 a component's CDF is 0 or 1 to double precision (Φ(−8.5) ≈ 1e-17) and its density negligible, so
 * the quantile solve skips the special functions there (§2.13: block quantiles dominated the statistical layer).
 */
const Z_FAR = 8.5;

export interface Mixture {
  readonly count: number;
  readonly w: Float64Array;
  readonly mu: Float64Array;
  /** Component standard deviations (> 0). */
  readonly sd: Float64Array;
}

export function mixtureCdf(m: Mixture, x: number): number {
  let F = 0;
  for (let i = 0; i < m.count; i++) F += (m.w[i] as number) * normCdf((x - (m.mu[i] as number)) / (m.sd[i] as number));
  return F;
}

/**
 * The q-quantile x of the mixture (log space). Components with zero weight are ignored. Newton steps start from the
 * moment-matched normal's quantile, which is close for the unimodal mixtures the estimator builds.
 */
export function mixtureQuantile(m: Mixture, q: number): number {
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
  }
  if (!(wsum > 0)) return NaN;
  const mMean = mean / wsum;
  const mSd = sqrt(Math.max(0, second / wsum - mMean * mMean));
  let x = Math.min(hi, Math.max(lo, mMean + (q > 0 && q < 1 ? normInv(q) : 0) * mSd));
  for (let it = 0; it < MAX_ITER; it++) {
    let F = 0;
    let f = 0;
    for (let i = 0; i < m.count; i++) {
      const w = m.w[i] as number;
      if (!(w > 0)) continue;
      const sd = m.sd[i] as number;
      const z = (x - (m.mu[i] as number)) / sd;
      if (z > Z_FAR) {
        F += w;
        continue;
      }
      if (z < -Z_FAR) continue;
      F += w * normCdf(z);
      f += (w * INV_SQRT_2PI * exp(-0.5 * z * z)) / sd;
    }
    F /= wsum;
    f /= wsum;
    const g = F - q;
    if (g < 0) lo = x;
    else hi = x;
    let next = f > 0 ? x - g / f : NaN;
    if (!(next > lo && next < hi)) next = 0.5 * (lo + hi);
    if (Math.abs(next - x) < X_TOL || hi - lo < X_TOL) return next;
    x = next;
  }
  return x;
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
