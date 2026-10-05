// Deterministic transcendental math (DESIGN §2.3 item 2, D-2.3). ECMAScript leaves Math.exp/log/pow/sin/… implementation-
// approximated, so the last bit can differ between V8, SpiderMonkey and JavaScriptCore, and one ulp can flip a threshold
// and fork a replay. Everything here is built only from IEEE-754 + − × ÷ (exactly rounded in every engine),
// Math.sqrt (exactly rounded), Math.floor/ceil/round/abs/min/max, and reads/writes of a double's bit pattern through a
// big-endian DataView (byte order is explicit, so it is platform-independent).
//
// Algorithms are ports of fdlibm 5.3 / FreeBSD msun (Sun Microsystems, freely redistributable): range reduction plus
// minimax polynomials with the published coefficients, which are bit-exact (each is checked against its hex pattern in
// dmath.test.ts). pow is a double-double log followed by exp; normInv is Wichura's AS241 polished by one Halley step
// against normCdf. Accuracy (verified in the tests): exp, expm1, log, log1p, sin, cos, atan ≤ 1 ulp typical, ≤ 2 ulp
// bound; pow ≤ 1e-14 relative; erf/erfc ≤ 1e-14; lgamma ≤ 1e-13 relative on (0, 1e6]; normCdf∘normInv round trip ≤ 1e-12.
//
// Changing any line here changes game outcomes: dmath.golden.test.ts pins ~200 exact outputs.

// ---------------------------------------------------------------------------------------------------------------------
// Bit access
// ---------------------------------------------------------------------------------------------------------------------

const scratch = new DataView(new ArrayBuffer(8));

/** High 32 bits of a double's IEEE pattern (sign, exponent, top 20 mantissa bits), as a signed int32. */
function hiWord(x: number): number {
  scratch.setFloat64(0, x);
  return scratch.getInt32(0);
}

/** Low 32 bits of a double's IEEE pattern, unsigned. */
function loWord(x: number): number {
  scratch.setFloat64(0, x);
  return scratch.getUint32(4);
}

function withHiWord(x: number, hi: number): number {
  scratch.setFloat64(0, x);
  scratch.setUint32(0, hi >>> 0);
  return scratch.getFloat64(0);
}

function withLoWord(x: number, lo: number): number {
  scratch.setFloat64(0, x);
  scratch.setUint32(4, lo >>> 0);
  return scratch.getFloat64(0);
}

// ---------------------------------------------------------------------------------------------------------------------
// Shared constants
// ---------------------------------------------------------------------------------------------------------------------

const LN2_HI = 6.9314718036912381649e-1; // 0x3FE62E42 FEE00000 (k·LN2_HI exact for |k| < 2^11)
const LN2_LO = 1.90821492927058770002e-10; // 0x3DEA39EF 35793C76
const INVLN2 = 1.442695040888963387; // 0x3FF71547 652B82FE
const TWO54 = 1.8014398509481984e16; // 0x43500000 00000000
const TWOM1000 = 9.3326361850321887899e-302; // 0x01700000 00000000
const O_THRESHOLD = 7.09782712893383973096e2; // 0x40862E42 FEFA39EF
const U_THRESHOLD = -7.4513321910194110842e2; // 0xC0874910 D52D3051

/** sqrt is exactly rounded by IEEE 754, hence deterministic; re-exported so engine code imports all math from here. */
export const sqrt: (x: number) => number = Math.sqrt;

// ---------------------------------------------------------------------------------------------------------------------
// exp (fdlibm e_exp.c)
// ---------------------------------------------------------------------------------------------------------------------

const P1 = 1.66666666666666019037e-1; // 0x3FC55555 5555553E
const P2 = -2.77777777770155933842e-3; // 0xBF66C16C 16BEBD93
const P3 = 6.61375632143793436117e-5; // 0x3F11566A AF25DE2C
const P4 = -1.6533902205465251539e-6; // 0xBEBBBD41 C5D26BF1
const P5 = 4.13813679705723846039e-8; // 0x3E663769 72BEA4D0

/** e^x. Reduce x = k·ln2 + r with |r| ≤ ln2/2, approximate e^r by a Remez rational form, then scale by 2^k. */
export function exp(x: number): number {
  // fdlibm's exp(1) is one ulp above e; return the correctly rounded constant so exp(1) === Math.E in every engine.
  if (x === 1) return 2.718281828459045;
  let hx = hiWord(x);
  const xsb = (hx >>> 31) & 1;
  hx &= 0x7fffffff;
  let hi = 0;
  let lo = 0;
  let k = 0;

  if (hx >= 0x40862e42) {
    // |x| ≥ 709.78…
    if (hx >= 0x7ff00000) {
      if (((hx & 0xfffff) | loWord(x)) !== 0) return x + x; // NaN
      return xsb === 0 ? x : 0; // exp(+∞) = +∞, exp(−∞) = 0
    }
    if (x > O_THRESHOLD) return Infinity;
    if (x < U_THRESHOLD) return 0;
  }

  if (hx > 0x3fd62e42) {
    // |x| > ln2/2
    if (hx < 0x3ff0a2b2) {
      // and |x| < 1.5·ln2
      if (xsb === 0) {
        hi = x - LN2_HI;
        lo = LN2_LO;
        k = 1;
      } else {
        hi = x + LN2_HI;
        lo = -LN2_LO;
        k = -1;
      }
    } else {
      k = (INVLN2 * x + (xsb === 0 ? 0.5 : -0.5)) | 0;
      hi = x - k * LN2_HI;
      lo = k * LN2_LO;
    }
    x = hi - lo;
  } else if (hx < 0x3e300000) {
    // |x| < 2^-28
    return 1 + x;
  }

  const t = x * x;
  const c = x - t * (P1 + t * (P2 + t * (P3 + t * (P4 + t * P5))));
  if (k === 0) return 1 - ((x * c) / (c - 2.0) - x);
  const y = 1 - (lo - (x * c) / (2.0 - c) - hi);
  if (k >= -1021) return withHiWord(y, hiWord(y) + (k << 20));
  return withHiWord(y, hiWord(y) + ((k + 1000) << 20)) * TWOM1000;
}

// ---------------------------------------------------------------------------------------------------------------------
// expm1 (fdlibm s_expm1.c)
// ---------------------------------------------------------------------------------------------------------------------

const Q1 = -3.33333333333331316428e-2; // 0xBFA11111 111110F4
const Q2 = 1.58730158725481460165e-3; // 0x3F5A01A0 19FE5585
const Q3 = -7.93650757867487942473e-5; // 0xBF14CE19 9EAADBB7
const Q4 = 4.00821782732936239552e-6; // 0x3ED0CFCA 86E65239
const Q5 = -2.01099218183624371326e-7; // 0xBE8AFDB7 6E09C32D

/** e^x − 1, accurate for small |x| where exp(x) − 1 would cancel. */
export function expm1(x: number): number {
  let hx = hiWord(x);
  const xsb = hx & 0x80000000;
  hx &= 0x7fffffff;
  let hi: number;
  let lo: number;
  let k: number;
  let c = 0;

  if (hx >= 0x4043687a) {
    // |x| ≥ 56·ln2
    if (hx >= 0x40862e42) {
      if (hx >= 0x7ff00000) {
        if (((hx & 0xfffff) | loWord(x)) !== 0) return x + x; // NaN
        return xsb === 0 ? x : -1;
      }
      if (x > O_THRESHOLD) return Infinity;
    }
    if (xsb !== 0) return -1; // x < −56·ln2
  }

  if (hx > 0x3fd62e42) {
    // |x| > ln2/2
    if (hx < 0x3ff0a2b2) {
      if (xsb === 0) {
        hi = x - LN2_HI;
        lo = LN2_LO;
        k = 1;
      } else {
        hi = x + LN2_HI;
        lo = -LN2_LO;
        k = -1;
      }
    } else {
      k = (INVLN2 * x + (xsb === 0 ? 0.5 : -0.5)) | 0;
      hi = x - k * LN2_HI;
      lo = k * LN2_LO;
    }
    x = hi - lo;
    c = hi - x - lo;
  } else if (hx < 0x3c900000) {
    // |x| < 2^-54
    return x;
  } else {
    k = 0;
  }

  const hfx = 0.5 * x;
  const hxs = x * hfx;
  const r1 = 1 + hxs * (Q1 + hxs * (Q2 + hxs * (Q3 + hxs * (Q4 + hxs * Q5))));
  const t = 3.0 - r1 * hfx;
  let e = hxs * ((r1 - t) / (6.0 - x * t));
  if (k === 0) return x - (x * e - hxs);
  e = x * (e - c) - c;
  e -= hxs;
  if (k === -1) return 0.5 * (x - e) - 0.5;
  if (k === 1) {
    if (x < -0.25) return -2.0 * (e - (x + 0.5));
    return 1 + 2.0 * (x - e);
  }
  if (k <= -2 || k > 56) {
    let y = 1 - (e - x);
    y = withHiWord(y, hiWord(y) + (k << 20));
    return y - 1;
  }
  let y: number;
  if (k < 20) {
    const tk = withHiWord(0, 0x3ff00000 - (0x200000 >> k)); // 1 − 2^-k
    y = tk - (e - x);
  } else {
    const tk = withHiWord(0, (0x3ff - k) << 20); // 2^-k
    y = x - (e + tk);
    y += 1;
  }
  return withHiWord(y, hiWord(y) + (k << 20));
}

// ---------------------------------------------------------------------------------------------------------------------
// log (fdlibm e_log.c)
// ---------------------------------------------------------------------------------------------------------------------

const LG1 = 6.66666666666673513e-1; // 0x3FE55555 55555593
const LG2 = 3.999999999940941908e-1; // 0x3FD99999 9997FA04
const LG3 = 2.857142874366239149e-1; // 0x3FD24924 94229359
const LG4 = 2.222219843214978396e-1; // 0x3FCC71C5 1D8E78AF
const LG5 = 1.818357216161805012e-1; // 0x3FC74664 96CB03DE
const LG6 = 1.531383769920937332e-1; // 0x3FC39A09 D078C69F
const LG7 = 1.479819860511658591e-1; // 0x3FC2F112 DF3E5244

/** Natural logarithm. x = 2^k·(1+f) with √2/2 < 1+f < √2; log(1+f) = 2s + 2s³/3 + … with s = f/(2+f). */
export function log(x: number): number {
  let hx = hiWord(x);
  const lx = loWord(x);
  let k = 0;
  if (hx < 0x00100000) {
    // x < 2^-1022
    if (((hx & 0x7fffffff) | lx) === 0) return -Infinity; // log(±0)
    if (hx < 0) return NaN; // log(negative)
    k -= 54;
    x *= TWO54; // scale up a subnormal
    hx = hiWord(x);
  }
  if (hx >= 0x7ff00000) return x + x;
  k += (hx >> 20) - 1023;
  hx &= 0x000fffff;
  const i = (hx + 0x95f64) & 0x100000;
  x = withHiWord(x, hx | (i ^ 0x3ff00000)); // normalize x or x/2
  k += i >> 20;
  const f = x - 1.0;
  if ((0x000fffff & (2 + hx)) < 3) {
    // |f| < 2^-20
    if (f === 0) {
      if (k === 0) return 0;
      return k * LN2_HI + k * LN2_LO;
    }
    const R = f * f * (0.5 - 0.3333333333333333 * f);
    if (k === 0) return f - R;
    return k * LN2_HI - (R - k * LN2_LO - f);
  }
  const s = f / (2.0 + f);
  const z = s * s;
  let ii = hx - 0x6147a;
  const w = z * z;
  const j = 0x6b851 - hx;
  const t1 = w * (LG2 + w * (LG4 + w * LG6));
  const t2 = z * (LG1 + w * (LG3 + w * (LG5 + w * LG7)));
  ii |= j;
  const R = t2 + t1;
  if (ii > 0) {
    const hfsq = 0.5 * f * f;
    if (k === 0) return f - (hfsq - s * (hfsq + R));
    return k * LN2_HI - (hfsq - (s * (hfsq + R) + k * LN2_LO) - f);
  }
  if (k === 0) return f - s * (f - R);
  return k * LN2_HI - (s * (f - R) - k * LN2_LO - f);
}

// ---------------------------------------------------------------------------------------------------------------------
// log1p (fdlibm s_log1p.c)
// ---------------------------------------------------------------------------------------------------------------------

/** log(1 + x), accurate for small |x|. */
export function log1p(x: number): number {
  const hx = hiWord(x);
  const ax = hx & 0x7fffffff;
  let k = 1;
  let f = 0;
  let c = 0;
  let hu = 0;

  if (hx < 0x3fda827a) {
    // x < 0.41422
    if (ax >= 0x3ff00000) {
      // x ≤ −1
      if (x === -1) return -Infinity;
      return NaN;
    }
    if (ax < 0x3e200000) {
      // |x| < 2^-29
      if (ax < 0x3c900000) return x; // |x| < 2^-54
      return x - x * x * 0.5;
    }
    if (hx > 0 || hx <= (0xbfd2bec3 | 0)) {
      // −0.2929 < x < 0.41422
      k = 0;
      f = x;
      hu = 1;
    }
  }
  if (hx >= 0x7ff00000) return x + x;
  if (k !== 0) {
    let u: number;
    if (hx < 0x43400000) {
      u = 1.0 + x;
      hu = hiWord(u);
      k = (hu >> 20) - 1023;
      c = k > 0 ? 1.0 - (u - x) : x - (u - 1.0); // correction term
      c /= u;
    } else {
      u = x;
      hu = hiWord(u);
      k = (hu >> 20) - 1023;
      c = 0;
    }
    hu &= 0x000fffff;
    if (hu < 0x6a09e) {
      u = withHiWord(u, hu | 0x3ff00000); // normalize u
    } else {
      k += 1;
      u = withHiWord(u, hu | 0x3fe00000); // normalize u/2
      hu = (0x00100000 - hu) >> 2;
    }
    f = u - 1.0;
  }
  const hfsq = 0.5 * f * f;
  if (hu === 0) {
    // |f| < 2^-20
    if (f === 0) {
      if (k === 0) return 0;
      c += k * LN2_LO;
      return k * LN2_HI + c;
    }
    const R = hfsq * (1.0 - 0.6666666666666666 * f);
    if (k === 0) return f - R;
    return k * LN2_HI - (R - (k * LN2_LO + c) - f);
  }
  const s = f / (2.0 + f);
  const z = s * s;
  const R = z * (LG1 + z * (LG2 + z * (LG3 + z * (LG4 + z * (LG5 + z * (LG6 + z * LG7))))));
  if (k === 0) return f - (hfsq - s * (hfsq + R));
  return k * LN2_HI - (hfsq - (s * (hfsq + R) + (k * LN2_LO + c)) - f);
}

// ---------------------------------------------------------------------------------------------------------------------
// Error-free transformations (double-double helpers)
// ---------------------------------------------------------------------------------------------------------------------

const SPLITTER = 134217729; // 2^27 + 1 (Dekker/Veltkamp split)

/** The rounding error of p = fl(a·b): a·b = p + err exactly (Dekker), valid while |a|, |b| < 2^996. */
function twoProdErr(a: number, b: number, p: number): number {
  let t = SPLITTER * a;
  const ah = t - (t - a);
  const al = a - ah;
  t = SPLITTER * b;
  const bh = t - (t - b);
  const bl = b - bh;
  return ah * bh - p + ah * bl + al * bh + al * bl;
}

// ---------------------------------------------------------------------------------------------------------------------
// pow: |x|^y = exp(y · log|x|) with log|x| in double-double, so the product's rounding error stays ≤ ~2^-60 relative
// even when |y · log x| is near 709; the final exp contributes ≤ 1 ulp.
// ---------------------------------------------------------------------------------------------------------------------

const LN2_DD_HI = 0.6931471805599453; // nearest double to ln 2 (0x3FE62E42 FEFA39EF)
const LN2_DD_LO = 2.3190468138462996e-17; // ln 2 − LN2_DD_HI
const SQRT2 = 1.4142135623730951;

// 1/(2n+1) for n = 13 … 1: atanh series coefficients, Horner order.
const ATANH_COEFFS = [
  1 / 27,
  1 / 25,
  1 / 23,
  1 / 21,
  1 / 19,
  1 / 17,
  1 / 15,
  1 / 13,
  1 / 11,
  1 / 9,
  1 / 7,
  1 / 5,
  1 / 3,
];

// Results of logDD (module scratch: one synchronous call at a time).
let ddHi = 0;
let ddLo = 0;

/** ln(ax) for finite ax > 0 as ddHi + ddLo (relative error ~2^-100 + 2^-60 from the series in double). */
function logDD(ax: number): void {
  let m = ax;
  let k = 0;
  let hx = hiWord(m);
  if (hx < 0x00100000) {
    m *= TWO54;
    k = -54;
    hx = hiWord(m);
  }
  k += (hx >> 20) - 1023;
  m = withHiWord(m, (hx & 0x000fffff) | 0x3ff00000); // m ∈ [1, 2)
  if (m > SQRT2) {
    m *= 0.5;
    k += 1;
  }
  // s = (m − 1)/(m + 1) as a double-double; m − 1 is exact (Sterbenz).
  const num = m - 1;
  const denH = m + 1;
  const bb = denH - m;
  const denL = m - (denH - bb) + (1 - bb);
  const sH = num / denH;
  const p = sH * denH;
  const rem = num - p - twoProdErr(sH, denH, p) - sH * denL;
  const sL = rem / denH;
  // ln m = 2·atanh(s) = 2s + 2s·(s²/3 + s⁴/5 + …)
  const z = sH * sH;
  let poly = ATANH_COEFFS[0] as number;
  for (let i = 1; i < ATANH_COEFFS.length; i++) poly = poly * z + (ATANH_COEFFS[i] as number);
  const R = z * poly;
  const hi = 2 * sH;
  const lo = 2 * sL + 2 * sH * R;
  let lnH = hi + lo;
  let lnL = lo - (lnH - hi);
  if (k !== 0) {
    const a = k * LN2_DD_HI;
    const ae = twoProdErr(k, LN2_DD_HI, a);
    const s = a + lnH;
    const sb = s - a;
    const se = a - (s - sb) + (lnH - sb);
    const tail = se + ae + k * LN2_DD_LO + lnL;
    lnH = s + tail;
    lnL = tail - (lnH - s);
  }
  ddHi = lnH;
  ddLo = lnL;
}

function isOddInteger(y: number): boolean {
  return Number.isInteger(y) && Math.abs(y) < 9007199254740992 && y % 2 !== 0;
}

/** x^y with ECMAScript `**` semantics for every special case (NaN, ±0, ±∞, negative bases). */
export function pow(x: number, y: number): number {
  if (Number.isNaN(y)) return NaN;
  if (y === 0) return 1;
  if (Number.isNaN(x)) return NaN;
  const ax = Math.abs(x);
  if (y === Infinity) return ax > 1 ? Infinity : ax === 1 ? NaN : 0;
  if (y === -Infinity) return ax > 1 ? 0 : ax === 1 ? NaN : Infinity;
  const oddY = isOddInteger(y);
  if (x === Infinity) return y > 0 ? Infinity : 0;
  if (x === -Infinity) {
    if (y > 0) return oddY ? -Infinity : Infinity;
    return oddY ? -0 : 0;
  }
  if (x === 0) {
    const negZero = Object.is(x, -0);
    if (y > 0) return negZero && oddY ? -0 : 0;
    return negZero && oddY ? -Infinity : Infinity;
  }
  if (x < 0 && !Number.isInteger(y)) return NaN;
  if (y === 1) return x;
  if (y === 2) return x * x;
  if (y === -1) return 1 / x;
  if (y === 0.5 && x > 0) return Math.sqrt(x);
  const mag = powPositive(ax, y);
  return x < 0 && oddY ? -mag : mag;
}

function powPositive(ax: number, y: number): number {
  if (ax === 1) return 1;
  logDD(ax);
  const ph = y * ddHi;
  if (ph > 709.79) return Infinity;
  if (ph < -745.2) return 0;
  const pe = twoProdErr(y, ddHi, ph) + y * ddLo;
  const s = ph + pe;
  const t = pe - (s - ph);
  const e = exp(s);
  return e + e * t; // e^(s+t) = e^s·(1 + t + …), |t| < 2^-44
}

// ---------------------------------------------------------------------------------------------------------------------
// Trigonometry (fdlibm k_sin.c, k_cos.c, k_tan.c as revised in FreeBSD msun; e_rem_pio2.c without Payne–Hanek)
// ---------------------------------------------------------------------------------------------------------------------

const S1 = -1.66666666666666324348e-1; // 0xBFC55555 55555549
const S2 = 8.33333333332248946124e-3; // 0x3F811111 1110F8A6
const S3 = -1.98412698298579493134e-4; // 0xBF2A01A0 19C161D5
const S4 = 2.75573137070700676789e-6; // 0x3EC71DE3 57B1FE7D
const S5 = -2.50507602534068634195e-8; // 0xBE5AE5E6 8A2B9CEB
const S6 = 1.58969099521155010221e-10; // 0x3DE5D93A 5ACFD57C

/** sin(x + y) on |x| ≤ π/4, y the tail of x; iy = 0 means y is zero. */
function kernelSin(x: number, y: number, iy: number): number {
  const z = x * x;
  const w = z * z;
  const r = S2 + z * (S3 + z * S4) + z * w * (S5 + z * S6);
  const v = z * x;
  if (iy === 0) return x + v * (S1 + z * r);
  return x - (z * (0.5 * y - v * r) - y - v * S1);
}

const C1 = 4.16666666666666019037e-2; // 0x3FA55555 5555554C
const C2 = -1.38888888888741095749e-3; // 0xBF56C16C 16C15177
const C3 = 2.48015872894767294178e-5; // 0x3EFA01A0 19CB1590
const C4 = -2.75573143513906633035e-7; // 0xBE927E4F 809C52AD
const C5 = 2.0875723212981748279e-9; // 0x3E21EE9E BDB4B1C4
const C6 = -1.13596475577881948265e-11; // 0xBDA8FAE9 BE8838D4

/** cos(x + y) on |x| ≤ π/4. */
function kernelCos(x: number, y: number): number {
  const z = x * x;
  let w = z * z;
  const r = z * (C1 + z * (C2 + z * C3)) + w * w * (C4 + z * (C5 + z * C6));
  const hz = 0.5 * z;
  w = 1.0 - hz;
  return w + (1.0 - w - hz + (z * r - x * y));
}

const T = [
  3.33333333333334091986e-1, // 0x3FD55555 55555563
  1.33333333333201242699e-1, // 0x3FC11111 1110FE7A
  5.39682539762260521377e-2, // 0x3FABA1BA 1BB341FE
  2.18694882948595424599e-2, // 0x3F9664F4 8406D637
  8.86323982359930005737e-3, // 0x3F8226E3 E96E8493
  3.59207910759131235356e-3, // 0x3F6D6D22 C9560328
  1.45620945432529025516e-3, // 0x3F57DBC8 FEE08315
  5.88041240820264096874e-4, // 0x3F4344D8 F2F26501
  2.46463134818469906812e-4, // 0x3F3026F7 1A8D1068
  7.817944429395570923e-5, // 0x3F147E88 A03792A6
  7.14072491382608190305e-5, // 0x3F12B80F 32F0A7E9
  -1.85586374855275456654e-5, // 0xBEF375CB DB605373
  2.59073051863633712884e-5, // 0x3EFB2A70 74BF7AD4
] as const;
const PIO4 = 7.85398163397448278999e-1; // 0x3FE921FB 54442D18
const PIO4LO = 3.06161699786838301793e-17; // 0x3C81A626 33145C07

/** tan(x + y) on |x| ≤ π/4 when iy = 1, −1/tan(x + y) when iy = −1. */
function kernelTan(x: number, y: number, iy: number): number {
  const hx = hiWord(x);
  const ix = hx & 0x7fffffff;
  const big = ix >= 0x3fe59428; // |x| ≥ 0.6744
  if (big) {
    if (hx < 0) {
      x = -x;
      y = -y;
    }
    const z0 = PIO4 - x;
    const w0 = PIO4LO - y;
    x = z0 + w0;
    y = 0.0;
  }
  const z = x * x;
  let w = z * z;
  let r = T[1] + w * (T[3] + w * (T[5] + w * (T[7] + w * (T[9] + w * T[11]))));
  let v = z * (T[2] + w * (T[4] + w * (T[6] + w * (T[8] + w * (T[10] + w * T[12])))));
  let s = z * x;
  r = y + z * (s * (r + v) + y);
  r += T[0] * s;
  w = x + r;
  if (big) {
    v = iy;
    return (1 - ((hx >> 30) & 2)) * (v - 2.0 * (x - ((w * w) / (w + v) - r)));
  }
  if (iy === 1) return w;
  // −1/(x + r) computed accurately
  const zz = withLoWord(w, 0);
  v = r - (zz - x); // zz + v = r + x
  const a = -1.0 / w;
  const t = withLoWord(a, 0);
  s = 1.0 + t * zz;
  return t + a * (s + t * v);
}

const INVPIO2 = 6.36619772367581382433e-1; // 0x3FE45F30 6DC9C883
const PIO2_1 = 1.57079632673412561417; // 0x3FF921FB 54400000: first 33 bits of π/2
const PIO2_1T = 6.07710050650619224932e-11; // 0x3DD0B461 1A626331: π/2 − PIO2_1
const PIO2_2 = 6.0771005063039659766e-11; // 0x3DD0B461 1A600000: second 33 bits
const PIO2_2T = 2.02226624879595063154e-21; // 0x3BA3198A 2E037073
const PIO2_3 = 2.0222662487111664558e-21; // 0x3BA3198A 2E000000: third 33 bits
const PIO2_3T = 8.47842766036889956997e-32; // 0x397B839A 252049C1

const TRIG_MAX_HI = 0x413921fb;
/**
 * Largest |x| accepted by sin/cos/tan (≈ 1,647,100 ≈ 2^20·π/2: every double whose high word is ≤ 0x413921FB). This is
 * fdlibm's medium range, where n < 2^20 keeps n·PIO2_1 exact and the 3-part Cody–Waite reduction covers every double.
 * Game math never needs more, so the Payne–Hanek path for huge arguments is omitted.
 */
export const TRIG_MAX_ABS: number = withLoWord(withHiWord(0, TRIG_MAX_HI), 0xffffffff);

// Results of remPio2 (module scratch: one synchronous call at a time).
let remY0 = 0;
let remY1 = 0;

/** x = n·π/2 + (remY0 + remY1), |remY0| ≤ π/4, for π/4 < |x| ≤ TRIG_MAX_ABS. Returns n. */
function remPio2(x: number): number {
  const hx = hiWord(x);
  const ix = hx & 0x7fffffff;
  if (ix < 0x4002d97c) {
    // |x| < 3π/4: n = ±1
    if (hx > 0) {
      let z = x - PIO2_1;
      if (ix !== 0x3ff921fb) {
        remY0 = z - PIO2_1T;
        remY1 = z - remY0 - PIO2_1T;
      } else {
        // near π/2: 33 + 33 bits of π/2
        z -= PIO2_2;
        remY0 = z - PIO2_2T;
        remY1 = z - remY0 - PIO2_2T;
      }
      return 1;
    }
    let z = x + PIO2_1;
    if (ix !== 0x3ff921fb) {
      remY0 = z + PIO2_1T;
      remY1 = z - remY0 + PIO2_1T;
    } else {
      z += PIO2_2;
      remY0 = z + PIO2_2T;
      remY1 = z - remY0 + PIO2_2T;
    }
    return -1;
  }
  const t = Math.abs(x);
  const n = (t * INVPIO2 + 0.5) | 0;
  const fn = n;
  let r = t - fn * PIO2_1;
  let w = fn * PIO2_1T; // first round, good to 85 bits
  const j = ix >> 20;
  let y0 = r - w;
  let i = j - ((hiWord(y0) >> 20) & 0x7ff);
  if (i > 16) {
    // second round, good to 118 bits
    let tt = r;
    w = fn * PIO2_2;
    r = tt - w;
    w = fn * PIO2_2T - (tt - r - w);
    y0 = r - w;
    i = j - ((hiWord(y0) >> 20) & 0x7ff);
    if (i > 49) {
      // third round, good to 151 bits: covers every double in range
      tt = r;
      w = fn * PIO2_3;
      r = tt - w;
      w = fn * PIO2_3T - (tt - r - w);
      y0 = r - w;
    }
  }
  const y1 = r - y0 - w;
  if (hx < 0) {
    remY0 = -y0;
    remY1 = -y1;
    return -n;
  }
  remY0 = y0;
  remY1 = y1;
  return n;
}

function checkTrigDomain(name: string, x: number, ix: number): void {
  if (ix > TRIG_MAX_HI && ix < 0x7ff00000) {
    throw new RangeError(`dmath.${name}: |x| must be ≤ ${TRIG_MAX_ABS} (2^20·π/2), got ${x}`);
  }
}

/** sin x for |x| ≤ TRIG_MAX_ABS (≈ 1.65e6); throws RangeError beyond. NaN and ±∞ give NaN. */
export function sin(x: number): number {
  const ix = hiWord(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) {
    // |x| ≲ π/4
    if (ix < 0x3e500000) return x; // |x| < 2^-26
    return kernelSin(x, 0, 0);
  }
  if (ix >= 0x7ff00000) return NaN;
  checkTrigDomain('sin', x, ix);
  const n = remPio2(x);
  switch (n & 3) {
    case 0:
      return kernelSin(remY0, remY1, 1);
    case 1:
      return kernelCos(remY0, remY1);
    case 2:
      return -kernelSin(remY0, remY1, 1);
    default:
      return -kernelCos(remY0, remY1);
  }
}

/** cos x for |x| ≤ TRIG_MAX_ABS (≈ 1.65e6); throws RangeError beyond. NaN and ±∞ give NaN. */
export function cos(x: number): number {
  const ix = hiWord(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) {
    if (ix < 0x3e46a09e) return 1.0; // |x| < 2^-27·√2
    return kernelCos(x, 0);
  }
  if (ix >= 0x7ff00000) return NaN;
  checkTrigDomain('cos', x, ix);
  const n = remPio2(x);
  switch (n & 3) {
    case 0:
      return kernelCos(remY0, remY1);
    case 1:
      return -kernelSin(remY0, remY1, 1);
    case 2:
      return -kernelCos(remY0, remY1);
    default:
      return kernelSin(remY0, remY1, 1);
  }
}

/** tan x for |x| ≤ TRIG_MAX_ABS (≈ 1.65e6); throws RangeError beyond. NaN and ±∞ give NaN. */
export function tan(x: number): number {
  const ix = hiWord(x) & 0x7fffffff;
  if (ix <= 0x3fe921fb) {
    if (ix < 0x3e400000) return x; // |x| < 2^-27
    return kernelTan(x, 0, 1);
  }
  if (ix >= 0x7ff00000) return NaN;
  checkTrigDomain('tan', x, ix);
  const n = remPio2(x);
  return kernelTan(remY0, remY1, 1 - ((n & 1) << 1));
}

// ---------------------------------------------------------------------------------------------------------------------
// atan, atan2 (fdlibm s_atan.c, e_atan2.c)
// ---------------------------------------------------------------------------------------------------------------------

const ATANHI = [
  4.63647609000806093515e-1, // atan(0.5) hi, 0x3FDDAC67 0561BB4F
  7.85398163397448278999e-1, // atan(1.0) hi, 0x3FE921FB 54442D18
  9.82793723247329054082e-1, // atan(1.5) hi, 0x3FEF730B D281F69B
  1.570796326794896558, // atan(∞) hi, 0x3FF921FB 54442D18
] as const;
const ATANLO = [
  2.26987774529616870924e-17, // 0x3C7A2B7F 222F65E2
  3.06161699786838301793e-17, // 0x3C81A626 33145C07
  1.39033110312309984516e-17, // 0x3C700788 7AF0CBBD
  6.12323399573676603587e-17, // 0x3C91A626 33145C07
] as const;
const AT = [
  3.33333333333329318027e-1, // 0x3FD55555 5555550D
  -1.99999999998764832476e-1, // 0xBFC99999 9998EBC4
  1.42857142725034663711e-1, // 0x3FC24924 920083FF
  -1.1111110405462355788e-1, // 0xBFBC71C6 FE231671
  9.09088713343650656196e-2, // 0x3FB745CD C54C206E
  -7.69187620504482999495e-2, // 0xBFB3B0F2 AF749A6D
  6.66107313738753120669e-2, // 0x3FB10D66 A0D03D51
  -5.83357013379057348645e-2, // 0xBFADDE2D 52DEFD9A
  4.97687799461593236017e-2, // 0x3FA97B4B 24760DEB
  -3.6531572744216915527e-2, // 0xBFA2B444 2C6A6C2F
  1.62858201153657823623e-2, // 0x3F90AD3A E322DA11
] as const;

/** Arctangent, any finite or infinite x. */
export function atan(x: number): number {
  const hx = hiWord(x);
  const ix = hx & 0x7fffffff;
  let id: number;
  if (ix >= 0x44100000) {
    // |x| ≥ 2^66
    if (ix > 0x7ff00000 || (ix === 0x7ff00000 && loWord(x) !== 0)) return x + x; // NaN
    return hx > 0 ? ATANHI[3] + ATANLO[3] : -ATANHI[3] - ATANLO[3];
  }
  if (ix < 0x3fdc0000) {
    // |x| < 0.4375
    if (ix < 0x3e200000) return x; // |x| < 2^-29
    id = -1;
  } else {
    x = Math.abs(x);
    if (ix < 0x3ff30000) {
      // |x| < 1.1875
      if (ix < 0x3fe60000) {
        // 7/16 ≤ |x| < 11/16
        id = 0;
        x = (2.0 * x - 1.0) / (2.0 + x);
      } else {
        // 11/16 ≤ |x| < 19/16
        id = 1;
        x = (x - 1.0) / (x + 1.0);
      }
    } else if (ix < 0x40038000) {
      // |x| < 2.4375
      id = 2;
      x = (x - 1.5) / (1.0 + 1.5 * x);
    } else {
      // 2.4375 ≤ |x| < 2^66
      id = 3;
      x = -1.0 / x;
    }
  }
  const z = x * x;
  const w = z * z;
  const s1 = z * (AT[0] + w * (AT[2] + w * (AT[4] + w * (AT[6] + w * (AT[8] + w * AT[10])))));
  const s2 = w * (AT[1] + w * (AT[3] + w * (AT[5] + w * (AT[7] + w * AT[9]))));
  if (id < 0) return x - x * (s1 + s2);
  const zz = (ATANHI[id] as number) - (x * (s1 + s2) - (ATANLO[id] as number) - x);
  return hx < 0 ? -zz : zz;
}

const PI_O_4 = 7.85398163397448279e-1; // 0x3FE921FB 54442D18
const PI_O_2 = 1.570796326794896558; // 0x3FF921FB 54442D18
const PI = 3.141592653589793116; // 0x400921FB 54442D18
const PI_LO = 1.2246467991473532e-16; // 0x3CA1A626 33145C07

/** atan(y/x) in the correct quadrant, (−π, π], with the IEEE/ECMAScript signed-zero and infinity cases. */
export function atan2(y: number, x: number): number {
  if (Number.isNaN(x) || Number.isNaN(y)) return NaN;
  if (x === 1) return atan(y);
  const yNeg = y < 0 || Object.is(y, -0);
  const xNeg = x < 0 || Object.is(x, -0);
  const m = (yNeg ? 1 : 0) | (xNeg ? 2 : 0); // 2·sign(x) + sign(y)
  if (y === 0) {
    if (m === 0 || m === 1) return y; // atan(±0, +anything) = ±0
    return m === 2 ? PI : -PI; // atan(±0, −anything) = ±π
  }
  if (x === 0) return yNeg ? -PI_O_2 : PI_O_2;
  if (x === Infinity || x === -Infinity) {
    if (y === Infinity || y === -Infinity) {
      switch (m) {
        case 0:
          return PI_O_4;
        case 1:
          return -PI_O_4;
        case 2:
          return 3.0 * PI_O_4;
        default:
          return -3.0 * PI_O_4;
      }
    }
    switch (m) {
      case 0:
        return 0;
      case 1:
        return -0;
      case 2:
        return PI;
      default:
        return -PI;
    }
  }
  if (y === Infinity || y === -Infinity) return yNeg ? -PI_O_2 : PI_O_2;
  const k = ((hiWord(y) & 0x7fffffff) - (hiWord(x) & 0x7fffffff)) >> 20;
  let z: number;
  if (k > 60)
    z = PI_O_2 + 0.5 * PI_LO; // |y/x| > 2^60
  else if (xNeg && k < -60)
    z = 0.0; // |y|/x < −2^60
  else z = atan(Math.abs(y / x));
  switch (m) {
    case 0:
      return z;
    case 1:
      return -z;
    case 2:
      return PI - (z - PI_LO);
    default:
      return z - PI_LO - PI;
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// erf, erfc (fdlibm s_erf.c)
// ---------------------------------------------------------------------------------------------------------------------

const ERX = 8.45062911510467529297e-1; // 0x3FEB0AC1 60000000
const EFX = 1.28379167095512586316e-1; // 0x3FC06EBA 8214DB69
const EFX8 = 1.02703333676410069053; // 0x3FF06EBA 8214DB69
const PP0 = 1.28379167095512558561e-1; // 0x3FC06EBA 8214DB68
const PP1 = -3.2504210724700149937e-1; // 0xBFD4CD7D 691CB913
const PP2 = -2.84817495755985104766e-2; // 0xBF9D2A51 DBD7194F
const PP3 = -5.77027029648944159157e-3; // 0xBF77A291 236668E4
const PP4 = -2.37630166566501626084e-5; // 0xBEF8EAD6 120016AC
const QQ1 = 3.97917223959155352819e-1; // 0x3FD97779 CDDADC09
const QQ2 = 6.50222499887672944485e-2; // 0x3FB0A54C 5536CEBA
const QQ3 = 5.08130628187576562776e-3; // 0x3F74D022 C4D36B0F
const QQ4 = 1.32494738004321644526e-4; // 0x3F215DC9 221C1A10
const QQ5 = -3.9602282787753681232e-6; // 0xBED09C43 42A26120
const PA0 = -2.36211856075265944077e-3; // 0xBF6359B8 BEF77538
const PA1 = 4.14856118683748331666e-1; // 0x3FDA8D00 AD92B34D
const PA2 = -3.72207876035701323847e-1; // 0xBFD7D240 FBB8C3F1
const PA3 = 3.18346619901161753674e-1; // 0x3FD45FCA 805120E4
const PA4 = -1.10894694282396677476e-1; // 0xBFBC6398 3D3E28EC
const PA5 = 3.54783043256182359371e-2; // 0x3FA22A36 599795EB
const PA6 = -2.166375594868790843e-3; // 0xBF61BF38 0A96073F
const QA1 = 1.06420880400844228286e-1; // 0x3FBB3E66 18EEE323
const QA2 = 5.40397917702171048937e-1; // 0x3FE14AF0 92EB6F33
const QA3 = 7.18286544141962662868e-2; // 0x3FB2635C D99FE9A7
const QA4 = 1.26171219808761642112e-1; // 0x3FC02660 E763351F
const QA5 = 1.36370839120290507362e-2; // 0x3F8BEDC2 6B51DD1C
const QA6 = 1.1984499846799107417e-2; // 0x3F888B54 5735151D
const RA0 = -9.86494403484714822705e-3; // 0xBF843412 600D6435
const RA1 = -6.93858572707181764372e-1; // 0xBFE63416 E4BA7360
const RA2 = -1.05586262253232909814e1; // 0xC0251E04 41B0E726
const RA3 = -6.23753324503260060396e1; // 0xC04F300A E4CBA38D
const RA4 = -1.62396669462573470355e2; // 0xC0644CB1 84282266
const RA5 = -1.84605092906711035994e2; // 0xC067135C EBCCABB2
const RA6 = -8.12874355063065934246e1; // 0xC0545265 57E4D2F2
const RA7 = -9.81432934416914548592; // 0xC023A0EF C69AC25C
const SA1 = 1.96512716674392571292e1; // 0x4033A6B9 BD707687
const SA2 = 1.376577541435190426e2; // 0x4061350C 526AE721
const SA3 = 4.34565877475229228821e2; // 0x407B290D D58A1A71
const SA4 = 6.45387271733267880336e2; // 0x40842B19 21EC2868
const SA5 = 4.29008140027567833386e2; // 0x407AD021 57700314
const SA6 = 1.08635005541779435134e2; // 0x405B28A3 EE48AE2C
const SA7 = 6.57024977031928170135; // 0x401A47EF 8E484A93
const SA8 = -6.04244152148580987438e-2; // 0xBFAEEFF2 EE749A62
const RB0 = -9.86494292470009928597e-3; // 0xBF843412 39E86F4A
const RB1 = -7.99283237680523006574e-1; // 0xBFE993BA 70C285DE
const RB2 = -1.77579549177547519889e1; // 0xC031C209 555F995A
const RB3 = -1.60636384855821916062e2; // 0xC064145D 43C5ED98
const RB4 = -6.37566443368389627722e2; // 0xC083EC88 1375F228
const RB5 = -1.02509513161107724954e3; // 0xC0900461 6A2E5992
const RB6 = -4.83519191608651397019e2; // 0xC07E384E 9BDC383F
const SB1 = 3.03380607434824582924e1; // 0x403E568B 261D5190
const SB2 = 3.25792512996573918826e2; // 0x40745CAE 221B9F0A
const SB3 = 1.53672958608443695994e3; // 0x409802EB 189D5118
const SB4 = 3.19985821950859553908e3; // 0x40A8FFB7 688C246A
const SB5 = 2.55305040643316442583e3; // 0x40A3F219 CEDF3BE6
const SB6 = 4.74528541206955367215e2; // 0x407DA874 E79FE763
const SB7 = -2.24409524465858183362e1; // 0xC03670E2 42712D62

/** exp(−x²)·exp(R/S)/x for the erfc tails (|x| ≥ 1.25), with x² split exactly (z = x with its low word cleared). */
function erfcTail(ax: number, ix: number, splitHi: number): number {
  const s = 1.0 / (ax * ax);
  let R: number;
  let S: number;
  if (ix < splitHi) {
    // |x| < 1/0.35
    R = RA0 + s * (RA1 + s * (RA2 + s * (RA3 + s * (RA4 + s * (RA5 + s * (RA6 + s * RA7))))));
    S = 1 + s * (SA1 + s * (SA2 + s * (SA3 + s * (SA4 + s * (SA5 + s * (SA6 + s * (SA7 + s * SA8)))))));
  } else {
    R = RB0 + s * (RB1 + s * (RB2 + s * (RB3 + s * (RB4 + s * (RB5 + s * RB6)))));
    S = 1 + s * (SB1 + s * (SB2 + s * (SB3 + s * (SB4 + s * (SB5 + s * (SB6 + s * SB7))))));
  }
  const z = withLoWord(ax, 0);
  const r = exp(-z * z - 0.5625) * exp((z - ax) * (z + ax) + R / S);
  return r / ax;
}

/** The error function. */
export function erf(x: number): number {
  const hx = hiWord(x);
  const ix = hx & 0x7fffffff;
  if (ix >= 0x7ff00000) {
    if (Number.isNaN(x)) return NaN;
    return x > 0 ? 1 : -1;
  }
  if (ix < 0x3feb0000) {
    // |x| < 0.84375
    if (ix < 0x3e300000) {
      // |x| < 2^-28
      if (ix < 0x00800000) return 0.125 * (8.0 * x + EFX8 * x); // avoid underflow
      return x + EFX * x;
    }
    const z = x * x;
    const r = PP0 + z * (PP1 + z * (PP2 + z * (PP3 + z * PP4)));
    const s = 1 + z * (QQ1 + z * (QQ2 + z * (QQ3 + z * (QQ4 + z * QQ5))));
    return x + x * (r / s);
  }
  if (ix < 0x3ff40000) {
    // 0.84375 ≤ |x| < 1.25
    const s = Math.abs(x) - 1;
    const P = PA0 + s * (PA1 + s * (PA2 + s * (PA3 + s * (PA4 + s * (PA5 + s * PA6)))));
    const Q = 1 + s * (QA1 + s * (QA2 + s * (QA3 + s * (QA4 + s * (QA5 + s * QA6)))));
    return hx >= 0 ? ERX + P / Q : -ERX - P / Q;
  }
  if (ix >= 0x40180000) return hx >= 0 ? 1 : -1; // |x| ≥ 6
  const r = erfcTail(Math.abs(x), ix, 0x4006db6e); // fdlibm's erf splits at 0x4006DB6E, erfc at 0x4006DB6D
  return hx >= 0 ? 1 - r : r - 1;
}

/** The complementary error function 1 − erf(x), accurate in the upper tail (relative error ~1 ulp to x ≈ 26.5). */
export function erfc(x: number): number {
  const hx = hiWord(x);
  const ix = hx & 0x7fffffff;
  if (ix >= 0x7ff00000) {
    if (Number.isNaN(x)) return NaN;
    return x > 0 ? 0 : 2;
  }
  if (ix < 0x3feb0000) {
    // |x| < 0.84375
    if (ix < 0x3c700000) return 1 - x; // |x| < 2^-56
    const z = x * x;
    const r = PP0 + z * (PP1 + z * (PP2 + z * (PP3 + z * PP4)));
    const s = 1 + z * (QQ1 + z * (QQ2 + z * (QQ3 + z * (QQ4 + z * QQ5))));
    const y = r / s;
    if (hx < 0x3fd00000) return 1 - (x + x * y); // x < 1/4
    return 0.5 - (x * y + (x - 0.5));
  }
  if (ix < 0x3ff40000) {
    // 0.84375 ≤ |x| < 1.25
    const s = Math.abs(x) - 1;
    const P = PA0 + s * (PA1 + s * (PA2 + s * (PA3 + s * (PA4 + s * (PA5 + s * PA6)))));
    const Q = 1 + s * (QA1 + s * (QA2 + s * (QA3 + s * (QA4 + s * (QA5 + s * QA6)))));
    if (hx >= 0) return 1 - ERX - P / Q;
    return 1 + (ERX + P / Q);
  }
  if (ix < 0x403c0000) {
    // |x| < 28
    if (hx < 0 && ix >= 0x40180000) return 2; // x < −6
    const r = erfcTail(Math.abs(x), ix, 0x4006db6d);
    return hx > 0 ? r : 2 - r;
  }
  return hx > 0 ? 0 : 2;
}

// ---------------------------------------------------------------------------------------------------------------------
// Normal distribution
// ---------------------------------------------------------------------------------------------------------------------

const SQRT1_2_HI = 0.7071067811865476; // nearest double to √½
const SQRT1_2_LO = -4.833646656726457e-17; // √½ − SQRT1_2_HI
const INV_SQRT_PI = 0.5641895835477563; // 1/√π
const SQRT_2PI = 2.5066282746310002; // √(2π)

/**
 * Standard normal CDF Φ(x) = ½·erfc(−x/√2). The rounding error of x/√2 is carried as a first-order correction so the
 * lower tail keeps its relative accuracy (Φ(−37) ≈ 5.7e-300 to ~1e-14 relative).
 */
export function normCdf(x: number): number {
  if (Number.isNaN(x)) return NaN;
  if (x < -40) return 0;
  if (x > 40) return 1;
  const t = x * SQRT1_2_HI;
  const e = twoProdErr(x, SQRT1_2_HI, t) + x * SQRT1_2_LO; // x/√2 = t + e
  const base = 0.5 * erfc(-t);
  return base + e * INV_SQRT_PI * exp(-t * t); // d/dt ½·erfc(−t) = e^(−t²)/√π
}

// Wichura (1988), Algorithm AS 241 PPND16.
const A = [
  3.3871328727963665, 133.14166789178438, 1971.5909503065513, 13731.69376550946, 45921.95393154987, 67265.7709270087,
  33430.57558358813, 2509.0809287301227,
] as const;
const B = [
  1.0, 42.31333070160091, 687.1870074920579, 5394.196021424751, 21213.794301586597, 39307.89580009271,
  28729.085735721943, 5226.495278852854,
] as const;
const C = [
  1.4234371107496835, 4.630337846156546, 5.769497221460691, 3.6478483247632045, 1.2704582524523684, 0.2417807251774506,
  0.022723844989269184, 0.0007745450142783414,
] as const;
const D = [
  1.0, 2.053191626637759, 1.6763848301838038, 0.6897673349851, 0.14810397642748008, 0.015198666563616457,
  0.0005475938084995345, 1.0507500716444169e-9,
] as const;
const E = [
  6.657904643501103, 5.463784911164114, 1.7848265399172913, 0.29656057182850487, 0.026532189526576124,
  0.0012426609473880784, 0.000027115555687434876, 2.0103343992922881e-7,
] as const;
const F = [
  1.0, 0.599832206555888, 0.1369298809227358, 0.014875361290850615, 0.0007868691311456133, 0.000018463183175100548,
  1.421511758316446e-7, 2.0442631033899397e-15,
] as const;

type Coeffs8 = readonly [number, number, number, number, number, number, number, number];

function horner8(c: Coeffs8, r: number): number {
  return ((((((c[7] * r + c[6]) * r + c[5]) * r + c[4]) * r + c[3]) * r + c[2]) * r + c[1]) * r + c[0];
}

/** AS241 for 0 < p < 0.5 (returns a negative quantile). */
function as241Lower(p: number): number {
  const q = p - 0.5;
  if (q >= -0.425) {
    const r = 0.180625 - q * q;
    return (q * horner8(A, r)) / horner8(B, r);
  }
  let r = Math.sqrt(-log(p));
  let x: number;
  if (r <= 5) {
    r -= 1.6;
    x = horner8(C, r) / horner8(D, r);
  } else {
    r -= 5;
    x = horner8(E, r) / horner8(F, r);
  }
  return -x;
}

function normInvLower(p: number): number {
  let x = as241Lower(p);
  // One Halley step against normCdf: AS241 is already ~1e-16, so this mainly makes normInv the exact inverse of this
  // module's normCdf (the round trip is what samplers rely on).
  const scale = exp(0.5 * x * x);
  if (scale < Infinity) {
    const u = (normCdf(x) - p) * SQRT_2PI * scale;
    x = x - u / (1 + 0.5 * x * u);
  }
  return x;
}

/** Standard normal quantile Φ⁻¹(p). normInv(0) = −∞, normInv(1) = +∞; NaN outside [0, 1]. Odd-symmetric exactly. */
export function normInv(p: number): number {
  if (!(p >= 0 && p <= 1)) return NaN;
  if (p === 0) return -Infinity;
  if (p === 1) return Infinity;
  if (p === 0.5) return 0;
  if (p > 0.5) return -normInvLower(1 - p); // 1 − p is exact for p ∈ [½, 1] (Sterbenz)
  return normInvLower(p);
}

// ---------------------------------------------------------------------------------------------------------------------
// lgamma (fdlibm e_lgamma_r.c, positive arguments)
// ---------------------------------------------------------------------------------------------------------------------

const LGA = [
  7.72156649015328655494e-2, // 0x3FB3C467 E37DB0C8
  3.22467033424113591611e-1, // 0x3FD4A34C C4A60FAD
  6.73523010531292681824e-2, // 0x3FB13E00 1A5562A7
  2.05808084325167332806e-2, // 0x3F951322 AC92547B
  7.38555086081402883957e-3, // 0x3F7E404F B68FEFE8
  2.89051383673415629091e-3, // 0x3F67ADD8 CCB7926B
  1.19270763183362067845e-3, // 0x3F538A94 116F3F5D
  5.10069792153511336608e-4, // 0x3F40B6C6 89B99C00
  2.20862790713908385557e-4, // 0x3F2CF2EC ED10E54D
  1.08011567247583939954e-4, // 0x3F1C5088 987DFB07
  2.52144565451257326939e-5, // 0x3EFA7074 428CFA52
  4.4864094961891516015e-5, // 0x3F07858E 90A45837
] as const;
const TC = 1.46163214496836224576; // 0x3FF762D8 6356BE3F: argmin of Γ
const TF = -1.21486290535849611461e-1; // 0xBFBF19B9 BCC38A42: lgamma(TC)
const TT = -3.63867699703950536541e-18; // 0xBC50C7CA A48A971F: −(tail of TF)
const LGT = [
  4.83836122723810047042e-1, // 0x3FDEF72B C8EE38A2
  -1.47587722994593911752e-1, // 0xBFC2E427 8DC6C509
  6.46249402391333854778e-2, // 0x3FB08B42 94D5419B
  -3.27885410759859649565e-2, // 0xBFA0C9A8 DF35B713
  1.79706750811820387126e-2, // 0x3F9266E7 970AF9EC
  -1.0314224129834143745e-2, // 0xBF851F9F BA91EC6A
  6.10053870246291332635e-3, // 0x3F78FCE0 E370E344
  -3.6845201678113825676e-3, // 0xBF6E2EFF B3E914D7
  2.2596478090061247225e-3, // 0x3F6282D3 2E15C915
  -1.40346469989232843813e-3, // 0xBF56FE8E BF2D1AF1
  8.81081882437654011382e-4, // 0x3F4CDF0C EF61A8E9
  -5.38595305356740546715e-4, // 0xBF41A610 9C73E0EC
  3.15632070903625950361e-4, // 0x3F34AF6D 6C0EBBF7
  -3.12754168375120860518e-4, // 0xBF347F24 ECC38C38
  3.35529192635519073543e-4, // 0x3F35FD3E E8C2D3F4
] as const;
const LGU = [
  -7.72156649015328655494e-2, // 0xBFB3C467 E37DB0C8
  6.32827064025093366517e-1, // 0x3FE4401E 8B005DFF
  1.45492250137234768737, // 0x3FF7475C D119BD6F
  9.77717527963372745603e-1, // 0x3FEF4976 44EA8450
  2.28963728064692451092e-1, // 0x3FCD4EAE F6010924
  1.33810918536787660377e-2, // 0x3F8B678B BF2BAB09
] as const;
const LGV = [
  1.0,
  2.45597793713041134822, // 0x4003A5D7 C2BD619C
  2.12848976379893395361, // 0x40010725 A42B18F5
  7.69285150456672783825e-1, // 0x3FE89DFB E45050AF
  1.04222645593369134254e-1, // 0x3FBAAE55 D6537C88
  3.2170924228242391181e-3, // 0x3F6A5ABB 57D0CF61
] as const;
const LGS = [
  -7.72156649015328655494e-2, // 0xBFB3C467 E37DB0C8
  2.14982415960608852501e-1, // 0x3FCB848B 36E20878
  3.25778796408930981787e-1, // 0x3FD4D98F 4F139F59
  1.46350472652464452805e-1, // 0x3FC2BB9C BEE5F2F7
  2.6642270303363860956e-2, // 0x3F9B481C 7E939961
  1.84028451407337715652e-3, // 0x3F5E26B6 7368F239
  3.19475326584100867617e-5, // 0x3F00BFEC DD17E945
] as const;
const LGR = [
  1.0,
  1.39200533467621045958, // 0x3FF645A7 62C4AB74
  7.21935547567138069525e-1, // 0x3FE71A18 93D3DCDC
  1.71933865632803078993e-1, // 0x3FC601ED CCFBDF27
  1.86459191715652901344e-2, // 0x3F9317EA 742ED475
  7.77942496381893596434e-4, // 0x3F497DDA CA41A95B
  7.32668430744625636189e-6, // 0x3EDEBAF7 A5B38140
] as const;
const LGW = [
  4.18938533204672725052e-1, // 0x3FDACFE3 90C97D69: ½·ln(2π) − ½
  8.33333333333329678849e-2, // 0x3FB55555 5555553B
  -2.7777777772877553647e-3, // 0xBF66C16C 16B02E5C
  7.936505586430195585e-4, // 0x3F4A019F 98CF38B6
  -5.95187557450339963135e-4, // 0xBF4380CB 8C0FE741
  8.36339918996282139126e-4, // 0x3F4B67BA 4CDAD5D1
  -1.63092934096575273989e-3, // 0xBF5AB89D 0B9E43E4
] as const;

/**
 * log Γ(x) for x > 0 (+∞ gives +∞). Throws RangeError for x ≤ 0 or NaN: the engine only takes log-gamma of positive
 * shapes and counts, and the reflection branch would be untested code.
 */
export function lgamma(x: number): number {
  if (!(x > 0)) throw new RangeError(`dmath.lgamma: x must be > 0, got ${x}`);
  const hx = hiWord(x);
  const lx = loWord(x);
  const ix = hx & 0x7fffffff;
  if (ix >= 0x7ff00000) return x; // +∞
  if (ix < 0x3b900000) return -log(x); // x < 2^-70
  if (((ix - 0x3ff00000) | lx) === 0 || ((ix - 0x40000000) | lx) === 0) return 0; // lgamma(1) = lgamma(2) = 0

  if (ix < 0x40000000) {
    // 0 < x < 2
    let r: number;
    let y: number;
    let i: number;
    if (ix <= 0x3feccccc) {
      // x < 0.9: lgamma(x) = lgamma(x + 1) − log(x)
      r = -log(x);
      if (ix >= 0x3fe76944) {
        y = 1 - x;
        i = 0;
      } else if (ix >= 0x3fcda661) {
        y = x - (TC - 1);
        i = 1;
      } else {
        y = x;
        i = 2;
      }
    } else {
      r = 0;
      if (ix >= 0x3ffbb4c3) {
        // [1.7316, 2]
        y = 2.0 - x;
        i = 0;
      } else if (ix >= 0x3ff3b4c4) {
        // [1.23, 1.73]
        y = x - TC;
        i = 1;
      } else {
        y = x - 1;
        i = 2;
      }
    }
    switch (i) {
      case 0: {
        const z = y * y;
        const p1 = LGA[0] + z * (LGA[2] + z * (LGA[4] + z * (LGA[6] + z * (LGA[8] + z * LGA[10]))));
        const p2 = z * (LGA[1] + z * (LGA[3] + z * (LGA[5] + z * (LGA[7] + z * (LGA[9] + z * LGA[11])))));
        const p = y * p1 + p2;
        r += p - 0.5 * y;
        break;
      }
      case 1: {
        const z = y * y;
        const w = z * y;
        const p1 = LGT[0] + w * (LGT[3] + w * (LGT[6] + w * (LGT[9] + w * LGT[12])));
        const p2 = LGT[1] + w * (LGT[4] + w * (LGT[7] + w * (LGT[10] + w * LGT[13])));
        const p3 = LGT[2] + w * (LGT[5] + w * (LGT[8] + w * (LGT[11] + w * LGT[14])));
        const p = z * p1 - (TT - w * (p2 + y * p3));
        r += TF + p;
        break;
      }
      default: {
        const p1 = y * (LGU[0] + y * (LGU[1] + y * (LGU[2] + y * (LGU[3] + y * (LGU[4] + y * LGU[5])))));
        const p2 = LGV[0] + y * (LGV[1] + y * (LGV[2] + y * (LGV[3] + y * (LGV[4] + y * LGV[5]))));
        r += -0.5 * y + p1 / p2;
      }
    }
    return r;
  }
  if (ix < 0x40200000) {
    // 2 ≤ x < 8
    const i = x | 0;
    const y = x - i;
    const p = y * (LGS[0] + y * (LGS[1] + y * (LGS[2] + y * (LGS[3] + y * (LGS[4] + y * (LGS[5] + y * LGS[6]))))));
    const q = LGR[0] + y * (LGR[1] + y * (LGR[2] + y * (LGR[3] + y * (LGR[4] + y * (LGR[5] + y * LGR[6])))));
    let r = 0.5 * y + p / q;
    // lgamma(1 + s) = log(s) + lgamma(s): multiply (y+i−1)…(y+2) in fdlibm's order (i = 7 starts with y+6).
    if (i >= 3) {
      let z = 1.0;
      for (let k = i - 1; k >= 2; k--) z *= y + k;
      r += log(z);
    }
    return r;
  }
  if (ix < 0x43900000) {
    // 8 ≤ x < 2^58: Stirling with a minimax correction
    const t = log(x);
    const z = 1.0 / x;
    const y = z * z;
    const w = LGW[0] + z * (LGW[1] + y * (LGW[2] + y * (LGW[3] + y * (LGW[4] + y * (LGW[5] + y * LGW[6])))));
    return (x - 0.5) * (t - 1.0) + w;
  }
  return x * (log(x) - 1.0); // x ≥ 2^58
}
