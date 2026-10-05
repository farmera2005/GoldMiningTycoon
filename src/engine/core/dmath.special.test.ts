// erf, erfc, normCdf, normInv and lgamma have no Math.* counterpart, so they are checked against an independent
// reference: 320-bit BigInt fixed-point series (erf's positive series, the Laplace continued fraction for erfc tails,
// Stirling's series with exact Bernoulli numbers for lgamma). Targets (P0 brief): erf/erfc ≤ 1e-14, lgamma ≤ 1e-13
// relative on (0, 1e6], normCdf∘normInv round trip ≤ 1e-12.
import { describe, expect, it } from 'vitest';
import { erf, erfc, lgamma, normCdf, normInv } from './dmath';
import { rng } from './rng';

// ---------------------------------------------------------------------------------------------------------------------
// Fixed-point reference arithmetic: a bigint v stands for v / 2^F.
// ---------------------------------------------------------------------------------------------------------------------
const F = 320n;
const ONE = 1n << F;
const view = new DataView(new ArrayBuffer(8));

function fromDouble(x: number): bigint {
  if (x === 0) return 0n;
  view.setFloat64(0, Math.abs(x));
  const bits = view.getBigUint64(0);
  const e = Number((bits >> 52n) & 0x7ffn);
  const mant = e === 0 ? bits & 0xfffffffffffffn : (bits & 0xfffffffffffffn) | (1n << 52n);
  const shift = BigInt(Math.max(e, 1) - 1075) + F;
  const v = shift >= 0n ? mant << shift : mant >> -shift;
  if (shift < 0n && v << -shift !== mant) throw new Error(`fromDouble(${x}) not exact at ${F} bits`);
  return x < 0 ? -v : v;
}

function scale2(x: number, e: number): number {
  while (e > 1000) {
    x *= 2 ** 1000;
    e -= 1000;
  }
  while (e < -1000) {
    x *= 2 ** -1000;
    e += 1000;
  }
  return x * 2 ** e;
}

/** Correctly rounded v·2^(extraExp − F) (sticky bit avoids double rounding). */
function toDouble(v: bigint, extraExp = 0): number {
  if (v === 0n) return 0;
  const neg = v < 0n;
  let a = neg ? -v : v;
  const bits = a.toString(2).length;
  let e = extraExp - Number(F);
  if (bits > 64) {
    const sh = BigInt(bits - 64);
    const sticky = (a & ((1n << sh) - 1n)) !== 0n ? 1n : 0n;
    a = (a >> sh) | sticky;
    e += bits - 64;
  }
  const r = scale2(Number(a), e);
  return neg ? -r : r;
}

const mul = (a: bigint, b: bigint) => (a * b) >> F;
const div = (a: bigint, b: bigint) => (a << F) / b;

function isqrt(n: bigint): bigint {
  if (n < 2n) return n;
  // Newton from above: start at a power of two ≥ √n, then decrease monotonically to ⌊√n⌋.
  let x = 1n << BigInt(Math.ceil(n.toString(2).length / 2));
  for (;;) {
    const y = (x + n / x) >> 1n;
    if (y >= x) return x;
    x = y;
  }
}
const sqrtFixed = (a: bigint) => isqrt(a << F);

/** atanh(1/m)-style series helpers. */
function atanInv(m: bigint): bigint {
  let p = ONE / m;
  const m2 = m * m;
  let sum = 0n;
  for (let k = 0n; p !== 0n; k++) {
    const term = p / (2n * k + 1n);
    sum += k % 2n === 0n ? term : -term;
    p /= m2;
  }
  return sum;
}
const PI = 16n * atanInv(5n) - 4n * atanInv(239n);
const LN2 = (() => {
  let p = ONE / 3n;
  let sum = 0n;
  for (let k = 0n; p !== 0n; k++) {
    sum += p / (2n * k + 1n);
    p /= 9n;
  }
  return 2n * sum;
})();
const SQRT_PI = sqrtFixed(PI);

/** ln(a) for a > 0. */
function lnFixed(a: bigint): bigint {
  if (a <= 0n) throw new Error('ln of non-positive');
  const k = BigInt(a.toString(2).length - 1) - F;
  const m = k >= 0n ? a >> k : a << -k; // m ∈ [1, 2)
  const s = div(m - ONE, m + ONE);
  const s2 = mul(s, s);
  let p = s;
  let sum = 0n;
  for (let j = 0n; p !== 0n; j++) {
    sum += p / (2n * j + 1n);
    p = mul(p, s2);
  }
  return k * LN2 + 2n * sum;
}

/** e^(−a) for a ≥ 0 as [mantissa, binaryExponent]: e^(−a) = mantissa · 2^(−k) with mantissa ∈ (½, 1]. */
function expNegFixed(a: bigint): [bigint, number] {
  const k = a / LN2;
  const r = a - k * LN2; // [0, ln2)
  let term = ONE;
  let sum = ONE;
  for (let n = 1n; term !== 0n; n++) {
    term = mul(term, r) / n;
    sum += term;
  }
  return [div(ONE, sum), -Number(k)];
}

/** erf(x) for 0 ≤ x ≤ 6 (fixed): 2/√π · e^(−x²) · Σ 2^n x^(2n+1)/(2n+1)!!, all terms positive. */
function erfFixed(x: bigint): bigint {
  const x2 = mul(x, x);
  let term = x;
  let sum = x;
  for (let n = 0n; term !== 0n; n++) {
    term = mul(term, 2n * x2) / (2n * n + 3n);
    sum += term;
  }
  const [m, e] = expNegFixed(x2);
  const ex = e >= 0 ? m << BigInt(e) : m >> BigInt(-e);
  return div(2n * mul(ex, sum), SQRT_PI);
}

/** erfc(x) as a double, for a fixed-point x. */
function erfcRef(x: bigint): number {
  if (x <= 0n) return toDouble(ONE + erfFixed(-x));
  if (x < 3n * ONE) return toDouble(ONE - erfFixed(x));
  // Laplace continued fraction: erfc(x) = e^(−x²)/√π · 1/(x + (1/2)/(x + 1/(x + (3/2)/(x + …))))
  let t = 0n;
  for (let n = 400n; n >= 1n; n--) t = div((n * ONE) / 2n, x + t);
  const k = div(ONE, x + t);
  const [m, e] = expNegFixed(mul(x, x));
  return toDouble(div(mul(m, k), SQRT_PI), e);
}

const erfRef = (x: number): number => {
  const fx = fromDouble(Math.abs(x));
  const v = Math.abs(x) >= 6 ? 1 : toDouble(erfFixed(fx));
  return x < 0 ? -v : v;
};

const SQRT_HALF = sqrtFixed(ONE / 2n);
const normCdfRef = (x: number): number => erfcRef(-mul(fromDouble(x), SQRT_HALF)) / 2;

// Bernoulli numbers B2 … B20 as exact fractions [numerator, denominator].
const BERNOULLI: [bigint, bigint][] = [
  [1n, 6n],
  [-1n, 30n],
  [1n, 42n],
  [-1n, 30n],
  [5n, 66n],
  [-691n, 2730n],
  [7n, 6n],
  [-3617n, 510n],
  [43867n, 798n],
  [-174611n, 330n],
];
const HALF_LN_2PI = lnFixed(2n * PI) / 2n;

function lgammaRef(x: number): number {
  let z = fromDouble(x);
  let shift = 0n;
  while (z < 40n * ONE) {
    shift += lnFixed(z);
    z += ONE;
  }
  const lnz = lnFixed(z);
  let s = mul(z - ONE / 2n, lnz) - z + HALF_LN_2PI;
  const zInv = div(ONE, z);
  const zInv2 = mul(zInv, zInv);
  let zPow = zInv; // z^-(2k-1)
  BERNOULLI.forEach(([num, den], i) => {
    const k = BigInt(i + 1);
    s += (num * zPow) / (den * 2n * k * (2n * k - 1n));
    zPow = mul(zPow, zInv2);
  });
  return toDouble(s - shift);
}

// ---------------------------------------------------------------------------------------------------------------------

const g = rng('dmath-special', 'world', 'inputs');
const uni = (lo: number, hi: number, n: number) => Array.from({ length: n }, () => lo + (hi - lo) * g.next());
const logUni = (lo: number, hi: number, n: number) =>
  Array.from({ length: n }, () => Math.exp(Math.log(lo) + (Math.log(hi) - Math.log(lo)) * g.next()));
const relErr = (a: number, b: number) => (a === b ? 0 : Math.abs(a - b) / Math.abs(b));

describe('fixed-point reference self-check', () => {
  it('reproduces known constants and Math.log / Math.exp', () => {
    expect(toDouble(PI)).toBe(Math.PI);
    expect(toDouble(LN2)).toBe(Math.LN2);
    expect(toDouble(SQRT_HALF)).toBe(Math.SQRT1_2);
    for (const x of [0.001, 0.5, 1, 2, 10, 1234.5, 9.87e5])
      expect(relErr(toDouble(lnFixed(fromDouble(x))), Math.log(x))).toBeLessThan(3e-16);
    const [m, e] = expNegFixed(fromDouble(700));
    expect(relErr(toDouble(m, e), Math.exp(-700))).toBeLessThan(3e-16);
    expect(relErr(lgammaRef(10), Math.log(362880))).toBeLessThan(3e-16);
    expect(relErr(lgammaRef(0.5), Math.log(Math.sqrt(Math.PI)))).toBeLessThan(3e-16);
    // both erfc methods agree where they meet
    const at3 = fromDouble(3);
    expect(relErr(toDouble(ONE - erfFixed(at3)), erfcRef(at3))).toBeLessThan(1e-30 + 2e-16);
  });
});

describe('erf and erfc', () => {
  it('erf ≤ 1e-14 relative on [1e-8, 6] and its mirror', () => {
    const xs = [...logUni(1e-8, 6, 600), ...uni(0, 6, 600), 0.84375, 1.25, 2.857142857142857, 6, 1e-8];
    let worst = 0;
    for (const x of xs) {
      if (x === 0) continue;
      worst = Math.max(worst, relErr(erf(x), erfRef(x)), relErr(erf(-x), erfRef(-x)));
    }
    expect(worst).toBeLessThanOrEqual(1e-14);
  });

  it('erf for tiny |x| is 2x/√π', () => {
    for (const x of logUni(1e-300, 1e-9, 200)) {
      expect(relErr(erf(x), (2 / Math.sqrt(Math.PI)) * x)).toBeLessThanOrEqual(3e-16);
      expect(relErr(erf(-x), (-2 / Math.sqrt(Math.PI)) * x)).toBeLessThanOrEqual(3e-16);
    }
    expect(erf(0)).toBe(0);
    expect(Object.is(erf(-0), -0)).toBe(true);
    expect(erf(Infinity)).toBe(1);
    expect(erf(-Infinity)).toBe(-1);
    expect(erf(NaN)).toBeNaN();
  });

  it('erfc ≤ 1e-14 relative on [−6, 26.5] (deep upper tail included)', () => {
    const xs = [
      ...uni(-6, 3, 500),
      ...uni(3, 26.5, 400),
      ...logUni(1e-6, 2, 200),
      0.84375,
      1.25,
      2.857142857142857,
      26.5,
    ];
    let worst = 0;
    let at = 0;
    for (const x of xs) {
      const e = relErr(erfc(x), erfcRef(fromDouble(x)));
      if (e > worst) {
        worst = e;
        at = x;
      }
    }
    expect(worst, `worst at ${at}`).toBeLessThanOrEqual(1e-14);
    expect(erfc(28)).toBe(0);
    expect(erfc(-7)).toBe(2);
    expect(erfc(Infinity)).toBe(0);
    expect(erfc(-Infinity)).toBe(2);
    expect(erfc(NaN)).toBeNaN();
  });
});

describe('normCdf and normInv', () => {
  it('normCdf ≤ 1e-14 relative on [−37, 8]', () => {
    const xs = [...uni(-37, 8, 500), ...uni(-3, 3, 300), 0, -1, 1, -8.3, -20, -37];
    let worst = 0;
    let at = 0;
    for (const x of xs) {
      const e = relErr(normCdf(x), normCdfRef(x));
      if (e > worst) {
        worst = e;
        at = x;
      }
    }
    expect(worst, `worst at ${at}`).toBeLessThanOrEqual(1e-14);
    expect(normCdf(0)).toBe(0.5);
    expect(normCdf(-41)).toBe(0);
    expect(normCdf(41)).toBe(1);
    expect(normCdf(NaN)).toBeNaN();
  });

  it('round-trips through normCdf within 1e-12 on (1e-12, 1 − 1e-12)', () => {
    let worstLower = 0;
    for (const p of [...logUni(1e-12, 0.5, 3000), 0.5, 1e-12 * 1.0000001, 0.025, 0.3]) {
      worstLower = Math.max(worstLower, relErr(normCdf(normInv(p)), p));
    }
    expect(worstLower).toBeLessThanOrEqual(1e-12);
    let worstUpper = 0;
    for (const p of [...uni(0.5, 1 - 1e-12, 3000), 0.975, 0.995, 1 - 1e-12]) {
      worstUpper = Math.max(worstUpper, Math.abs(normCdf(normInv(p)) - p));
    }
    expect(worstUpper).toBeLessThanOrEqual(1e-15);
  });

  it('is accurate against the reference CDF: |Φ(x) − p| / φ(x) ≤ 1e-14·max(1, |x|)', () => {
    for (const p of [...logUni(1e-300, 0.5, 150), 0.1, 0.25, 0.4999]) {
      const x = normInv(p);
      const phi = Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
      const dx = (normCdfRef(x) - p) / phi;
      expect(Math.abs(dx), `p = ${p}`).toBeLessThanOrEqual(1e-14 * Math.max(1, Math.abs(x)));
    }
  });

  it('is exactly odd-symmetric and handles the endpoints', () => {
    for (const p of uni(0.5, 1, 500)) expect(normInv(p)).toBe(-normInv(1 - p));
    expect(normInv(0)).toBe(-Infinity);
    expect(normInv(1)).toBe(Infinity);
    expect(normInv(0.5)).toBe(0);
    for (const bad of [-0.1, 1.1, NaN]) expect(normInv(bad)).toBeNaN();
    expect(normInv(5e-324)).toBeGreaterThan(-38.5);
    expect(normInv(5e-324)).toBeLessThan(-38.4);
    expect(Math.abs(normInv(0.975) - 1.959963984540054)).toBeLessThanOrEqual(5e-16);
    expect(Math.abs(normInv(0.995) - 2.5758293035489004)).toBeLessThanOrEqual(5e-16);
  });
});

describe('lgamma', () => {
  it('≤ 1e-13 relative on (0, 1e6], including near its zeros at 1 and 2', () => {
    const xs = [
      ...logUni(1e-80, 1e6, 600),
      ...uni(0, 8, 400),
      ...[1, 2].flatMap((c) => [1e-12, 1e-9, 1e-6, 1e-3, 0.1].flatMap((h) => [c - h, c + h])),
      1.4616321449683622,
      0.5,
      3,
      7.99999,
      8,
      1e6,
    ];
    let worst = 0;
    let at = 0;
    for (const x of xs) {
      if (x === 1 || x === 2 || x <= 0) continue;
      const e = relErr(lgamma(x), lgammaRef(x));
      if (e > worst) {
        worst = e;
        at = x;
      }
    }
    expect(worst, `worst at ${at}`).toBeLessThanOrEqual(1e-13);
  });

  it('is exact at the zeros, −log x for tiny x, and rejects x ≤ 0', () => {
    expect(lgamma(1)).toBe(0);
    expect(lgamma(2)).toBe(0);
    for (const x of logUni(1e-300, 1e-25, 50)) expect(relErr(lgamma(x), -Math.log(x))).toBeLessThanOrEqual(3e-16);
    expect(lgamma(Infinity)).toBe(Infinity);
    for (const bad of [0, -0, -1, -2.5, NaN]) expect(() => lgamma(bad)).toThrow(RangeError);
    // log((n−1)!) from exact factorials
    let fact = 1n;
    for (let n = 2; n <= 170; n++) {
      fact *= BigInt(n - 1);
      const want = toDouble(lnFixed(fact << F));
      expect(relErr(lgamma(n), want), `lgamma(${n})`).toBeLessThanOrEqual(1e-14);
    }
  });
});
