// Quantiles of a weighted mixture of normals (in log space), DESIGN §4.5.5 and §4.7: the CDF is monotone and smooth,
// so a Newton step safeguarded by a shrinking bracket converges in a handful of evaluations; a fixed tolerance and
// iteration cap keep the result a pure function of the inputs (bisection would need 60 CDF evaluations).
import { exp, normCdf, sqrt } from '../../core/dmath';

const INV_SQRT_2PI = 0.3989422804014327;
const MAX_ITER = 100;
const X_TOL = 1e-10;

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

/** The q-quantile x of the mixture (log space). Components with zero weight are ignored. */
export function mixtureQuantile(m: Mixture, q: number): number {
  let lo = Infinity;
  let hi = -Infinity;
  let mean = 0;
  let wsum = 0;
  for (let i = 0; i < m.count; i++) {
    const w = m.w[i] as number;
    if (!(w > 0)) continue;
    const mu = m.mu[i] as number;
    const sd = m.sd[i] as number;
    lo = Math.min(lo, mu - 9 * sd);
    hi = Math.max(hi, mu + 9 * sd);
    mean += w * mu;
    wsum += w;
  }
  if (!(wsum > 0)) return NaN;
  let x = Math.min(hi, Math.max(lo, mean / wsum));
  for (let it = 0; it < MAX_ITER; it++) {
    let F = 0;
    let f = 0;
    for (let i = 0; i < m.count; i++) {
      const w = m.w[i] as number;
      if (!(w > 0)) continue;
      const sd = m.sd[i] as number;
      const z = (x - (m.mu[i] as number)) / sd;
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
