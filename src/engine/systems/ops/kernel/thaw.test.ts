// DESIGN §7 7.4 natural thaw: the 7.4 calibration checks and the 7.23 thaw fixtures.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { EXPLAIN_ON } from '../../../core/calc';
import { DESIGN_PARAMS as P } from './testing/designTuning';
import { overwinterThaw, thawAfterRemoval, thawRateK, thawStep, thawSurfaceOf, type ThawRateInput } from './thaw';
import type { TempBand, ThawSurface } from './types';

const DEEP = 100; // a column far deeper than any season's thaw

function k(band: TempBand, surface: ThawSurface, muck = false): number {
  return thawRateK({ tempBand: band, surface, overburdenRemaining: muck, aspectMult: 1, eventMult: 1 }, P).value;
}

function season(bands: readonly TempBand[], surface: ThawSurface): number {
  let d = 0;
  for (const b of bands) d = thawStep(d, k(b, surface), DEEP);
  return d;
}

const repeat = (b: TempBand, n: number): TempBand[] => Array.from({ length: n }, () => b);

describe('Stefan thaw (7.4)', () => {
  it('a first mild week on stripped gravel thaws 1.414 ft (2.4 in/day)', () => {
    expect(thawStep(0, k('mild', 'stripped'), DEEP)).toBeCloseTo(1.414, 3);
    expect(thawStep(0, k('cool', 'stripped'), DEEP)).toBeCloseTo(1.095, 3);
    expect(thawStep(0, k('hot', 'stripped'), DEEP)).toBeCloseTo(1.549, 3);
  });

  it('4 cool + 12 mild weeks thaw stripped gravel 5.37 ft; 5 cool + 12 mild 5.48 ft (7.23)', () => {
    expect(season([...repeat('cool', 4), ...repeat('mild', 12)], 'stripped')).toBeCloseTo(5.37, 2);
    expect(season([...repeat('cool', 5), ...repeat('mild', 12)], 'stripped')).toBeCloseTo(5.48, 2);
  });

  it('a northern summer thaws cleared ground 3.6–3.7 ft and vegetated ground 1.9 ft', () => {
    const summer = [...repeat('cool', 4), ...repeat('mild', 12)];
    const cleared = season(summer, 'cleared');
    expect(cleared).toBeGreaterThanOrEqual(3.6);
    expect(cleared).toBeLessThanOrEqual(3.7);
    expect(season(summer, 'vegetated')).toBeCloseTo(1.86, 2);
  });

  it('left unskimmed, the mild-week increment falls to 0.30 ft by week 6', () => {
    let d = 0;
    let inc = 0;
    for (let w = 1; w <= 6; w++) {
      const next = thawStep(d, k('mild', 'stripped'), DEEP);
      inc = next - d;
      d = next;
    }
    expect(inc).toBeCloseTo(0.3, 1);
  });

  it('thaw-and-strip on ice-rich muck: 1.18 ft/week = 1,909 bcy per exposed acre', () => {
    const ft = thawStep(0, k('mild', 'stripped', true), DEEP);
    expect(ft).toBeCloseTo(1.183, 3);
    expect(ft * 1613).toBeCloseTo(1909, -1);
  });

  it('cold and deep-cold weeks do not thaw; the thaw stops at the remaining column', () => {
    expect(thawStep(2, k('cold', 'stripped'), DEEP)).toBe(2);
    expect(thawStep(2, k('deepCold', 'stripped'), DEEP)).toBe(2);
    expect(thawStep(2, k('mild', 'stripped'), 2.2)).toBe(2.2);
  });

  it('removing material lowers the thaw line; the first winter week keeps a share of it', () => {
    expect(thawAfterRemoval(1.4, 0.5)).toBeCloseTo(0.9, 12);
    expect(thawAfterRemoval(1.4, 3)).toBe(0);
    expect(overwinterThaw(5, 'stripped', P)).toBeCloseTo(4, 12);
    expect(overwinterThaw(5, 'cleared', P)).toBeCloseTo(1.5, 12);
    expect(overwinterThaw(5, 'vegetated', P)).toBe(0);
  });

  it('the season-ahead rows of 7.4: exposed at wk 24 (cool, mild, mild) → 2.28 ft at wk 26', () => {
    expect(season(['cool', 'mild', 'mild'], 'stripped')).toBeCloseTo(2.28, 2);
  });

  it('aspect and events scale K; muck slows it', () => {
    const base: ThawRateInput = {
      tempBand: 'mild',
      surface: 'stripped',
      overburdenRemaining: false,
      aspectMult: 1,
      eventMult: 1,
    };
    expect(thawRateK({ ...base, aspectMult: 1.35 }, P).value).toBeCloseTo(2.7, 12);
    expect(thawRateK({ ...base, eventMult: 0.5 }, P).value).toBeCloseTo(1.0, 12);
    const on = thawRateK({ ...base, overburdenRemaining: true }, P, EXPLAIN_ON);
    expect(on.value).toBeCloseTo(1.4, 12);
    expect(on.calc?.children?.some((c) => c.source?.kind === 'tuning' && c.source.key === 'ops.thawMuckMult')).toBe(
      true,
    );
  });

  it('surfaces map to the thaw rows; worked-out surfaces do not thaw', () => {
    expect(thawSurfaceOf('stripping')).toBe('stripped');
    expect(thawSurfaceOf('payExposed')).toBe('stripped');
    expect(thawSurfaceOf('cleared')).toBe('cleared');
    expect(thawSurfaceOf('minedOut')).toBeNull();
  });

  it('thaw never decreases with more weeks, a warmer band or a faster surface (property)', () => {
    const bands: TempBand[] = ['deepCold', 'cold', 'cool', 'mild', 'hot'];
    fc.assert(
      fc.property(fc.array(fc.constantFrom(...bands), { maxLength: 30 }), fc.constantFrom(...bands), (seq, extra) => {
        const a = season(seq, 'stripped');
        expect(season([...seq, extra], 'stripped')).toBeGreaterThanOrEqual(a);
        expect(season(seq, 'cleared')).toBeLessThanOrEqual(a + 1e-12);
      }),
    );
  });
});
