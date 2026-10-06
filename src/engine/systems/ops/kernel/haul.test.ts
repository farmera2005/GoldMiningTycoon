// DESIGN §7 7.6.3 haul: the 7.23 truck-cycle fixture (load 8.44, cycle 17.09 min, 47.18 bcy/hr at u 0.8993).
import { describe, expect, it } from 'vitest';
import { EXPLAIN_ON } from '../../../core/calc';
import { haulCycleMult, haulDistanceFt, loaderCarryCapBcy, truckCycle } from './haul';
import { DESIGN_PARAMS as P } from './testing/designTuning';

describe('truck cycle (7.6.3)', () => {
  const haulFt = haulDistanceFt(12, 0, P);
  const input = { payloadBcy: 18, loaderDigRateBcyHr: 127.97, haulFt, cycleMult: 1, u: 0.8993 };

  it('a plant 12 blocks downstream: 300 + 12 × 209 = 2,808 ft', () => {
    expect(haulFt).toBe(2808);
    expect(haulDistanceFt(-3, 2, P)).toBe(300 + 5 * 209);
  });

  it('P 18, dig 127.97, 2,808 ft → load 8.44, cycle 17.09 min, 47.18 bcy/hr, 2.02 trucks to match', () => {
    const c = truckCycle(input, P).value;
    expect(c.loadMin).toBeCloseTo(8.44, 2);
    expect(c.loadedMin).toBeCloseTo(3.99, 2);
    expect(c.emptyMin).toBeCloseTo(2.66, 2);
    expect(c.cycleMin).toBeCloseTo(17.09, 2);
    expect(c.capBcy).toBeCloseTo(47.18, 2);
    expect(c.trucksToMatch).toBeCloseTo(2.02, 2);
  });

  it('a wet-weather cycle multiplier applies only once the precipitation rule is live (P5)', () => {
    expect(haulCycleMult('wet', 1, false, P)).toBe(1);
    expect(haulCycleMult('wet', 1, true, P)).toBe(1.1);
    expect(haulCycleMult('storm', 1.2, true, P)).toBeCloseTo(1.5, 12);
    const slow = truckCycle({ ...input, cycleMult: 1.25 }, P).value;
    expect(slow.cycleMin).toBeCloseTo(8.4395 + 1.25 * (3.9886 + 1.2 + 2.6591 + 0.8), 3);
  });

  it('no loader means no hauling', () => {
    expect(truckCycle({ ...input, loaderDigRateBcyHr: 0 }, P).value.capBcy).toBe(0);
  });

  it('a load-and-carry loader slows beyond ops.loaderCarryRefFt', () => {
    expect(loaderCarryCapBcy(170, 300, 1, P)).toBe(170);
    expect(loaderCarryCapBcy(170, 600, 0.9, P)).toBeCloseTo(76.5, 12);
  });

  it('explains without changing values', () => {
    const on = truckCycle(input, P, EXPLAIN_ON);
    expect(on.value).toEqual(truckCycle(input, P).value);
    expect(on.calc?.value).toBe(on.value.capBcy);
  });
});
