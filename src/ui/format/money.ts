// USD formatting (DESIGN §13.2 money rows, D-13.13). State money is integer cents; explanation trees carry float
// dollars, which are rounded to whole cents once by 13.2's rule (half away from zero on the decimal value, as Intl's
// halfExpand) and then formatted with integer arithmetic, so a ledger amount always prints its exact cents.
import { uiConfig } from '../../data/tuning/ui';
import { MINUS, fixed, groupDigits, roundHalfAway, roundScaled } from './numbers';

/** general: cents hidden at or above ui.fmt.centsHiddenAboveUsd · statement: whole dollars, negatives in
 *  parentheses · ledger: exact cents · compact: KPI tiles and chart axes, k/M above ui.fmt.compactAboveUsd. */
export type MoneyStyle = 'general' | 'statement' | 'ledger' | 'compact';

export interface MoneyOptions {
  readonly style?: MoneyStyle;
  /** Prefix `+` on positive values (deltas). */
  readonly plus?: boolean;
}

/**
 * Float dollars → integer cents, half away from zero on the decimal value (13.2): 1.005 → 101¢, where rounding the
 * float product 1.005 × 100 = 100.49999999999999 would give 100¢.
 */
export function dollarsToCents(usd: number): number {
  return roundScaled(usd, 2);
}

function sign(negative: boolean, plus: boolean | undefined, zero: boolean): string {
  if (negative && !zero) return MINUS;
  return plus === true && !zero ? '+' : '';
}

/** Exact `$1,234.56` from integer cents (no sign). */
function exactCents(absCents: number): string {
  const dollars = Math.floor(absCents / 100);
  const rest = absCents - dollars * 100;
  return `$${groupDigits(String(dollars))}.${String(rest).padStart(2, '0')}`;
}

/** Whole dollars from integer cents, half away from zero (`$1,234,568` from 123,456,789¢; no sign). */
function wholeDollars(absCents: number): string {
  // (|c| + 50) / 100 is never within rounding error of an integer unless it is one, so floor is exact here.
  return `$${groupDigits(String(Math.floor((absCents + 50) / 100)))}`;
}

/**
 * |cents| × 10^shift to three significant digits. The decimals follow the rounded value, not the raw one, so a carry
 * over a power of ten drops a decimal instead of printing a fourth digit (9.996 → `10.0`, 99.95 → `100`); from
 * 1,000 up every integer digit shows (`1,000`).
 */
function threeSignificant(absCents: number, shift: number): string {
  for (let dp = 2; dp > 0; dp--) {
    const text = fixed(absCents, dp, { shift });
    if (Number(text.replace(/,/g, '')) < 10 ** (3 - dp)) return text;
  }
  return fixed(absCents, 0, { shift });
}

/** Three significant digits with k or M (`$1.23M`, `$412k`, `$10.0M`); the k/M choice also follows the rounding. */
function compactDollars(absCents: number): string {
  // The shifts are exact on the decimal digits: thousands of dollars are cents × 10^−5, millions cents × 10^−8.
  const k = threeSignificant(absCents, -5);
  if (Number(k.replace(/,/g, '')) < 1_000) return `$${k}k`;
  return `$${threeSignificant(absCents, -8)}M`;
}

/** USD from integer cents in one of the 13.2 styles. */
export function usdFromCents(cents: number, options: MoneyOptions = {}): string {
  const c = roundHalfAway(cents);
  const abs = Math.abs(c);
  const zero = c === 0;
  const neg = c < 0;
  const style = options.style ?? 'general';
  switch (style) {
    case 'ledger':
      return `${sign(neg, options.plus, zero)}${exactCents(abs)}`;
    case 'statement': {
      const body = wholeDollars(abs);
      return neg && body !== '$0' ? `(${body})` : body;
    }
    case 'compact':
      if (abs >= uiConfig['ui.fmt.compactAboveUsd'] * 100) {
        return `${sign(neg, options.plus, zero)}${compactDollars(abs)}`;
      }
      return usdFromCents(c, { ...options, style: 'general' });
    case 'general': {
      const showCents = abs < uiConfig['ui.fmt.centsHiddenAboveUsd'] * 100;
      const body = showCents ? exactCents(abs) : wholeDollars(abs);
      const shownZero = body === '$0' || body === '$0.00';
      return `${sign(neg, options.plus, shownZero)}${body}`;
    }
  }
}

/** USD from float dollars (explanation trees), rounded to cents first. */
export function usd(dollars: number, options: MoneyOptions = {}): string {
  return usdFromCents(dollarsToCents(dollars), options);
}

/** Unit costs always carry 2 decimals (`$13.60/bcy`, `$212.40/hr`; 13.2), whatever their size. */
export function unitCost(dollars: number, suffix: string, options: { readonly plus?: boolean } = {}): string {
  const c = dollarsToCents(dollars);
  return `${sign(c < 0, options.plus, c === 0)}${exactCents(Math.abs(c))}${suffix}`;
}

/** Gold price: general money with the per-ounce suffix (`$4,200/fine oz`; cents hidden above $1,000). */
export function goldPrice(dollarsPerOz: number, kind: 'raw' | 'fine' = 'fine'): string {
  return `${usd(dollarsPerOz)}/${kind} oz`;
}
