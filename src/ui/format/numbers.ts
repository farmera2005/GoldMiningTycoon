// Number primitives for ui/format (DESIGN §13.2). Digits are grouped and rounded here with plain arithmetic, never
// with Intl or toLocaleString, so the output is en-US whatever the browser or process locale is (D-13.12), and it
// rounds half away from zero exactly as the engine's roundCents does (§2.4).

/** The true minus sign (U+2212) that 13.2 requires for negatives. */
export const MINUS = '−';

/**
 * Round half away from zero to an integer, on the binary value (the engine's roundHalfAway, §2.4). The fraction
 * |x| − floor(|x|) is exact for non-integers, so comparing it avoids the floor(|x| + 0.5) misround at 0.49999999999999994.
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

export interface RoundedParts {
  /** True when the value is below zero after rounding (−0.004 at 2 dp rounds to 0 and is not negative). */
  readonly negative: boolean;
  /** Integer digits of |value|, ungrouped. */
  readonly int: string;
  /** Exactly `dp` fraction digits. */
  readonly frac: string;
}

/** |x| rounded half away from zero to `dp` decimals, as digit strings. */
export function roundedParts(x: number, dp: number): RoundedParts {
  if (!Number.isFinite(x)) return { negative: false, int: Number.isNaN(x) ? 'NaN' : '∞', frac: '' };
  const scaled = roundHalfAway(Math.abs(x) * 10 ** dp);
  let digits: string;
  if (Number.isSafeInteger(scaled)) {
    digits = String(scaled).padStart(dp + 1, '0');
  } else {
    // Beyond 2^53 the scaled integer is no longer exact; toFixed is locale-free and exact enough at that size.
    digits = Math.abs(x).toFixed(dp).replace('.', '');
  }
  const int = digits.slice(0, digits.length - dp);
  const frac = digits.slice(digits.length - dp);
  const zero = /^0*$/.test(int + frac);
  return { negative: x < 0 && !zero, int: int === '' ? '0' : int, frac };
}

export interface FixedOptions {
  /** Thousands separators (default true). */
  readonly group?: boolean;
  /** Prefix `+` on positive values (deltas); zero never takes a sign. */
  readonly plus?: boolean;
}

/** `x` to `dp` decimals with grouping and a true minus sign: fixed(−1234.5, 2) → `−1,234.50`. */
export function fixed(x: number, dp: number, options: FixedOptions = {}): string {
  const p = roundedParts(x, dp);
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
