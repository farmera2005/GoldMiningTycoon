import { describe, expect, it } from 'vitest';
import {
  bootstrapQuantile,
  fnv1a32,
  halfWidth,
  mean,
  mulberry32,
  proportion,
  quantile,
  quantileSorted,
  round6,
  standardErrorOf,
  wilsonInterval,
  Z95,
} from './stats';

describe('wilsonInterval (BALANCE §3.0)', () => {
  // Hand computation, z = 1.959964, z² = 3.841459: for k = 0, n = 10 the centre is (0 + 0.192073) / 1.384146 = 0.138767
  // and the half-width (1.959964 / 1.384146) × √(0 + 3.841459 / 400) = 1.416010 × 0.097998 = 0.138767.
  it('0 of 10 → [0, 0.277533]', () => {
    const ci = wilsonInterval(0, 10) as [number, number];
    expect(ci[0]).toBe(0);
    expect(ci[1]).toBeCloseTo(0.277533, 6);
  });

  // k = 5: centre (0.5 + 0.192073) / 1.384146 = 0.5; half 1.416010 × √(0.025 + 0.009604) = 1.416010 × 0.186019 = 0.263407.
  it('5 of 10 → [0.236593, 0.763407]', () => {
    const ci = wilsonInterval(5, 10) as [number, number];
    expect(ci[0]).toBeCloseTo(0.236593, 6);
    expect(ci[1]).toBeCloseTo(0.763407, 6);
  });

  // k = 3, n = 20: p = 0.15, z²/n = 0.192073, centre (0.15 + 0.096036) / 1.192073 = 0.206394; half (1.959964 / 1.192073)
  // × √(0.006375 + 0.002401) = 1.644164 × 0.093681 = 0.154025.
  it('3 of 20 → [0.052369, 0.360419]', () => {
    const ci = wilsonInterval(3, 20) as [number, number];
    expect(ci[0]).toBeCloseTo(0.052369, 6);
    expect(ci[1]).toBeCloseTo(0.360419, 6);
  });

  it('10 of 10 mirrors 0 of 10', () => {
    const ci = wilsonInterval(10, 10) as [number, number];
    expect(ci[0]).toBeCloseTo(1 - 0.277533, 6);
    expect(ci[1]).toBe(1);
  });

  it('is null for no trials and rejects impossible counts', () => {
    expect(wilsonInterval(0, 0)).toBeNull();
    expect(() => wilsonInterval(3, 2)).toThrow(RangeError);
    expect(() => wilsonInterval(0.5, 2)).toThrow(RangeError);
  });

  it('proportion() skips nulls and rounds to 6 decimals', () => {
    const p = proportion([true, false, null, false, true, false, true, false, true, false, null, true]);
    expect(p).toMatchObject({ k: 5, n: 10, value: 0.5 });
    expect(p.ci).toEqual([0.236593, 0.763407]);
    expect(proportion([null, null])).toEqual({ value: null, ci: null, n: 0, k: 0 });
  });
});

describe('quantile, type 7 (Hyndman & Fan)', () => {
  // h = (n − 1)p over [1, 2, 3, 4]: p = 0.5 → h = 1.5 → 2 + 0.5 × 1 = 2.5; p = 0.1 → h = 0.3 → 1.3; p = 0.9 → h = 2.7 → 3.7.
  it('interpolates between order statistics', () => {
    const xs = [1, 2, 3, 4];
    expect(quantileSorted(xs, 0.5)).toBe(2.5);
    expect(quantileSorted(xs, 0.1)).toBeCloseTo(1.3, 12);
    expect(quantileSorted(xs, 0.9)).toBeCloseTo(3.7, 12);
    expect(quantileSorted(xs, 0)).toBe(1);
    expect(quantileSorted(xs, 1)).toBe(4);
  });

  // [1..10], p = 0.25 → h = 2.25 → 3 + 0.25 × 1 = 3.25.
  it('handles a ten-point sample, unsorted input and nulls', () => {
    expect(quantile([10, 9, 8, 7, 6, 5, 4, 3, 2, 1], 0.25)).toBe(3.25);
    expect(quantile([3, null, 1, 2], 0.5)).toBe(2);
    expect(quantileSorted([7], 0.9)).toBe(7);
    expect(quantile([], 0.5)).toBeNull();
    expect(() => quantileSorted([1], 1.5)).toThrow(RangeError);
  });

  it('mean of nothing is null', () => {
    expect(mean([])).toBeNull();
    expect(mean([1, 2, 6])).toBe(3);
  });
});

describe('seeded bootstrap interval (BALANCE §3.0)', () => {
  const opts = { resamples: 1000, seedKey: 'cell|metric' };

  it('is degenerate for constant data and for a single observation', () => {
    expect(bootstrapQuantile([4, 4, 4, 4, 4], 0.5, opts)).toEqual({ value: 4, ci: [4, 4], n: 5 });
    expect(bootstrapQuantile([7], 0.9, opts)).toEqual({ value: 7, ci: [7, 7], n: 1 });
    expect(bootstrapQuantile([null], 0.5, opts)).toEqual({ value: null, ci: null, n: 0 });
  });

  it('is deterministic for a seed key and independent of input order', () => {
    const xs = Array.from({ length: 50 }, (_, i) => (i * 37) % 50);
    const a = bootstrapQuantile(xs, 0.5, opts);
    const b = bootstrapQuantile([...xs].reverse(), 0.5, opts);
    expect(a).toEqual(b);
    expect(bootstrapQuantile(xs, 0.5, { ...opts, seedKey: 'other' }).ci).not.toBeNull();
  });

  // The median of 1…101 has a standard error of about 1.2533 σ / √n ≈ 1.2533 × 29.2 / 10.05 ≈ 3.6, so the 95% interval
  // should span roughly 51 ± 7.
  it('brackets the median with about the width theory gives', () => {
    const xs = Array.from({ length: 101 }, (_, i) => i + 1);
    const e = bootstrapQuantile(xs, 0.5, opts);
    expect(e.value).toBe(51);
    const [lo, hi] = e.ci as [number, number];
    expect(lo).toBeGreaterThanOrEqual(40);
    expect(lo).toBeLessThanOrEqual(51);
    expect(hi).toBeGreaterThanOrEqual(51);
    expect(hi).toBeLessThanOrEqual(62);
    expect(halfWidth(e)).toBeGreaterThan(3);
    expect(standardErrorOf(e)).toBeCloseTo((halfWidth(e) as number) / Z95, 12);
  });
});

describe('sim-side generator and hash', () => {
  it('FNV-1a 32 matches the reference vectors', () => {
    expect(fnv1a32('')).toBe(0x811c9dc5);
    expect(fnv1a32('a')).toBe(0xe40c292c);
    expect(fnv1a32('foobar')).toBe(0xbf9cf968);
  });

  it('mulberry32 is reproducible and stays in [0, 1)', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 1000; i++) {
      const x = a();
      expect(x).toBe(b());
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it('round6 rounds and normalizes −0', () => {
    expect(round6(0.1234565)).toBe(0.123457);
    expect(Object.is(round6(-0.0000001), 0)).toBe(true);
  });
});
