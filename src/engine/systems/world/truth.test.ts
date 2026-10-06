// DESIGN §3.5.3 block-model formulas and the §3.18 block-field statistics.
import { describe, expect, it } from 'vitest';
import { rng } from '../../core/rng';
import { ar1 } from './profile';
import { blockField, normalize4, overlap, payBcyOf } from './truth';

describe('overlap, the paystreak share of a block width (§3.5.3)', () => {
  it('matches the §3.18 cases', () => {
    expect(overlap(0, 110)).toBeCloseTo(1.0, 12);
    expect(overlap(104.5, 110)).toBeCloseTo(0.526, 3);
    expect(overlap(400, 110)).toBe(0);
    // Symmetric about the centreline, and a narrow streak inside a block counts its full width.
    expect(overlap(-104.5, 110)).toBeCloseTo(overlap(104.5, 110), 12);
    expect(overlap(0, 50)).toBeCloseTo(100 / 209, 12);
  });
});

describe('payBcy and size-mix normalization', () => {
  it('measures grade over pay gravel plus bedrock cleanup (D-3.3)', () => {
    expect(payBcyOf({ payThicknessFt: 5, bedrockCleanupFt: 1.5 })).toBeCloseTo(6.5 * 1613, 9);
  });
  it('normalizes a mix to sum 1', () => {
    const m = normalize4([2, 1, 1, 0]);
    expect(m[0] + m[1] + m[2] + m[3]).toBeCloseTo(1, 15);
    expect(m[0]).toBeCloseTo(0.5, 15);
  });
});

function corr(xs: readonly number[], ys: readonly number[]): number {
  const n = xs.length;
  let mx = 0;
  let my = 0;
  for (let i = 0; i < n; i++) {
    mx += xs[i] as number;
    my += ys[i] as number;
  }
  mx /= n;
  my /= n;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const a = (xs[i] as number) - mx;
    const b = (ys[i] as number) - my;
    sxy += a * b;
    sxx += a * a;
    syy += b * b;
  }
  return sxy / Math.sqrt(sxx * syy);
}

describe('the separable AR block field (§3.5.3, §3.18)', () => {
  // 3,000 fields of 10 × 4 blocks (a 40-ac claim), north range along 700 ft, across 120 ft.
  const along: [number[], number[]] = [[], []];
  const across: [number[], number[]] = [[], []];
  const all: number[] = [];
  for (let k = 0; k < 3000; k++) {
    const z = blockField(rng('test-field', 'world', 'field', k), 10, 4, 700, 120);
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 4; j++) {
        const v = (z[i] as number[])[j] as number;
        all.push(v);
        if (i > 0) {
          along[0].push(((z[i - 1] as number[])[j] as number));
          along[1].push(v);
        }
        if (j > 0) {
          across[0].push((z[i] as number[])[j - 1] as number);
          across[1].push(v);
        }
      }
    }
  }

  it('has lag-1 correlation 0.742 ± 0.03 along and 0.175 ± 0.04 across', () => {
    expect(Math.abs(corr(along[0], along[1]) - 0.742)).toBeLessThan(0.03);
    expect(Math.abs(corr(across[0], across[1]) - 0.175)).toBeLessThan(0.04);
  });

  it('has unit variance ± 0.05 and mean 0', () => {
    const mean = all.reduce((a, x) => a + x, 0) / all.length;
    const v = all.reduce((a, x) => a + (x - mean) * (x - mean), 0) / all.length;
    expect(Math.abs(mean)).toBeLessThan(0.03);
    expect(Math.abs(v - 1)).toBeLessThan(0.05);
  });

  it('is deterministic for a key', () => {
    const a = blockField(rng('s', 'world', 'f', 1), 5, 4, 700, 120);
    const b = blockField(rng('s', 'world', 'f', 1), 5, 4, 700, 120);
    expect(a).toEqual(b);
  });
});

describe('ar1, the creek row processes (§3.5.2)', () => {
  it('is stationary with σ and ρ = exp(−209 / range)', () => {
    const lag0: number[] = [];
    const lag1: number[] = [];
    const all: number[] = [];
    for (let k = 0; k < 400; k++) {
      const s = ar1(rng('test-ar1', 'world', k), 60, 3000, 0.28);
      for (let i = 0; i < s.length; i++) {
        all.push(s[i] as number);
        if (i > 0) {
          lag0.push(s[i - 1] as number);
          lag1.push(s[i] as number);
        }
      }
    }
    const sd = Math.sqrt(all.reduce((a, x) => a + x * x, 0) / all.length);
    expect(Math.abs(sd - 0.28)).toBeLessThan(0.02);
    expect(Math.abs(corr(lag0, lag1) - Math.exp(-209 / 3000))).toBeLessThan(0.02);
  });
});
