// Statistics for the balance scorecard (BALANCE §3.0): proportions carry a 95% Wilson interval; medians, other
// quantiles and ratios carry a seeded 95% percentile-bootstrap interval of `sim.bootstrapResamples` resamples. Every
// function is deterministic (the bootstrap draws from its own seeded generator), so the same games give the same
// summary.json byte for byte whatever the worker count.

/** z for a two-sided 95% interval. */
export const Z95 = 1.959963984540054;

/** A measured value with its 95% interval. `value` null means not computable (printed n/a). */
export interface Estimate {
  value: number | null;
  ci: [number, number] | null;
  /** Observations behind the value. */
  n: number;
}

/** A proportion k / n with its Wilson interval. */
export interface Proportion extends Estimate {
  k: number;
}

export const NA_ESTIMATE: Estimate = { value: null, ci: null, n: 0 };

/** Rounds to 6 decimals so the JSON reads cleanly; deterministic (no locale, no toFixed parsing). */
export function round6(x: number): number {
  const r = Math.round(x * 1e6) / 1e6;
  return r === 0 ? 0 : r;
}

/**
 * Wilson score interval for k successes in n trials (Wilson 1927). Unlike the normal approximation it stays inside
 * [0, 1] and behaves at 0 and n, which the rare-rate targets need (BALANCE §6.3: rates near 5%).
 */
export function wilsonInterval(k: number, n: number, z: number = Z95): [number, number] | null {
  if (!Number.isInteger(k) || !Number.isInteger(n) || k < 0 || n < 0 || k > n) {
    throw new RangeError(`wilsonInterval: need integers 0 ≤ k ≤ n, got k=${k} n=${n}`);
  }
  if (n === 0) return null;
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z / denom) * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n));
  // At k = 0 and k = n the edge is exactly 0 or 1; floating cancellation would leave 1 − 1e-16.
  return [k === 0 ? 0 : Math.max(0, center - half), k === n ? 1 : Math.min(1, center + half)];
}

/** A proportion estimate over booleans; null entries (not computable for that game) are left out. */
export function proportion(flags: readonly (boolean | null)[]): Proportion {
  let k = 0;
  let n = 0;
  for (const f of flags) {
    if (f === null) continue;
    n++;
    if (f) k++;
  }
  if (n === 0) return { value: null, ci: null, n: 0, k: 0 };
  const ci = wilsonInterval(k, n) as [number, number];
  return { value: round6(k / n), ci: [round6(ci[0]), round6(ci[1])], n, k };
}

/**
 * The quantile of sorted data by Hyndman & Fan's type 7 (the R and NumPy default): with h = (n − 1)p,
 * Q(p) = x[⌊h⌋] + (h − ⌊h⌋)(x[⌊h⌋ + 1] − x[⌊h⌋]). The one quantile method of the simulator.
 */
export function quantileSorted(sorted: readonly number[], p: number): number | null {
  if (!(p >= 0 && p <= 1)) throw new RangeError(`quantile: p must be in [0, 1], got ${p}`);
  const n = sorted.length;
  if (n === 0) return null;
  const h = (n - 1) * p;
  const lo = Math.floor(h);
  const xLo = sorted[lo] as number;
  if (lo + 1 >= n) return xLo;
  const xHi = sorted[lo + 1] as number;
  return xLo + (h - lo) * (xHi - xLo);
}

export function sortNumbers(values: readonly number[]): number[] {
  return [...values].sort((a, b) => a - b);
}

/** The type-7 quantile of unsorted data, ignoring nulls. */
export function quantile(values: readonly (number | null)[], p: number): number | null {
  return quantileSorted(sortNumbers(values.filter((v): v is number => v !== null)), p);
}

export function mean(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  let s = 0;
  for (const v of values) s += v;
  return s / values.length;
}

/** 32-bit FNV-1a of a string: seeds the bootstrap from the cell and metric names. */
export function fnv1a32(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** mulberry32: a small, fast, well-mixed 32-bit generator; sim-side only (the engine has its own rng). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The type-7 quantile of one bootstrap resample of `sorted`, without sorting the resample: count how often each
 * sorted index was drawn, then walk the cumulative counts to the two order statistics the quantile needs.
 */
function resampleQuantile(sorted: readonly number[], p: number, next: () => number, counts: Uint32Array): number {
  const n = sorted.length;
  counts.fill(0);
  for (let i = 0; i < n; i++) {
    const j = Math.min(n - 1, Math.floor(next() * n));
    counts[j] = (counts[j] ?? 0) + 1;
  }
  const h = (n - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.min(lo + 1, n - 1);
  let cum = 0;
  let xLo = Number.NaN;
  let xHi = Number.NaN;
  for (let j = 0; j < n; j++) {
    cum += counts[j] as number;
    if (Number.isNaN(xLo) && cum > lo) xLo = sorted[j] as number;
    if (cum > hi) {
      xHi = sorted[j] as number;
      break;
    }
  }
  return xLo + (h - lo) * (xHi - xLo);
}

export interface BootstrapOptions {
  resamples: number;
  /** Any string; the same key gives the same interval. */
  seedKey: string;
}

/**
 * Seeded 95% percentile-bootstrap interval of the type-7 p-quantile (BALANCE §3.0: "medians and ratios carry a 95%
 * bootstrap interval (1,000 resamples, seeded)"). The interval is the type-7 2.5% and 97.5% quantiles of the
 * resampled statistic.
 */
export function bootstrapQuantile(values: readonly (number | null)[], p: number, opts: BootstrapOptions): Estimate {
  const sorted = sortNumbers(values.filter((v): v is number => v !== null));
  const point = quantileSorted(sorted, p);
  if (point === null) return NA_ESTIMATE;
  const next = mulberry32(fnv1a32(opts.seedKey));
  const counts = new Uint32Array(sorted.length);
  const stats: number[] = [];
  for (let b = 0; b < opts.resamples; b++) stats.push(resampleQuantile(sorted, p, next, counts));
  const dist = sortNumbers(stats);
  const lo = quantileSorted(dist, 0.025) as number;
  const hi = quantileSorted(dist, 0.975) as number;
  return { value: round6(point), ci: [round6(lo), round6(hi)], n: sorted.length };
}

/** Half the width of an interval (the dominance rule's "95% half-width", BALANCE §5.9). */
export function halfWidth(e: Estimate): number | null {
  return e.ci === null ? null : (e.ci[1] - e.ci[0]) / 2;
}

/** A standard error recovered from a 95% interval (half-width ÷ z), for the baseline's 2-SE warning (§6.7). */
export function standardErrorOf(e: Estimate): number | null {
  const h = halfWidth(e);
  return h === null ? null : h / Z95;
}
