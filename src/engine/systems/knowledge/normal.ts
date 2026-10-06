// The standard normal CDF Φ and density φ for the estimator's mixture quantiles (DESIGN §4.5.5, §4.7; D-4.58).
// Block and claim quantiles evaluate Φ hundreds of thousands of times per estimate, and dmath's normCdf (erfc plus two
// exps, bit-exact in every engine) dominated the statistical layer's time (§2.13). Here Φ and φ are tabulated once
// from dmath at module load on z = −8.5 … 8.5 in steps of 1/128 and interpolated by cubic Hermite polynomials (Φ with
// φ as its slope; φ with −zφ). Building and evaluating use only + − × ÷ on dmath values, so results stay bit-identical
// in every engine. Interpolation error: |Φ| ≤ h⁴/384 · max|φ‴| ≈ 5.4e-12, |φ| ≤ h⁴/384 · max|φ⁗| ≈ 1.2e-11 (h = 1/128).
// Beyond |z| = 8.5, Φ is 0 or 1 and φ is 0 to double precision (Φ(−8.5) ≈ 9.5e-18).
import { exp, normCdf } from '../../core/dmath';

/** |z| beyond which Φ is 0 or 1 and φ is 0 (the table's half-range). */
export const NORMAL_Z_FAR = 8.5;
export const NORMAL_STEPS_PER_UNIT = 128;
const STEPS_PER_UNIT = NORMAL_STEPS_PER_UNIT;
const H = 1 / STEPS_PER_UNIT;
export const NORMAL_INTERVALS = 2 * NORMAL_Z_FAR * STEPS_PER_UNIT;
const INTERVALS = NORMAL_INTERVALS;
const INV_SQRT_2PI = 0.3989422804014327;

/**
 * Per interval i, the cubic in t ∈ [0, 1]: Φ ≈ c0 + c1 t + c2 t² + c3 t³ (and likewise for φ). Exported read-only for
 * the mixture quantile's inner loop, which evaluates them inline.
 */
export const PHI_C = new Float64Array(4 * INTERVALS);
export const PDF_C = new Float64Array(4 * INTERVALS);

(function buildTables(): void {
  const n = INTERVALS + 1;
  const z = new Float64Array(n);
  const cdf = new Float64Array(n);
  const pdf = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const zi = -NORMAL_Z_FAR + i * H;
    z[i] = zi;
    cdf[i] = normCdf(zi);
    pdf[i] = INV_SQRT_2PI * exp(-0.5 * zi * zi);
  }
  for (let i = 0; i < INTERVALS; i++) {
    hermite(PHI_C, i, cdf[i] as number, cdf[i + 1] as number, H * (pdf[i] as number), H * (pdf[i + 1] as number));
    const d0 = -(z[i] as number) * (pdf[i] as number);
    const d1 = -(z[i + 1] as number) * (pdf[i + 1] as number);
    hermite(PDF_C, i, pdf[i] as number, pdf[i + 1] as number, H * d0, H * d1);
  }
})();

/** Cubic Hermite coefficients for values y0, y1 and scaled slopes m0, m1 at t = 0 and t = 1. */
function hermite(out: Float64Array, i: number, y0: number, y1: number, m0: number, m1: number): void {
  const k = 4 * i;
  out[k] = y0;
  out[k + 1] = m0;
  out[k + 2] = 3 * (y1 - y0) - 2 * m0 - m1;
  out[k + 3] = 2 * (y0 - y1) + m0 + m1;
}

/** Φ(z) to ≈ 5.4e-12 (absolute). */
export function stdNormCdf(z: number): number {
  if (Number.isNaN(z)) return NaN;
  if (z <= -NORMAL_Z_FAR) return 0;
  if (z >= NORMAL_Z_FAR) return 1;
  const u = (z + NORMAL_Z_FAR) * STEPS_PER_UNIT;
  let i = Math.floor(u);
  if (i >= INTERVALS) i = INTERVALS - 1;
  const t = u - i;
  const k = 4 * i;
  return (
    (PHI_C[k] as number) +
    t * ((PHI_C[k + 1] as number) + t * ((PHI_C[k + 2] as number) + t * (PHI_C[k + 3] as number)))
  );
}

/** φ(z) to ≈ 1.2e-11 (absolute). */
export function stdNormPdf(z: number): number {
  if (Number.isNaN(z)) return NaN;
  if (z <= -NORMAL_Z_FAR || z >= NORMAL_Z_FAR) return 0;
  const u = (z + NORMAL_Z_FAR) * STEPS_PER_UNIT;
  let i = Math.floor(u);
  if (i >= INTERVALS) i = INTERVALS - 1;
  const t = u - i;
  const k = 4 * i;
  return (
    (PDF_C[k] as number) +
    t * ((PDF_C[k + 1] as number) + t * ((PDF_C[k + 2] as number) + t * (PDF_C[k + 3] as number)))
  );
}

/**
 * Φ(z) and φ(z) together (one table lookup), written into out[0] and out[1]. The mixture quantile's Newton step needs
 * both at every component.
 */
export function stdNormCdfPdf(z: number, out: Float64Array): void {
  if (z <= -NORMAL_Z_FAR) {
    out[0] = 0;
    out[1] = 0;
    return;
  }
  if (z >= NORMAL_Z_FAR) {
    out[0] = 1;
    out[1] = 0;
    return;
  }
  const u = (z + NORMAL_Z_FAR) * STEPS_PER_UNIT;
  let i = Math.floor(u);
  if (i >= INTERVALS) i = INTERVALS - 1;
  const t = u - i;
  const k = 4 * i;
  out[0] =
    (PHI_C[k] as number) +
    t * ((PHI_C[k + 1] as number) + t * ((PHI_C[k + 2] as number) + t * (PHI_C[k + 3] as number)));
  out[1] =
    (PDF_C[k] as number) +
    t * ((PDF_C[k + 1] as number) + t * ((PDF_C[k + 2] as number) + t * (PDF_C[k + 3] as number)));
}
