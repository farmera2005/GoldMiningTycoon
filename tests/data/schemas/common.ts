// Building blocks shared by every per-area schema file (tests/data/schemas.ts is the index). TypeScript's `satisfies`
// checks shapes but not values: these add finiteness, ranges where DESIGN states them, mixes that sum to 1 and complete
// enum keys (CLAUDE.md "Content and tuning"; DESIGN §2.10, §2.14 "Data validation", D-2.7).
import { z } from 'zod';

export const MIX_TOLERANCE = 1e-9;

/** zod 4's number already rejects NaN and ±Infinity. */
export const num = z.number();
export const nonNeg = z.number().nonnegative();
export const pos = z.number().positive();
export const prob = z.number().min(0).max(1);
export const int = z.number().int();
export const nonNegInt = z.number().int().nonnegative();
export const posInt = z.number().int().positive();
/** A 0–100 score (reputation, standing, skill, safety record, morale). */
export const score = z.number().min(0).max(100);

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);
const sumsToOne = (xs: readonly number[]): boolean => Math.abs(sum(xs) - 1) <= MIX_TOLERANCE;

/** A [lo, hi] pair with lo ≤ hi. */
export function range(inner: z.ZodNumber = num) {
  return z.tuple([inner, inner]).refine(([lo, hi]) => lo <= hi, { message: 'range lo > hi' });
}

/** An object with exactly these keys, each matching `inner`. */
export function keyed<K extends string>(keys: readonly K[], inner: z.ZodType) {
  const shape = {} as Record<K, z.ZodType>;
  for (const k of keys) shape[k] = inner;
  return z.strictObject(shape);
}

/** Some of these keys (none other), each matching `inner`. */
export function someOf<K extends string>(keys: readonly K[], inner: z.ZodType) {
  const shape = {} as Record<K, z.ZodOptional<z.ZodType>>;
  for (const k of keys) shape[k] = inner.optional();
  return z.strictObject(shape);
}

/** Exactly these keys, probabilities summing to 1. */
export function mixOf<K extends string>(keys: readonly K[]) {
  return keyed(keys, prob).refine((m) => sumsToOne(Object.values(m) as number[]), { message: 'mix must sum to 1' });
}

/** Some of these keys, probabilities summing to 1 (a template's mix over the classes it uses). */
export function partialMixOf<K extends string>(keys: readonly K[]) {
  return someOf(keys, prob).refine((m) => sumsToOne(Object.values(m) as number[]), { message: 'mix must sum to 1' });
}

/** A fixed-length array of probabilities summing to 1. */
export function mixArray(n: number) {
  return z
    .array(prob)
    .length(n)
    .refine((xs) => sumsToOne(xs), { message: 'mix must sum to 1' });
}

/** An array whose values strictly increase (cut points, thresholds, month lists), optionally of a fixed length. */
export function increasing(inner: z.ZodNumber = num, length?: number) {
  const arr = length === undefined ? z.array(inner).min(1) : z.array(inner).length(length);
  return arr.refine((xs) => xs.every((x, i) => i === 0 || (xs[i - 1] as number) < x), {
    message: 'values must increase',
  });
}

/** A lognormal law LN(median, sigma), optionally clamped to [lo, hi] around its median. */
export const lnLaw = z
  .object({ median: pos, sigma: nonNeg, lo: pos.optional(), hi: pos.optional() })
  .refine((l) => (l.lo ?? 0) <= l.median && l.median <= (l.hi ?? Infinity), { message: 'need lo ≤ median ≤ hi' });

/** Every `xLo` / `xHi` pair of an object is ordered (the §3 tables write ranges as two fields). */
export function loHiOrdered(o: Readonly<Record<string, unknown>>): boolean {
  for (const k of Object.keys(o)) {
    if (!k.endsWith('Lo')) continue;
    const hi = o[`${k.slice(0, -2)}Hi`];
    const lo = o[k];
    if (typeof lo === 'number' && typeof hi === 'number' && lo > hi) return false;
  }
  return true;
}

/** Values that must not decrease in the listed key order (a ladder such as budget ≤ standard ≤ premier). */
export function ascending(keys: readonly string[], strict = false) {
  return (o: Readonly<Record<string, unknown>>): boolean => {
    for (let i = 1; i < keys.length; i++) {
      const a = o[keys[i - 1] as string];
      const b = o[keys[i] as string];
      if (typeof a !== 'number' || typeof b !== 'number' || (strict ? !(a < b) : a > b)) return false;
    }
    return true;
  };
}

export const tuningValue: z.ZodType = z.lazy(() =>
  z.union([num, z.string(), z.boolean(), z.array(tuningValue), z.record(z.string(), tuningValue)]),
);

/** The four gold size classes (§3.5.3), the key set of every size record. */
export const SIZE_CLASSES = ['coarse', 'medium', 'fine', 'ultrafine'] as const;
export const sizeRecord = (inner: z.ZodType) => keyed(SIZE_CLASSES, inner);
