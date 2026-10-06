// Money and traded gold (DESIGN §2.4, D-2.2). Money in state is integer cents; formulas compute in float dollars or
// cents and round once, at ledger posting, half away from zero. Gold that changes hands moves in integer milli-ounces;
// weighing floors to 0.001 oz and the remainder stays in the box (§7). Flows and estimates stay float metal oz.

/** Integer US cents. */
export type Cents = number & { readonly __brand: 'Cents' };
/** Integer troy milli-ounces (weighed raw or fine, as the field name says; never metal-in-ground). */
export type MilliOz = number & { readonly __brand: 'MilliOz' };

export const ZERO_CENTS = 0 as Cents;
export const ZERO_MILLI_OZ = 0 as MilliOz;

function assertSafeInteger(n: number, what: string): void {
  if (!Number.isSafeInteger(n)) throw new RangeError(`${what} must be a safe integer, got ${n}`);
}

/** Brands an integer as Cents (throws on fractions, NaN and unsafe values). −0 becomes 0. */
export function cents(n: number): Cents {
  assertSafeInteger(n, 'cents');
  return (n === 0 ? 0 : n) as Cents;
}

/** Brands an integer as MilliOz. −0 becomes 0. */
export function milliOz(n: number): MilliOz {
  assertSafeInteger(n, 'milliOz');
  return (n === 0 ? 0 : n) as MilliOz;
}

/**
 * Round half away from zero to an integer: roundHalfAway(2.5) = 3, roundHalfAway(−0.5) = −1. Integers (including
 * those above 2^52, where adding ½ would round) pass through unchanged; −0 becomes 0.
 */
export function roundHalfAway(x: number): number {
  if (!Number.isFinite(x)) throw new RangeError(`roundHalfAway: non-finite ${x}`);
  if (Number.isInteger(x)) return x === 0 ? 0 : x;
  // floor(|x| + 0.5) would misround 0.49999999999999994 (the sum rounds up to 1); the fraction |x| − floor(|x|) is
  // exact for non-integers (|x| < 2^52), so compare it instead.
  const ax = Math.abs(x);
  const whole = Math.floor(ax);
  const r = ax - whole >= 0.5 ? whole + 1 : whole;
  return x < 0 ? (r === 0 ? 0 : -r) : r;
}

/** Rounds a float amount of cents to integer Cents, half away from zero (the ledger-posting rule, D-2.2). */
export function roundCents(x: number): Cents {
  return cents(roundHalfAway(x));
}

/**
 * Rounds x × 10^k half away from zero, treating a product within 1e-11 (relative) of a half-unit tie as the tie.
 * Decimal amounts such as $1.005 are not exact in binary (1.005 × 100 = 100.49999999999999), so rounding the float
 * product would send them down while §13.2's display rule (Intl halfExpand on the shortest decimal) sends them up;
 * snapping keeps the ledger and the screen in agreement, as floorMilliOz does for weighing (D-2.2).
 */
function roundScaledHalfAway(x: number, scale: number): number {
  if (!Number.isFinite(x)) throw new RangeError(`roundScaledHalfAway: non-finite ${x}`);
  const m = x * scale;
  const am = Math.abs(m);
  const tie = Math.floor(am) + 0.5;
  if (Math.abs(am - tie) <= 1e-11 * Math.max(1, am)) {
    const r = Math.floor(am) + 1;
    return m < 0 ? -r : r;
  }
  return roundHalfAway(m);
}

/** Dollars (float) → Cents: one rounding of usd × 100, half away from zero, decimal ties snapped (see above). */
export function usdToCents(usd: number): Cents {
  return cents(roundScaledHalfAway(usd, 100));
}

/** Cents → float dollars (for formulas; never store the result). */
export function centsToUsd(c: Cents): number {
  return c / 100;
}

export function addCents(a: Cents, b: Cents): Cents {
  return cents(a + b);
}

export function subCents(a: Cents, b: Cents): Cents {
  return cents(a - b);
}

export function negCents(a: Cents): Cents {
  return cents(-a);
}

/** Sum of integer cents; exact while every partial sum stays a safe integer (checked). */
export function sumCents(values: readonly Cents[]): Cents {
  let total = 0;
  for (let i = 0; i < values.length; i++) {
    total += values[i] as Cents;
    assertSafeInteger(total, 'sumCents partial sum');
  }
  return cents(total);
}

/** Troy oz → MilliOz, rounded half away from zero, decimal ties snapped (transfers of a weighed amount, in-kind splits). */
export function toMilliOz(oz: number): MilliOz {
  return milliOz(roundScaledHalfAway(oz, 1000));
}

/**
 * Weighing (§2.4, §7): floor to 0.001 oz; the sub-milli-ounce remainder stays in the box. A value within 1e-11
 * (relative) of a milli-ounce boundary snaps to it, so decimal inputs such as 1.005 (1.005 × 1000 = 1004.9999999999999
 * in binary) weigh 1,005 milli-oz rather than 1,004; the snap moves at most ~1e-11 oz relative, far inside the 1e-6 oz
 * conservation check.
 */
export function floorMilliOz(oz: number): MilliOz {
  if (!Number.isFinite(oz)) throw new RangeError(`floorMilliOz: non-finite ${oz}`);
  const m = oz * 1000;
  const nearest = Math.round(m);
  if (Math.abs(m - nearest) <= 1e-11 * Math.max(1, Math.abs(m))) return milliOz(nearest);
  return milliOz(Math.floor(m));
}

/** MilliOz → float troy oz. */
export function milliOzToOz(m: MilliOz): number {
  return m / 1000;
}

export function addMilliOz(a: MilliOz, b: MilliOz): MilliOz {
  return milliOz(a + b);
}

export function subMilliOz(a: MilliOz, b: MilliOz): MilliOz {
  return milliOz(a - b);
}

export function sumMilliOz(values: readonly MilliOz[]): MilliOz {
  let total = 0;
  for (let i = 0; i < values.length; i++) {
    total += values[i] as MilliOz;
    assertSafeInteger(total, 'sumMilliOz partial sum');
  }
  return milliOz(total);
}

/**
 * Splits `total` cents across weights so the parts sum exactly to `total`: each part is rounded half away from zero
 * and the rounding remainder goes to the largest line (ties: the earliest), the §11 posting rule ("any rounding
 * remainder goes to the largest line").
 */
export function allocateCents(total: Cents, weights: readonly number[]): Cents[] {
  if (weights.length === 0) throw new RangeError('allocateCents: no weights');
  let sum = 0;
  for (const w of weights) {
    if (!(w >= 0) || !Number.isFinite(w)) throw new RangeError('allocateCents: weights must be finite and ≥ 0');
    sum += w;
  }
  if (!(sum > 0)) throw new RangeError('allocateCents: weights must have a positive sum');
  const parts = weights.map((w) => roundHalfAway((total * w) / sum));
  let largest = 0;
  for (let i = 1; i < parts.length; i++) {
    if (Math.abs(parts[i] as number) > Math.abs(parts[largest] as number)) largest = i;
  }
  let allocated = 0;
  for (const p of parts) allocated += p;
  parts[largest] = (parts[largest] as number) + (total - allocated);
  return parts.map((p) => cents(p));
}
