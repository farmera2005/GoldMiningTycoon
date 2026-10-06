// Number primitives for ui/format (DESIGN §13.2). Digits are grouped and rounded here with plain string arithmetic,
// never with Intl or toLocaleString, so the output is en-US whatever the browser or process locale is (D-13.12).
//
// Rounding follows 13.2's rule, `Intl.NumberFormat` `roundingMode: 'halfExpand'`. Intl rounds the number's shortest
// round-trip decimal (the digits `String(x)` prints), neither its exact binary value nor a float product such as
// x × 10^dp: 1.005 → 1.01 and 0.125 → 0.13 (decimal ties go away from zero), while 1.9649999999999999 → 1.96.
// Rounding that digit string reproduces Intl exactly at any magnitude, with no float arithmetic (format.test.ts checks
// it against Intl itself).

/** The true minus sign (U+2212) that 13.2 requires for negatives. */
export const MINUS = '−';

/**
 * Round half away from zero to an integer (the engine's roundHalfAway, §2.4). At 0 dp this equals 13.2's decimal
 * rule: k + ½ is itself a double, so a double rounds the same way as its shortest decimal. The fraction
 * |x| − floor(|x|) is exact for non-integers, so comparing it avoids the floor(|x| + 0.5) misround at
 * 0.49999999999999994.
 */
export function roundHalfAway(x: number): number {
  if (!Number.isFinite(x)) return x;
  if (Number.isInteger(x)) return x === 0 ? 0 : x;
  const ax = Math.abs(x);
  const whole = Math.floor(ax);
  const r = ax - whole >= 0.5 ? whole + 1 : whole;
  return x < 0 ? (r === 0 ? 0 : -r) : r;
}

/** Inserts a comma between every three digits of an unsigned integer digit string (`1234567` → `1,234,567`). */
export function groupDigits(intDigits: string): string {
  let out = '';
  for (let i = 0; i < intDigits.length; i++) {
    const fromRight = intDigits.length - i;
    out += intDigits[i];
    if (fromRight > 1 && fromRight % 3 === 1) out += ',';
  }
  return out;
}

/** |x| as its shortest round-trip decimal: 0.`digits` × 10^`point` (`digits` has no leading or trailing zeros). */
interface DecimalDigits {
  /** '' for zero. */
  readonly digits: string;
  /** How many of `digits` sit before the decimal point (may be ≤ 0 or exceed the digit count). */
  readonly point: number;
}

function shortestDecimal(ax: number): DecimalDigits {
  // ECMAScript Number::toString prints the shortest digit string that reads back as the same double (`1.005`,
  // `1e-7`, `1.5e+21`): the digits ICU starts from when Intl formats a number.
  const [mantissa = '0', exponent = '0'] = String(ax).split('e');
  const [intPart = '0', fracPart = ''] = mantissa.split('.');
  const all = intPart + fracPart;
  const lead = all.length - all.replace(/^0+/, '').length;
  return { digits: all.slice(lead).replace(/0+$/, ''), point: intPart.length + Number(exponent) - lead };
}

/** Adds one to an unsigned digit string (`199` → `200`, `99` → `100`). */
function incrementDigits(digits: string): string {
  let i = digits.length - 1;
  while (i >= 0 && digits[i] === '9') i--;
  const carried = '0'.repeat(digits.length - 1 - i);
  return i < 0 ? `1${carried}` : `${digits.slice(0, i)}${String(Number(digits[i]) + 1)}${carried}`;
}

/**
 * |x| × 10^(shift + dp) rounded half away from zero on its decimal digits, as an unsigned integer digit string of at
 * least dp + 1 digits. `shift` moves the decimal point first, exactly (a percentage is a fraction × 10^2).
 */
function scaledDigits(ax: number, dp: number, shift: number): string {
  const { digits, point } = shortestDecimal(ax);
  const keep = point + shift + dp;
  let out: string;
  if (digits === '' || keep < 0) {
    // Below 10^−(dp+1): rounds to zero.
    out = '0';
  } else if (keep >= digits.length) {
    out = digits + '0'.repeat(keep - digits.length);
  } else {
    const kept = keep === 0 ? '0' : digits.slice(0, keep);
    out = (digits[keep] ?? '0') >= '5' ? incrementDigits(kept) : kept;
  }
  return out.padStart(dp + 1, '0');
}

export interface RoundedParts {
  /** True when the value is below zero after rounding (−0.004 at 2 dp rounds to 0 and is not negative). */
  readonly negative: boolean;
  /** Integer digits of |value|, ungrouped. */
  readonly int: string;
  /** Exactly `dp` fraction digits. */
  readonly frac: string;
}

/** |x| × 10^shift rounded half away from zero to `dp` decimals by 13.2's rule, as digit strings. */
export function roundedParts(x: number, dp: number, shift = 0): RoundedParts {
  if (!Number.isFinite(x)) return { negative: false, int: Number.isNaN(x) ? 'NaN' : '∞', frac: '' };
  const digits = scaledDigits(Math.abs(x), dp, shift);
  const int = digits.slice(0, digits.length - dp).replace(/^0+(?=\d)/, '');
  const frac = digits.slice(digits.length - dp);
  const zero = /^0*$/.test(int + frac);
  return { negative: x < 0 && !zero, int, frac };
}

/** x × 10^shift rounded to a whole number by 13.2's rule, the shift exact: roundScaled(1.005, 2) = 101. */
export function roundScaled(x: number, shift: number): number {
  const p = roundedParts(x, 0, shift);
  const n = Number(p.int);
  return p.negative ? -n : n;
}

export interface FixedOptions {
  /** Thousands separators (default true). */
  readonly group?: boolean;
  /** Prefix `+` on positive values (deltas); zero never takes a sign. */
  readonly plus?: boolean;
  /** Format x × 10^shift, the shift done exactly on the decimal digits (percentages use 2). */
  readonly shift?: number;
}

/** `x` to `dp` decimals with grouping and a true minus sign: fixed(−1234.5, 2) → `−1,234.50`. */
export function fixed(x: number, dp: number, options: FixedOptions = {}): string {
  const p = roundedParts(x, dp, options.shift ?? 0);
  const int = options.group === false ? p.int : groupDigits(p.int);
  const body = dp > 0 ? `${int}.${p.frac}` : int;
  const isZero = /^0*$/.test(p.int + p.frac);
  const sign = p.negative ? MINUS : options.plus === true && !isZero ? '+' : '';
  return `${sign}${body}`;
}

/** Up to `maxDp` decimals with trailing zeros dropped (for raw parameter values): 0.920 → `0.92`, 3 → `3`. */
export function trimmed(x: number, maxDp: number): string {
  const s = fixed(x, maxDp);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}
