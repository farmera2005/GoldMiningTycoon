// USD formatting (DESIGN §13.2 money rows, D-13.13). State money is integer cents; explanation trees carry float
// dollars. Both are rounded to whole cents once (half away from zero, as the engine's roundCents) and then formatted
// with integer arithmetic, so a ledger amount always prints its exact cents.
import { uiConfig } from '../../data/tuning/ui';
import { MINUS, fixed, groupDigits, roundHalfAway } from './numbers';

/** general: cents hidden at or above ui.fmt.centsHiddenAboveUsd · statement: whole dollars, negatives in
 *  parentheses · ledger: exact cents · compact: KPI tiles and chart axes, k/M above ui.fmt.compactAboveUsd. */
export type MoneyStyle = 'general' | 'statement' | 'ledger' | 'compact';

export interface MoneyOptions {
  readonly style?: MoneyStyle;
  /** Prefix `+` on positive values (deltas). */
  readonly plus?: boolean;
}

/** Float dollars → integer cents, half away from zero (the ledger-posting rounding, §2.4). */
export function dollarsToCents(usd: number): number {
  return roundHalfAway(usd * 100);
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

/** Three significant digits with k or M (`$1.23M`, `$412k`); |dollars| ≥ 1,000 (no sign). */
function compactDollars(absDollars: number): string {
  const sig3 = (v: number): string => fixed(v, v >= 100 ? 0 : v >= 10 ? 1 : 2);
  const k = absDollars / 1_000;
  if (Number(sig3(k).replace(/,/g, '')) < 1_000) return `$${sig3(k)}k`;
  const m = absDollars / 1_000_000;
  const mText = Number(sig3(m).replace(/,/g, '')) < 1_000 ? sig3(m) : fixed(m, 0);
  return `$${mText}M`;
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
        return `${sign(neg, options.plus, zero)}${compactDollars(abs / 100)}`;
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
