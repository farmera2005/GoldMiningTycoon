// Gold quantities (DESIGN §13.2, §2.4, D-13.15): 3 dp below 100 oz and 2 dp at or above it, matching 0.001 oz
// weighing on small lots without false precision on large totals. Every ounce says raw or fine; "raw" means weighed
// raw, except in grades and estimates, where it means metal (§2.4), so metal oz are labelled raw too.
import { uiConfig } from '../../data/tuning/ui';
import { fixed, roundedParts } from './numbers';

export type OzKind = 'raw' | 'fine';

export interface GoldOptions {
  readonly plus?: boolean;
  /** The value is in milli-ounces (§2.4 MilliOz), rounded from the integer's own digits (128,015 → `128.02`). */
  readonly milli?: boolean;
}

/** `52.901 raw oz`, `1,234.50 fine oz`. The threshold applies to the rounded value, so 99.9996 shows `100.00`. */
export function gold(oz: number, kind: OzKind, options: GoldOptions = {}): string {
  const small = uiConfig['ui.fmt.ozDecimalsBelow100'];
  const large = uiConfig['ui.fmt.ozDecimalsAtOrAbove100'];
  const shift = options.milli === true ? -3 : 0;
  const p = roundedParts(oz, small, shift);
  const dp = Number(`${p.int}.${p.frac}`) < 100 ? small : large;
  return `${fixed(oz, dp, { shift, ...(options.plus === undefined ? {} : { plus: options.plus }) })} ${kind} oz`;
}
