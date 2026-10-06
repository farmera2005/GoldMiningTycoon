import { describe, expect, it } from 'vitest';
import {
  dominanceMatrix,
  dominanceStatus,
  dominanceVerdict,
  dominatesReference,
  type DominanceInput,
} from './dominance';
import type { Estimate } from './stats';

const est = (value: number, half: number): Estimate => ({ value, ci: [value - half, value + half], n: 500 });
const bot = (name: string, s2: number, med: number, p90: number, half = 0.04): DominanceInput => ({
  bot: name,
  s2: est(s2, half),
  medianNwRatio5: est(med, half),
  p90NwRatio5: est(p90, half),
});

describe('dominance (BALANCE §5.9)', () => {
  it('A dominates B when ≥ on all three and ahead by more than the larger half-width on one', () => {
    // S2 0.70 vs 0.60: diff 0.10 > max(0.04, 0.04).
    expect(dominanceVerdict(bot('a', 0.7, 1.2, 2.0), bot('b', 0.6, 1.2, 2.0))).toBe('dominates');
  });

  it('uses the larger of the two half-widths', () => {
    const a = bot('a', 0.66, 1.2, 2.0, 0.04);
    const b: DominanceInput = { ...bot('b', 0.6, 1.2, 2.0), s2: est(0.6, 0.07) };
    // diff 0.06 exceeds A's 0.04 but not B's 0.07.
    expect(dominanceVerdict(a, b)).toBe('withinInterval');
  });

  it('is within the intervals when ahead only by less than the half-width', () => {
    expect(dominanceVerdict(bot('a', 0.62, 1.21, 2.01), bot('b', 0.6, 1.2, 2.0))).toBe('withinInterval');
  });

  it('is no dominance when behind on any metric, however far ahead elsewhere', () => {
    expect(dominanceVerdict(bot('a', 0.9, 1.5, 1.99), bot('b', 0.6, 1.2, 2.0))).toBe('none');
  });

  it('identical bots do not dominate each other', () => {
    expect(dominanceVerdict(bot('a', 0.6, 1.2, 2.0), bot('b', 0.6, 1.2, 2.0))).toBe('none');
  });

  it('is n/a when a metric is not computable', () => {
    const b: DominanceInput = { ...bot('b', 0.6, 1.2, 2.0), p90NwRatio5: { value: null, ci: null, n: 0 } };
    expect(dominanceVerdict(bot('a', 0.7, 1.2, 2.0), b)).toBe('n/a');
  });

  it('builds every ordered pair and scores O-04', () => {
    const cells = [bot('cautious', 0.65, 1.1, 1.8), bot('aggressive', 0.5, 1.0, 2.3), bot('balanced', 0.6, 1.05, 2.0)];
    const m = dominanceMatrix(cells);
    expect(m).toHaveLength(6);
    expect(dominanceStatus(m)).toBe('PASS');
    const dominated = [...cells, bot('lazy', 0.4, 0.9, 1.5)];
    expect(dominanceStatus(dominanceMatrix(dominated))).toBe('FAIL');
    expect(dominanceStatus(dominanceMatrix([bot('x', 0.6, 1, 2), bot('y', 0.61, 1, 2)]))).toBe('AT-RISK');
    expect(dominanceStatus([])).toBe('N/A');
  });

  it('checks named bots against a reference', () => {
    const pairs = dominatesReference([bot('cautious', 0.6, 1.1, 1.8), bot('leaseOnly', 0.7, 1.2, 1.9)], 'cautious');
    expect(pairs).toEqual([{ a: 'leaseOnly', b: 'cautious', verdict: 'dominates' }]);
    expect(dominatesReference([bot('x', 0.6, 1, 1)], 'cautious')).toEqual([]);
  });
});
