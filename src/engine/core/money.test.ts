import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  addCents,
  addMilliOz,
  allocateCents,
  cents,
  centsToUsd,
  floorMilliOz,
  milliOz,
  milliOzToOz,
  negCents,
  roundCents,
  roundHalfAway,
  subCents,
  subMilliOz,
  sumCents,
  sumMilliOz,
  toMilliOz,
  usdToCents,
  type Cents,
  type MilliOz,
} from './money';

describe('roundCents: half away from zero (D-2.2)', () => {
  it('rounds the hand-computed cases', () => {
    expect(roundCents(-0.5)).toBe(-1);
    expect(roundCents(0.5)).toBe(1);
    expect(roundCents(2.5)).toBe(3);
    expect(roundCents(-2.5)).toBe(-3);
    expect(roundCents(1.4999999)).toBe(1);
    expect(roundCents(-1.4999999)).toBe(-1);
    expect(roundCents(123456.5)).toBe(123457);
    expect(roundCents(0.49999999999999994)).toBe(0); // floor(x + 0.5) would give 1
    expect(roundCents(-0.49999999999999994)).toBe(0);
    expect(Object.is(roundCents(-0.4), 0)).toBe(true); // never −0
    expect(Object.is(roundCents(-0), 0)).toBe(true);
  });

  it('leaves integers alone, including those above 2^52', () => {
    expect(roundCents(4503599627370497)).toBe(4503599627370497);
    expect(roundHalfAway(-7)).toBe(-7);
  });

  it('agrees with a reference rounding and is odd-symmetric', () => {
    fc.assert(
      fc.property(fc.double({ min: -1e12, max: 1e12, noNaN: true }), (x) => {
        const r = roundHalfAway(x);
        expect(Math.abs(r - x)).toBeLessThanOrEqual(0.5);
        if (Math.abs(r - x) === 0.5) expect(Math.abs(r)).toBeGreaterThan(Math.abs(x));
        expect(roundHalfAway(-x)).toBe(r === 0 ? 0 : -r);
      }),
    );
  });

  it('rejects non-finite and unsafe results', () => {
    expect(() => roundCents(NaN)).toThrow(RangeError);
    expect(() => roundCents(Infinity)).toThrow(RangeError);
    expect(() => roundCents(2 ** 60)).toThrow(RangeError);
  });
});

describe('Cents helpers', () => {
  it('brands integers only', () => {
    expect(cents(12)).toBe(12);
    expect(() => cents(1.5)).toThrow(RangeError);
    expect(() => cents(NaN)).toThrow(RangeError);
  });

  it('converts dollars with one rounding', () => {
    expect(usdToCents(4200)).toBe(420000);
    expect(usdToCents(13.6)).toBe(1360); // 13.6 × 100 = 1360.0000000000002
    expect(usdToCents(-45123.07)).toBe(-4512307);
    expect(usdToCents(0.005)).toBe(1);
    // Decimal ties whose float product lands just below the tie (1.005 × 100 = 100.49999999999999) round away from
    // zero like §13.2's display rule, so the ledger and the screen agree.
    expect(usdToCents(1.005)).toBe(101);
    expect(usdToCents(10.075)).toBe(1008);
    expect(usdToCents(-1.005)).toBe(-101);
    expect(usdToCents(1.0049)).toBe(100);
    expect(toMilliOz(1.0005)).toBe(1001);
    expect(toMilliOz(2.0045)).toBe(2005);
    expect(centsToUsd(cents(99950))).toBe(999.5);
  });

  it('adds, subtracts, negates and sums exactly', () => {
    const a = cents(150);
    const b = cents(-275);
    expect(addCents(a, b)).toBe(-125);
    expect(subCents(a, b)).toBe(425);
    expect(Object.is(negCents(cents(0)), 0)).toBe(true);
    expect(sumCents([a, b, cents(1000)])).toBe(875);
    expect(sumCents([])).toBe(0);
    expect(() => addCents(a, 0.5 as Cents)).toThrow(RangeError);
  });

  it('allocates totals so the parts sum exactly, remainder to the largest line', () => {
    expect(allocateCents(cents(100), [1, 1, 1])).toEqual([34, 33, 33]);
    expect(allocateCents(cents(1001), [3, 1])).toEqual([751, 250]);
    expect(allocateCents(cents(-100), [1, 2])).toEqual([-33, -67]);
    fc.assert(
      fc.property(
        fc.integer({ min: -1e9, max: 1e9 }),
        fc
          .array(fc.double({ min: 0, max: 1e6, noNaN: true }), { minLength: 1, maxLength: 12 })
          .filter((w) => w.some((x) => x > 0)),
        (total, weights) => {
          const parts = allocateCents(cents(total), weights);
          expect(parts.reduce((s, p) => s + p, 0)).toBe(total);
          parts.forEach((p) => expect(Number.isInteger(p)).toBe(true));
        },
      ),
    );
    expect(() => allocateCents(cents(1), [])).toThrow(RangeError);
    expect(() => allocateCents(cents(1), [0, 0])).toThrow(RangeError);
  });
});

describe('MilliOz helpers (§2.4: weighing floors to 0.001 oz)', () => {
  it('weighs by flooring, snapping decimal artifacts at a milli-ounce boundary', () => {
    expect(floorMilliOz(52.9014)).toBe(52901);
    expect(floorMilliOz(52.901)).toBe(52901);
    expect(Math.floor(1.005 * 1000)).toBe(1004); // the binary artifact the snap exists for…
    expect(floorMilliOz(1.005)).toBe(1005); // …is snapped back to the intended 1.005 oz
    expect(floorMilliOz(52.90099)).toBe(52900);
    expect(floorMilliOz(0.0009999)).toBe(0);
    expect(floorMilliOz(0)).toBe(0);
    expect(() => floorMilliOz(NaN)).toThrow(RangeError);
  });

  it('never weighs more than the gold present by more than the snap tolerance', () => {
    fc.assert(
      fc.property(fc.double({ min: 0, max: 1e5, noNaN: true }), (oz) => {
        const w = floorMilliOz(oz);
        expect(milliOzToOz(w)).toBeLessThanOrEqual(oz + 1e-9);
        expect(oz - milliOzToOz(w)).toBeLessThan(0.001);
      }),
    );
  });

  it('splits exactly in milli-oz (the §7 7.10 cleanup example)', () => {
    const weighed = floorMilliOz(52.901);
    const inKind = toMilliOz(6.348);
    const lot = subMilliOz(weighed, inKind);
    expect(lot).toBe(46553);
    expect(addMilliOz(inKind, lot)).toBe(weighed);
    expect(sumMilliOz([inKind, lot])).toBe(52901);
    expect(toMilliOz(-0.0005)).toBe(-1);
    expect(milliOz(5)).toBe(5);
    expect(() => milliOz(0.5)).toThrow(RangeError);
    expect(() => addMilliOz(1 as MilliOz, 0.5 as MilliOz)).toThrow(RangeError);
  });
});
