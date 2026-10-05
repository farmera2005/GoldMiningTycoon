// Stateless named RNG streams (DESIGN §2.3 item 1, D-2.1). There is no RNG object in GameState: a stream is derived on
// demand from (seed, stream name, key parts), so adding a draw to one system cannot shift another system's dice
// ("stream isolation"), and nothing about randomness needs saving.
//
// Derivation (pinned by test vectors in rng.test.ts; changing any step changes every game):
//   1. Key bytes: the UTF-8 encoding of [seed, stream, ...keys] joined with the byte 0x1F (unit separator). String
//      parts are encoded as written; integer parts as base-10 text (negative allowed, −0 prints as 0), so the integer 5
//      and the string '5' are the same key part. Parts may not contain U+001F (it would make two keys collide) or lone
//      surrogates; floats, NaN, ±∞ and unsafe integers are rejected (the type says number, the runtime says integer).
//   2. h = 64-bit FNV-1a over the key bytes (offset 0xcbf29ce484222325, prime 0x100000001b3).
//   3. SplitMix64 seeded with h: state += 0x9e3779b97f4a7c15, then the finalizer
//      z = (z ^ z>>>30)·0xbf58476d1ce4e5b9; z = (z ^ z>>>27)·0x94d049bb133111eb; z ^= z>>>31.
//      Two successive outputs o1, o2 give the 128-bit xoshiro128** state s = [lo(o1), hi(o1), lo(o2), hi(o2)].
//      The finalizer is a bijection fixing only 0, and h+γ and h+2γ cannot both be 0, so s is never all zero.
//   4. xoshiro128** (Blackman & Vigna 2018): result = rotl(s1·5, 7)·9, then the standard state transition.
// All 64-bit arithmetic is done in unsigned 32-bit halves with Math.imul, so it is exact in every engine.
import { invariant } from './assert';
import { exp, log, normInv, pow, sqrt } from './dmath';
import { fnv1a64 } from './hash';
import { isStreamName, type StreamName } from './streams';

/** A key part: a string, or a safe integer (floats are rejected at runtime). */
export type KeyPart = string | number;

/**
 * A stream of draws. Draw counts are fixed and documented per method so owners can document their streams' draw order
 * (§2.3 rule e). One "u32 draw" is one xoshiro128** step.
 */
export interface Rng {
  /** Uniform integer in [0, 2^32). 1 u32 draw. */
  nextU32(): number;
  /** Uniform in [0, 1) with 53 random bits. 2 u32 draws. */
  next(): number;
  /**
   * Uniform integer in [lo, hiInclusive], exactly unbiased by rejection. For a range ≤ 2^32: 1 u32 draw per attempt,
   * and a retry happens with probability < range/2^32 (< 1e-6 for ranges below 4,295). Larger ranges (≤ 2^53): 2 u32
   * draws per attempt, retry probability < range/2^53. A range of 1 still takes its draw.
   */
  int(lo: number, hiInclusive: number): number;
  /** True with probability p (p ≤ 0 never, p ≥ 1 always; NaN throws). 1 next() (2 u32 draws), always taken. */
  bool(p: number): boolean;
  /** Normal(mean, sd) by inversion: exactly 1 next()-sized draw (2 u32) through dmath.normInv. */
  normal(mean?: number, sd?: number): number;
  /** exp(Normal(mu, sigma)): 2 u32 draws. */
  lognormal(mu: number, sigma: number): number;
  /**
   * Gamma(shape, scale), mean shape·scale. Marsaglia–Tsang: each attempt takes 1 normal (2 u32) and, unless the
   * candidate is rejected outright (v ≤ 0), 1 uniform (2 u32); acceptance is ≥ 95% per attempt for shape ≥ 1. For
   * shape < 1 it samples Gamma(shape + 1) and then takes 1 more uniform (2 u32) for the U^(1/shape) boost.
   */
  gamma(shape: number, scale?: number): number;
  /** Beta(a, b) = X/(X+Y) with X ~ Gamma(a), Y ~ Gamma(b), drawn in that order. */
  beta(a: number, b: number): number;
  /**
   * Poisson(lambda): exactly 1 next()-sized draw (2 u32). λ < 30: exact inversion of the CDF. λ ≥ 30: the normal
   * approximation max(0, round(λ + √λ·Z)) with Z = normInv(u), as §3 step 5 specifies (D-3.11).
   */
  poisson(lambda: number): number;
  /** A uniformly chosen element (1 int draw). Throws on an empty array. */
  pick<T>(arr: readonly T[]): T;
  /**
   * Index i with probability weights[i] / Σ weights. 1 next() (2 u32 draws). Weights must be finite and ≥ 0 with a
   * positive sum; zero-weight entries are never returned.
   */
  weighted(weights: readonly number[]): number;
  /** Fisher–Yates on a copy (the input is not modified): n − 1 int draws, for i = n−1 … 1, j = int(0, i). */
  shuffle<T>(arr: readonly T[]): T[];
  /** Number of u32 draws taken so far (tests and draw-order documentation). */
  readonly drawCount: number;
}

const UNIT_SEPARATOR = '\u001f';
const TWO_32 = 4294967296;
const TWO_53 = 9007199254740992;
const TWO_26 = 67108864;

function isLoneSurrogateFree(s: string): boolean {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) {
      const n = i + 1 < s.length ? s.charCodeAt(i + 1) : 0;
      if (n < 0xdc00 || n > 0xdfff) return false;
      i++;
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function encodePart(part: KeyPart, index: number): string {
  if (typeof part === 'number') {
    if (!Number.isSafeInteger(part)) {
      throw new TypeError(`rng: key part ${index} must be a string or a safe integer, got ${String(part)}`);
    }
    return String(part === 0 ? 0 : part);
  }
  if (typeof part !== 'string') throw new TypeError(`rng: key part ${index} must be a string or a safe integer`);
  if (part.includes(UNIT_SEPARATOR)) throw new TypeError(`rng: key part ${index} contains U+001F`);
  if (!isLoneSurrogateFree(part)) throw new TypeError(`rng: key part ${index} contains a lone surrogate`);
  return part;
}

/** The exact key text whose UTF-8 bytes are hashed: [seed, stream, ...keys] joined with U+001F. */
export function encodeKey(seed: string, stream: string, keys: readonly KeyPart[]): string {
  let text = encodePart(seed, 0) + UNIT_SEPARATOR + encodePart(stream, 1);
  for (let i = 0; i < keys.length; i++) text += UNIT_SEPARATOR + encodePart(keys[i] as KeyPart, i + 2);
  return text;
}

// ---------------------------------------------------------------------------------------------------------------------
// 64-bit helpers in 32-bit halves
// ---------------------------------------------------------------------------------------------------------------------

/** (aHi:aLo) · (bHi:bLo) mod 2^64. The low×low product's high half is built from 16-bit limbs to stay exact. */
function mul64(aHi: number, aLo: number, bHi: number, bLo: number): [number, number] {
  const a0 = aLo & 0xffff;
  const a1 = aLo >>> 16;
  const b0 = bLo & 0xffff;
  const b1 = bLo >>> 16;
  const p00 = a0 * b0;
  const p01 = a0 * b1;
  const p10 = a1 * b0;
  const p11 = a1 * b1;
  const mid = (p00 >>> 16) + (p01 & 0xffff) + (p10 & 0xffff);
  const loHi = p11 + (p01 >>> 16) + (p10 >>> 16) + (mid >>> 16); // high 32 bits of aLo·bLo (< 2^34, exact)
  const lo = Math.imul(aLo, bLo) >>> 0;
  const hi = (Math.imul(aHi, bLo) + Math.imul(aLo, bHi) + loHi) >>> 0;
  return [hi, lo];
}

const GOLDEN_HI = 0x9e3779b9;
const GOLDEN_LO = 0x7f4a7c15;
const MIX1_HI = 0xbf58476d;
const MIX1_LO = 0x1ce4e5b9;
const MIX2_HI = 0x94d049bb;
const MIX2_LO = 0x133111eb;

/** The SplitMix64 finalizer (a bijection on 64-bit values). */
function splitMix64Mix(hi: number, lo: number): [number, number] {
  // z ^= z >>> 30
  let zLo = (lo ^ ((lo >>> 30) | (hi << 2))) >>> 0;
  let zHi = (hi ^ (hi >>> 30)) >>> 0;
  [zHi, zLo] = mul64(zHi, zLo, MIX1_HI, MIX1_LO);
  // z ^= z >>> 27
  zLo = (zLo ^ ((zLo >>> 27) | (zHi << 5))) >>> 0;
  zHi = (zHi ^ (zHi >>> 27)) >>> 0;
  [zHi, zLo] = mul64(zHi, zLo, MIX2_HI, MIX2_LO);
  // z ^= z >>> 31
  zLo = (zLo ^ ((zLo >>> 31) | (zHi << 1))) >>> 0;
  zHi = (zHi ^ (zHi >>> 31)) >>> 0;
  return [zHi, zLo];
}

/** SplitMix64 from a 64-bit seed: returns `count` successive outputs as [hi, lo] pairs (exported for test vectors). */
export function splitMix64(seedHi: number, seedLo: number, count: number): [number, number][] {
  let sHi = seedHi >>> 0;
  let sLo = seedLo >>> 0;
  const out: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const lo = sLo + GOLDEN_LO;
    sHi = (sHi + GOLDEN_HI + (lo >= TWO_32 ? 1 : 0)) >>> 0;
    sLo = lo >>> 0;
    out.push(splitMix64Mix(sHi, sLo));
  }
  return out;
}

/** The 128-bit xoshiro128** state for a key, as four u32 words [s0, s1, s2, s3] (see the derivation above). */
export function streamState(seed: string, stream: StreamName, ...keys: KeyPart[]): [number, number, number, number] {
  if (!isStreamName(stream)) throw new TypeError(`rng: unregistered stream '${String(stream)}'`);
  const h = fnv1a64(encodeKey(seed, stream, keys));
  const [o1, o2] = splitMix64(h.hi, h.lo, 2) as [[number, number], [number, number]];
  const s: [number, number, number, number] = [o1[1], o1[0], o2[1], o2[0]];
  invariant((s[0] | s[1] | s[2] | s[3]) !== 0, 'xoshiro128** state must not be all zero');
  return s;
}

// ---------------------------------------------------------------------------------------------------------------------
// xoshiro128** and the samplers
// ---------------------------------------------------------------------------------------------------------------------

class Xoshiro128StarStar implements Rng {
  private s0: number;
  private s1: number;
  private s2: number;
  private s3: number;
  private draws = 0;

  constructor(state: readonly [number, number, number, number]) {
    this.s0 = state[0] | 0;
    this.s1 = state[1] | 0;
    this.s2 = state[2] | 0;
    this.s3 = state[3] | 0;
  }

  get drawCount(): number {
    return this.draws;
  }

  nextU32(): number {
    const s1 = this.s1;
    const m = Math.imul(s1, 5);
    const result = Math.imul((m << 7) | (m >>> 25), 9) >>> 0;
    const t = s1 << 9;
    this.s2 ^= this.s0;
    this.s3 ^= this.s1;
    this.s1 ^= this.s2;
    this.s0 ^= this.s3;
    this.s2 ^= t;
    this.s3 = (this.s3 << 11) | (this.s3 >>> 21);
    this.draws++;
    return result;
  }

  next(): number {
    const a = this.nextU32() >>> 5; // 27 bits
    const b = this.nextU32() >>> 6; // 26 bits
    return (a * TWO_26 + b) / TWO_53;
  }

  /** Uniform on the open interval (0, 1): (2m + 1)/2^53 with 52 random bits m; symmetric about ½. 2 u32 draws. */
  private nextOpen(): number {
    const a = this.nextU32() >>> 6; // 26 bits
    const b = this.nextU32() >>> 6; // 26 bits
    return (2 * (a * TWO_26 + b) + 1) / TWO_53;
  }

  int(lo: number, hiInclusive: number): number {
    if (!Number.isSafeInteger(lo) || !Number.isSafeInteger(hiInclusive) || hiInclusive < lo) {
      throw new RangeError(`rng.int: need safe integers lo ≤ hi, got [${lo}, ${hiInclusive}]`);
    }
    const range = hiInclusive - lo + 1;
    if (range <= TWO_32) {
      const limit = TWO_32 - (TWO_32 % range);
      for (;;) {
        const u = this.nextU32();
        if (u < limit) return lo + (u % range);
      }
    }
    if (range > TWO_53) throw new RangeError(`rng.int: range ${range} exceeds 2^53`);
    const limit = TWO_53 - (TWO_53 % range);
    for (;;) {
      const a = this.nextU32() >>> 5;
      const b = this.nextU32() >>> 6;
      const u = a * TWO_26 + b;
      if (u < limit) return lo + (u % range);
    }
  }

  bool(p: number): boolean {
    if (Number.isNaN(p)) throw new RangeError('rng.bool: p is NaN');
    return this.next() < p;
  }

  normal(mean = 0, sd = 1): number {
    return mean + sd * normInv(this.nextOpen());
  }

  lognormal(mu: number, sigma: number): number {
    return exp(this.normal(mu, sigma));
  }

  gamma(shape: number, scale = 1): number {
    if (!(shape > 0) || !Number.isFinite(shape)) throw new RangeError(`rng.gamma: shape must be > 0, got ${shape}`);
    if (!(scale > 0) || !Number.isFinite(scale)) throw new RangeError(`rng.gamma: scale must be > 0, got ${scale}`);
    if (shape < 1) {
      const g = this.marsagliaTsang(shape + 1);
      return scale * g * pow(this.nextOpen(), 1 / shape);
    }
    return scale * this.marsagliaTsang(shape);
  }

  /** Marsaglia & Tsang (2000) for shape ≥ 1. */
  private marsagliaTsang(shape: number): number {
    const d = shape - 1 / 3;
    const c = 1 / sqrt(9 * d);
    for (;;) {
      const x = this.normal();
      let v = 1 + c * x;
      if (v <= 0) continue;
      v = v * v * v;
      const u = this.nextOpen();
      const x2 = x * x;
      if (u < 1 - 0.0331 * x2 * x2) return d * v;
      if (log(u) < 0.5 * x2 + d * (1 - v + log(v))) return d * v;
    }
  }

  beta(a: number, b: number): number {
    const x = this.gamma(a);
    const y = this.gamma(b);
    const s = x + y;
    // Both gammas can underflow to 0 for tiny shapes; fall back to the mean rather than return NaN.
    return s > 0 ? x / s : a / (a + b);
  }

  poisson(lambda: number): number {
    if (!(lambda >= 0) || !Number.isFinite(lambda))
      throw new RangeError(`rng.poisson: lambda must be ≥ 0, got ${lambda}`);
    if (lambda >= 30) {
      const z = normInv(this.nextOpen());
      return Math.max(0, Math.round(lambda + sqrt(lambda) * z));
    }
    const u = this.next();
    let k = 0;
    let p = exp(-lambda);
    let cdf = p;
    while (u >= cdf) {
      k++;
      p *= lambda / k;
      const nextCdf = cdf + p;
      if (nextCdf === cdf) break; // the CDF has reached 1 in double precision: u sits in the rounding gap
      cdf = nextCdf;
    }
    return k;
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new RangeError('rng.pick: empty array');
    return arr[this.int(0, arr.length - 1)] as T;
  }

  weighted(weights: readonly number[]): number {
    let total = 0;
    let last = -1;
    for (let i = 0; i < weights.length; i++) {
      const w = weights[i] as number;
      if (!(w >= 0) || !Number.isFinite(w)) throw new RangeError(`rng.weighted: weight ${i} must be finite and ≥ 0`);
      total += w;
      if (w > 0) last = i;
    }
    if (!(total > 0)) throw new RangeError('rng.weighted: weights must have a positive sum');
    const target = this.next() * total;
    let cum = 0;
    for (let i = 0; i < weights.length; i++) {
      const w = weights[i] as number;
      if (w === 0) continue;
      cum += w;
      if (target < cum) return i;
    }
    return last; // rounding left target ≥ the running sum: the last positive weight takes it
  }

  shuffle<T>(arr: readonly T[]): T[] {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      const tmp = out[i] as T;
      out[i] = out[j] as T;
      out[j] = tmp;
    }
    return out;
  }
}

/**
 * A fresh stream for (seed, stream, ...keys). Same arguments ⇒ the identical sequence, in every engine. Owners key
 * weekly draws on `turn`, generation on entity ids and action-time draws on subject + per-subject counter (§2.3 c).
 */
export function rng(seed: string, stream: StreamName, ...keys: KeyPart[]): Rng {
  return new Xoshiro128StarStar(streamState(seed, stream, ...keys));
}

/** A stream started from an explicit xoshiro128** state (test vectors and reference checks only). */
export function rngFromState(state: readonly [number, number, number, number]): Rng {
  invariant((state[0] | state[1] | state[2] | state[3]) !== 0, 'xoshiro128** state must not be all zero');
  return new Xoshiro128StarStar(state);
}
