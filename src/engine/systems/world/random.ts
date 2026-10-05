// The distribution shorthands §3's pseudo-code uses, over a core Rng (DESIGN §3.3–§3.8). Each helper documents its
// draw count so the generators' fixed draw orders (§2.3 rule e) can be read off the code.
import { exp, log, sqrt } from '../../core/dmath';
import type { Rng } from '../../core/rng';

/** U(lo, hi): 2 u32. */
export function uniform(r: Rng, lo: number, hi: number): number {
  return lo + (hi - lo) * r.next();
}

/** U(pair). */
export function uniformIn(r: Rng, range: readonly [number, number]): number {
  return uniform(r, range[0], range[1]);
}

/** U{lo..hi} for an inclusive integer pair: 1 u32 (rejection retries are vanishingly rare). */
export function intIn(r: Rng, range: readonly [number, number]): number {
  return r.int(range[0], range[1]);
}

/** LN(median, σ) = median × e^(σZ): 2 u32. A zero median still takes its draw (rule e) and returns 0. */
export function lnMedian(r: Rng, median: number, sigma: number): number {
  return median * exp(sigma * r.normal());
}

/** σ² of the mean-one lognormal with coefficient of variation cv: ln(1 + cv²). */
export function lnVarOfCv(cv: number): number {
  return log(1 + cv * cv);
}

/** LNmean(1, cv) = e^(σZ − σ²/2), σ² = ln(1 + cv²) (§3.8): 2 u32, taken even when cv = 0. */
export function lnMeanOne(r: Rng, cv: number): number {
  const s2 = lnVarOfCv(cv);
  return exp(sqrt(s2) * r.normal() - s2 / 2);
}

/** Mean-one lognormal with a precomputed σ² (the de Wijs local factor). 2 u32. */
export function lnMeanOneVar(r: Rng, s2: number): number {
  return exp(sqrt(s2) * r.normal() - s2 / 2);
}

/**
 * A weighted pick over a canonical key list (absent keys weigh 0). One `weighted` draw (2 u32). Using the canonical
 * list, never object key order, keeps the pick independent of how the data object was written.
 */
export function pickKey<K extends string>(r: Rng, keys: readonly K[], weights: Readonly<Partial<Record<K, number>>>): K {
  const w = keys.map((k) => weights[k] ?? 0);
  return keys[r.weighted(w)] as K;
}

/**
 * Poisson with the §3.8 switch at `normalLambda` (D-3.11): exact inversion below it, max(0, round(λ + √λ·Z)) above.
 * Both branches take one next()-sized draw (2 u32).
 */
export function poissonSwitch(r: Rng, lambda: number, normalLambda: number): number {
  if (!(lambda > 0)) {
    r.next();
    return 0;
  }
  if (lambda >= normalLambda || lambda >= 700) {
    return Math.max(0, Math.round(lambda + sqrt(lambda) * r.normal()));
  }
  const u = r.next();
  let k = 0;
  let p = exp(-lambda);
  let cdf = p;
  while (u >= cdf) {
    k++;
    p *= lambda / k;
    const next = cdf + p;
    if (next === cdf) break;
    cdf = next;
  }
  return k;
}

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export function logistic(x: number): number {
  return 1 / (1 + exp(-x));
}

export function logit(p: number): number {
  return log(p / (1 - p));
}
