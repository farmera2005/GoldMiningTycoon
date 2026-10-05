import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { encodeKey, rng, rngFromState, splitMix64, streamState, type KeyPart, type Rng } from './rng';
import type { StreamName } from './streams';

// ---------------------------------------------------------------------------------------------------------------------
// Independent BigInt reference of the §2.3 derivation: FNV-1a 64 → SplitMix64 ×2 → xoshiro128**.
// ---------------------------------------------------------------------------------------------------------------------
const M64 = (1n << 64n) - 1n;

function fnvRef(bytes: Uint8Array): bigint {
  let h = 0xcbf29ce484222325n;
  for (const b of bytes) h = ((h ^ BigInt(b)) * 0x100000001b3n) & M64;
  return h;
}

function splitMixRef(seed: bigint, n: number): bigint[] {
  let s = seed;
  const out: bigint[] = [];
  for (let i = 0; i < n; i++) {
    s = (s + 0x9e3779b97f4a7c15n) & M64;
    let z = s;
    z = ((z ^ (z >> 30n)) * 0xbf58476d1ce4e5b9n) & M64;
    z = ((z ^ (z >> 27n)) * 0x94d049bb133111ebn) & M64;
    out.push(z ^ (z >> 31n));
  }
  return out;
}

function xoshiroRef(state: number[], n: number): number[] {
  const s = state.map((v) => v >>> 0);
  const rotl = (x: number, k: number) => ((x << k) | (x >>> (32 - k))) >>> 0;
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    out.push(Number((BigInt(rotl(Number((BigInt(s[1]!) * 5n) & 0xffffffffn), 7)) * 9n) & 0xffffffffn));
    const t = (s[1]! << 9) >>> 0;
    s[2] = (s[2]! ^ s[0]!) >>> 0;
    s[3] = (s[3]! ^ s[1]!) >>> 0;
    s[1] = (s[1]! ^ s[2]!) >>> 0;
    s[0] = (s[0]! ^ s[3]!) >>> 0;
    s[2] = (s[2]! ^ t) >>> 0;
    s[3] = rotl(s[3]!, 11);
  }
  return out;
}

function referenceDraws(seed: string, stream: string, keys: KeyPart[], n: number): number[] {
  const text = [seed, stream, ...keys.map((k) => String(k))].join('\u001f');
  const [o1, o2] = splitMixRef(fnvRef(new TextEncoder().encode(text)), 2) as [bigint, bigint];
  const words = [o1 & 0xffffffffn, o1 >> 32n, o2 & 0xffffffffn, o2 >> 32n].map(Number);
  return xoshiroRef(words, n);
}

const u32s = (r: Rng, n: number) => Array.from({ length: n }, () => r.nextU32());

describe('key encoding (DESIGN §2.3)', () => {
  it('joins seed, stream and key parts with U+001F, integers in base 10', () => {
    expect(encodeKey('s', 'world', ['dst_000001', 7, -3, 0])).toBe(
      's\u001fworld\u001fdst_000001\u001f7\u001f-3\u001f0',
    );
    expect(encodeKey('s', 'macro', [-0])).toBe('s\u001fmacro\u001f0');
    expect(encodeKey('s', 'macro', [])).toBe('s\u001fmacro');
  });

  it('treats the integer 5 and the string "5" as the same key part', () => {
    expect(u32s(rng('s', 'macro', 5), 4)).toEqual(u32s(rng('s', 'macro', '5'), 4));
  });

  it('rejects float, non-finite and unsafe integer key parts', () => {
    for (const bad of [1.5, NaN, Infinity, -Infinity, 2 ** 53, -(2 ** 53), 0.1 + 0.2]) {
      expect(() => rng('s', 'macro', bad)).toThrow(TypeError);
    }
    expect(() => rng('s', 'macro', Number.MAX_SAFE_INTEGER)).not.toThrow();
  });

  it('rejects separators and lone surrogates inside parts, and unregistered streams', () => {
    expect(() => rng('s', 'macro', 'a\u001fb')).toThrow(/U\+001F/);
    expect(() => rng('s\u001f', 'macro')).toThrow(/U\+001F/);
    expect(() => rng('s', 'macro', 'x\ud800')).toThrow(/lone surrogate/);
    expect(() => rng('s', 'not-a-stream' as StreamName)).toThrow(/unregistered stream/);
    expect(() => rng('s', 'macro', 'ok 𝄞 é')).not.toThrow();
  });
});

describe('derivation vectors (pinned)', () => {
  it('SplitMix64 matches the published sequence for seed 1234567', () => {
    const out = splitMix64(0, 1234567, 5).map(([hi, lo]) => ((BigInt(hi) << 32n) | BigInt(lo)).toString());
    expect(out).toEqual([
      '6457827717110365317',
      '3203168211198807973',
      '9817491932198370423',
      '4593380528125082431',
      '16408922859458223821',
    ]);
  });

  it('xoshiro128** matches the reference sequence for state {1, 2, 3, 4}', () => {
    expect(u32s(rngFromState([1, 2, 3, 4]), 10)).toEqual([
      11520, 0, 5927040, 70819200, 2031721883, 1637235492, 1287239034, 3734860849, 3729100597, 4258142804,
    ]);
  });

  it('pins the state and first draws of fixed keys', () => {
    expect(streamState('seed-1', 'world', 'dst_000001', 'clm_000001')).toEqual([
      3394733449, 2169538188, 2777801461, 1661152472,
    ]);
    const r = rng('seed-1', 'gold-price', 0);
    expect(r.nextU32()).toBe(326336917);
    expect(r.nextU32()).toBe(786076650);
    expect(r.next()).toBe(0.8563564044746106);
    expect(r.normal()).toBe(-0.1595399062164638);
    expect(r.poisson(3)).toBe(4);
    expect(r.gamma(2.5)).toBe(1.723069662028914);
  });

  it('matches an independent BigInt implementation for arbitrary keys', () => {
    const part = fc.oneof(
      fc.integer({ min: -1_000_000, max: 1_000_000 }),
      fc.string({ maxLength: 12 }).filter((s) => !s.includes('\u001f')),
    );
    fc.assert(
      fc.property(
        fc.string({ maxLength: 10 }).filter((s) => !s.includes('\u001f')),
        fc.array(part, { maxLength: 4 }),
        (seed, keys) => {
          expect(u32s(rng(seed, 'fleet-fail', ...keys), 6)).toEqual(referenceDraws(seed, 'fleet-fail', keys, 6));
        },
      ),
      { numRuns: 300 },
    );
  });
});

describe('stream identity and isolation', () => {
  it('gives identical streams for equal keys', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 8 }), fc.integer({ min: -200, max: 5000 }), (seed, turn) => {
        if (seed.includes('\u001f')) return;
        const a = rng(seed, 'fleet-fail', turn, 'mch_000003');
        const b = rng(seed, 'fleet-fail', turn, 'mch_000003');
        expect([a.next(), a.normal(), a.int(0, 9), a.poisson(4.2)]).toEqual([
          b.next(),
          b.normal(),
          b.int(0, 9),
          b.poisson(4.2),
        ]);
      }),
    );
  });

  it('separates streams, seeds and every key part', () => {
    const base = u32s(rng('seed', 'fleet-fail', 10, 'mch_000001'), 4);
    expect(u32s(rng('seed', 'fleet-symptom', 10, 'mch_000001'), 4)).not.toEqual(base);
    expect(u32s(rng('seed2', 'fleet-fail', 10, 'mch_000001'), 4)).not.toEqual(base);
    expect(u32s(rng('seed', 'fleet-fail', 11, 'mch_000001'), 4)).not.toEqual(base);
    expect(u32s(rng('seed', 'fleet-fail', 10, 'mch_000002'), 4)).not.toEqual(base);
    expect(u32s(rng('seed', 'fleet-fail', 10), 4)).not.toEqual(base);
    // part boundaries matter: ('ab','c') ≠ ('a','bc')
    expect(u32s(rng('seed', 'world', 'ab', 'c'), 4)).not.toEqual(u32s(rng('seed', 'world', 'a', 'bc'), 4));
  });

  it('gives no identical first draws across 10^6 distinct keys', () => {
    const seen = new Set<number>();
    for (let i = 0; i < 1_000_000; i++) seen.add(rng('dup-check', 'ops-grade', i, 'clm_000001').next());
    expect(seen.size).toBe(1_000_000);
  });
});

// ---------------------------------------------------------------------------------------------------------------------
// Samplers: moments within 5 standard errors on fixed streams, plus documented draw counts.
// ---------------------------------------------------------------------------------------------------------------------

function moments(xs: number[]): { mean: number; variance: number } {
  let m = 0;
  for (const x of xs) m += x;
  m /= xs.length;
  let v = 0;
  for (const x of xs) v += (x - m) ** 2;
  return { mean: m, variance: v / (xs.length - 1) };
}

function sample(n: number, label: string, draw: (r: Rng) => number): number[] {
  const r = rng('moments', 'world', label);
  return Array.from({ length: n }, () => draw(r));
}

function expectMoments(xs: number[], mean: number, variance: number, kurtosisExcess = 0): void {
  const n = xs.length;
  const m = moments(xs);
  expect(Math.abs(m.mean - mean)).toBeLessThan(5 * Math.sqrt(variance / n));
  // SE of the sample variance ≈ σ²·√((2 + κ)/n) with κ the excess kurtosis.
  expect(Math.abs(m.variance - variance)).toBeLessThan(5 * variance * Math.sqrt((2 + kurtosisExcess) / n));
}

describe('samplers', () => {
  const N = 200_000;

  it('next() is uniform on [0, 1) with 53-bit resolution', () => {
    const xs = sample(N, 'next', (r) => r.next());
    expectMoments(xs, 0.5, 1 / 12, -1.2);
    expect(xs.every((x) => x >= 0 && x < 1)).toBe(true);
    // every value is a multiple of 2^-53, and the low 21 bits are actually used
    expect(xs.every((x) => Number.isInteger(x * 2 ** 53))).toBe(true);
    expect(xs.some((x) => !Number.isInteger(x * 2 ** 32))).toBe(true);
  });

  it('int() is unbiased over its range (chi-square), including ranges above 2^32', () => {
    const counts = new Array<number>(7).fill(0);
    const r = rng('moments', 'world', 'int');
    for (let i = 0; i < 70_000; i++) {
      const v = r.int(-3, 3);
      counts[v + 3]!++;
    }
    const chi2 = counts.reduce((s, c) => s + (c - 10_000) ** 2 / 10_000, 0);
    expect(chi2).toBeLessThan(22.46); // χ²(6) at p = 0.001
    const big = sample(50_000, 'intBig', (r2) => r2.int(0, 2 ** 40 - 1) / 2 ** 40);
    expectMoments(big, 0.5, 1 / 12, -1.2);
    expect(rng('x', 'world').int(5, 5)).toBe(5);
    expect(() => rng('x', 'world').int(2, 1)).toThrow(RangeError);
    expect(() => rng('x', 'world').int(0.5, 3)).toThrow(RangeError);
    expect(() => rng('x', 'world').int(-(2 ** 53) + 1, 2 ** 53 - 1)).toThrow(/exceeds 2\^53/);
  });

  it('bool(p) hits p, and p ≤ 0 / p ≥ 1 are certain', () => {
    const xs = sample(N, 'bool', (r) => (r.bool(0.3) ? 1 : 0));
    expectMoments(xs, 0.3, 0.21, 1 / 0.21 - 6);
    const r = rng('x', 'world');
    for (let i = 0; i < 1000; i++) {
      expect(r.bool(0)).toBe(false);
      expect(r.bool(1)).toBe(true);
      expect(r.bool(-0.2)).toBe(false);
      expect(r.bool(1.2)).toBe(true);
    }
    expect(() => r.bool(NaN)).toThrow(RangeError);
  });

  it('normal() has the requested mean and sd and finite tails', () => {
    expectMoments(
      sample(N, 'normal', (r) => r.normal()),
      0,
      1,
    );
    expectMoments(
      sample(N, 'normal2', (r) => r.normal(10, 3)),
      10,
      9,
    );
    const r = rng('x', 'world', 'tails');
    for (let i = 0; i < 10_000; i++) expect(Number.isFinite(r.normal())).toBe(true);
  });

  it('lognormal() has mean e^(μ+σ²/2)', () => {
    const mu = -0.2;
    const s = 0.5;
    const mean = Math.exp(mu + (s * s) / 2);
    const variance = (Math.exp(s * s) - 1) * Math.exp(2 * mu + s * s);
    const kurt = Math.exp(4 * s * s) + 2 * Math.exp(3 * s * s) + 3 * Math.exp(2 * s * s) - 6;
    expectMoments(
      sample(N, 'lognormal', (r) => r.lognormal(mu, s)),
      mean,
      variance,
      kurt,
    );
  });

  it('gamma() has mean kθ and variance kθ² for shapes below and above 1', () => {
    for (const [k, theta] of [
      [0.3, 1],
      [1, 2],
      [2.5, 0.4],
      [10, 1.5],
    ] as const) {
      expectMoments(
        sample(N, `gamma${k}`, (r) => r.gamma(k, theta)),
        k * theta,
        k * theta * theta,
        6 / k,
      );
    }
    expect(() => rng('x', 'world').gamma(0)).toThrow(RangeError);
    expect(() => rng('x', 'world').gamma(1, -1)).toThrow(RangeError);
  });

  it('beta() has mean a/(a+b) and variance ab/((a+b)²(a+b+1))', () => {
    for (const [a, b] of [
      [2, 5],
      [0.5, 0.5],
      [8, 3],
    ] as const) {
      const mean = a / (a + b);
      const variance = (a * b) / ((a + b) ** 2 * (a + b + 1));
      const kurt = (6 * ((a - b) ** 2 * (a + b + 1) - a * b * (a + b + 2))) / (a * b * (a + b + 2) * (a + b + 3));
      const xs = sample(N, `beta${a}-${b}`, (r) => r.beta(a, b));
      expectMoments(xs, mean, variance, kurt);
      for (const x of xs.slice(0, 1000)) expect(x >= 0 && x <= 1).toBe(true);
    }
  });

  it('poisson() has mean = variance = λ on both sides of the λ = 30 switch', () => {
    for (const lambda of [0.05, 0.5, 3, 12, 29.9, 30, 100, 2500]) {
      expectMoments(
        sample(N, `poisson${lambda}`, (r) => r.poisson(lambda)),
        lambda,
        lambda,
        1 / lambda,
      );
    }
    const r = rng('x', 'world');
    expect(r.poisson(0)).toBe(0);
    expect(() => r.poisson(-1)).toThrow(RangeError);
    expect(() => r.poisson(NaN)).toThrow(RangeError);
  });

  it('weighted() follows the weights and never returns a zero weight', () => {
    const counts = [0, 0, 0, 0];
    const r = rng('moments', 'world', 'weighted');
    for (let i = 0; i < 100_000; i++) counts[r.weighted([1, 0, 3, 6])]!++;
    expect(counts[1]).toBe(0);
    expect(Math.abs(counts[0]! / 100_000 - 0.1)).toBeLessThan(0.005);
    expect(Math.abs(counts[2]! / 100_000 - 0.3)).toBeLessThan(0.008);
    expect(Math.abs(counts[3]! / 100_000 - 0.6)).toBeLessThan(0.008);
    expect(() => r.weighted([0, 0])).toThrow(RangeError);
    expect(() => r.weighted([1, -1])).toThrow(RangeError);
    expect(() => r.weighted([1, NaN])).toThrow(RangeError);
  });

  it('shuffle() returns a uniform permutation of a copy; pick() a uniform element', () => {
    const input = ['a', 'b', 'c'] as const;
    const counts = new Map<string, number>();
    const r = rng('moments', 'world', 'shuffle');
    for (let i = 0; i < 60_000; i++) {
      const key = r.shuffle(input).join('');
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    expect(input).toEqual(['a', 'b', 'c']);
    expect(counts.size).toBe(6);
    for (const c of counts.values()) expect(Math.abs(c - 10_000)).toBeLessThan(500);
    expect(r.shuffle([])).toEqual([]);
    const picks = new Set(Array.from({ length: 200 }, () => r.pick(input)));
    expect(picks.size).toBe(3);
    expect(() => r.pick([])).toThrow(RangeError);
  });
});

describe('documented draw counts (§2.3 rule e)', () => {
  const count = (f: (r: Rng) => unknown): number => {
    const r = rng('counts', 'world');
    f(r);
    return r.drawCount;
  };

  it('takes fixed draws per call', () => {
    expect(count((r) => r.nextU32())).toBe(1);
    expect(count((r) => r.next())).toBe(2);
    expect(count((r) => r.bool(0))).toBe(2);
    expect(count((r) => r.bool(1))).toBe(2);
    expect(count((r) => r.normal(3, 2))).toBe(2);
    expect(count((r) => r.lognormal(0, 1))).toBe(2);
    expect(count((r) => r.poisson(0))).toBe(2);
    expect(count((r) => r.poisson(5))).toBe(2);
    expect(count((r) => r.poisson(500))).toBe(2);
    expect(count((r) => r.weighted([1, 2]))).toBe(2);
    expect(count((r) => r.int(0, 0))).toBe(1);
    expect(count((r) => r.int(1, 6))).toBe(1);
    expect(count((r) => r.int(0, 2 ** 40))).toBe(2);
    expect(count((r) => r.pick([1, 2, 3]))).toBe(1);
    expect(count((r) => r.shuffle([1, 2, 3, 4, 5]))).toBe(4);
  });

  it('gamma takes 2 or 4 draws per attempt (+2 for the shape < 1 boost); beta is two gammas', () => {
    const r = rng('counts', 'world', 'gamma');
    for (let i = 0; i < 2000; i++) {
      const before = r.drawCount;
      r.gamma(3);
      const used = r.drawCount - before;
      expect(used % 2).toBe(0);
      expect(used).toBeGreaterThanOrEqual(4);
    }
    const s = rng('counts', 'world', 'gamma-small');
    const before = s.drawCount;
    s.gamma(0.4);
    expect(s.drawCount - before).toBeGreaterThanOrEqual(6);
  });
});
