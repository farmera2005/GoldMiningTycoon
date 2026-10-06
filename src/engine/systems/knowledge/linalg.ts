// Dense linear algebra for the estimator's Gaussian solves (DESIGN §4.5.2): Cholesky and triangular solves on
// row-major Float64Arrays. Only + − × ÷ and sqrt, so results are bit-identical in every engine (§2.3).
import { sqrt } from '../../core/dmath';

/** Diagonal floor that keeps a numerically semi-definite matrix factorizable (prototype rule). */
const PIVOT_FLOOR = 1e-12;

/** Lower Cholesky factor L of the n×n symmetric matrix A (row-major; only the lower triangle is read). */
export function cholesky(A: Float64Array, n: number): Float64Array {
  const L = new Float64Array(n * n);
  for (let i = 0; i < n; i++) {
    const ri = i * n;
    for (let j = 0; j <= i; j++) {
      const rj = j * n;
      let s = A[ri + j] as number;
      for (let k = 0; k < j; k++) s -= (L[ri + k] as number) * (L[rj + k] as number);
      if (i === j) L[ri + i] = sqrt(Math.max(s, PIVOT_FLOOR));
      else L[ri + j] = s / (L[rj + j] as number);
    }
  }
  return L;
}

/** Solves L x = b in place (x overwrites b). */
export function forwardSolveInPlace(L: Float64Array, n: number, b: Float64Array): void {
  for (let i = 0; i < n; i++) {
    const ri = i * n;
    let s = b[i] as number;
    for (let k = 0; k < i; k++) s -= (L[ri + k] as number) * (b[k] as number);
    b[i] = s / (L[ri + i] as number);
  }
}

/** Solves Lᵀ x = b in place. */
export function backSolveInPlace(L: Float64Array, n: number, b: Float64Array): void {
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i] as number;
    for (let k = i + 1; k < n; k++) s -= (L[k * n + i] as number) * (b[k] as number);
    b[i] = s / (L[i * n + i] as number);
  }
}

/** K⁻¹ from its Cholesky factor (n×n, symmetric). */
export function inverseFromCholesky(L: Float64Array, n: number): Float64Array {
  const inv = new Float64Array(n * n);
  const col = new Float64Array(n);
  for (let c = 0; c < n; c++) {
    col.fill(0);
    col[c] = 1;
    forwardSolveInPlace(L, n, col);
    backSolveInPlace(L, n, col);
    for (let r = 0; r < n; r++) inv[r * n + c] = col[r] as number;
  }
  // Symmetrize: the two triangles differ only by rounding.
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < r; c++) {
      const v = 0.5 * ((inv[r * n + c] as number) + (inv[c * n + r] as number));
      inv[r * n + c] = v;
      inv[c * n + r] = v;
    }
  }
  return inv;
}
