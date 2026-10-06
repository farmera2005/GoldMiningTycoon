// Special functions the coarse-factor Gamma–Poisson model needs (DESIGN §4.5.3: ψ, ψ₁ and ψ₁⁻¹). DESIGN §4.18 lists
// digamma and trigamma under engine/core/dmath; they live here until core gains them. Recurrence plus asymptotic
// series, built only from + − × ÷ and dmath.log, so every engine returns the same bits.
import { log, sqrt } from '../../core/dmath';

// Recurrence up to z ≥ 10, where the series below (through B₁₀) are accurate to ~1e-14.
const SHIFT = 10;

/** ψ(x), x > 0: ψ(x) = ψ(x + 1) − 1/x up to x ≥ 10, then ln x − 1/(2x) − Σ B_2k / (2k x^2k). */
export function digamma(x: number): number {
  if (!(x > 0)) return NaN;
  let r = 0;
  let z = x;
  while (z < SHIFT) {
    r -= 1 / z;
    z += 1;
  }
  const f = 1 / (z * z);
  return r + log(z) - 0.5 / z - f * (1 / 12 - f * (1 / 120 - f * (1 / 252 - f * (1 / 240 - f / 132))));
}

/** ψ₁(x), x > 0: ψ₁(x) = ψ₁(x + 1) + 1/x² up to x ≥ 10, then 1/x + 1/(2x²) + Σ B_2k / x^(2k+1). */
export function trigamma(x: number): number {
  if (!(x > 0)) return NaN;
  let r = 0;
  let z = x;
  while (z < SHIFT) {
    r += 1 / (z * z);
    z += 1;
  }
  const f = 1 / (z * z);
  return r + 1 / z + f / 2 + (1 / (z * z * z)) * (1 / 6 - f * (1 / 30 - f * (1 / 42 - f * (1 / 30 - (5 * f) / 66))));
}

/**
 * ψ₁⁻¹(v): the α with trigamma(α) = v (ψ₁ is strictly decreasing on (0, ∞)). Fixed 80-step geometric bisection on
 * [0.01, 1e6], so the result is a pure function of v.
 */
export function invTrigamma(v: number): number {
  let lo = 0.01;
  let hi = 1e6;
  for (let t = 0; t < 80; t++) {
    const mid = sqrt(lo * hi);
    if (trigamma(mid) > v) lo = mid;
    else hi = mid;
  }
  return sqrt(lo * hi);
}
