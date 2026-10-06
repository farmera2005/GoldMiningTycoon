// DESIGN §3.3.3 access classes and factors, §3.3.4 water, §3.4.1 sensitivity (§3.18 formula tests).
import { describe, expect, it } from 'vitest';
import { baseTuning } from '../../../data/tuning';
import { accessFactorsFor, claimAccessClass, degradeAccess } from './access';
import { sensitivityOf, channelColumn, heldProbability, selectionZ } from './env';
import { snapshotGenParams } from './params';
import { lowFlowGpm, sourceScale, waterAvailableFromFlow } from './water';

const GP = snapshotGenParams(baseTuning, []);

describe('access classes (§3.3.3)', () => {
  it('degrades past 6 and 18 trail miles, sends no-trail creeks fly-in, and caps arid at seasonal road', () => {
    expect(degradeAccess('highway')).toBe('seasonalRoad');
    expect(degradeAccess('flyIn')).toBe('flyIn');
    expect(claimAccessClass('seasonalRoad', 14, false, false, GP)).toBe('winterTrail');
    expect(claimAccessClass('seasonalRoad', 5, false, false, GP)).toBe('seasonalRoad');
    expect(claimAccessClass('highway', 19, false, false, GP)).toBe('winterTrail');
    expect(claimAccessClass('highway', 2, true, false, GP)).toBe('flyIn');
    expect(claimAccessClass('seasonalRoad', 30, false, true, GP)).toBe('seasonalRoad');
    expect(claimAccessClass('highway', 30, true, true, GP)).toBe('seasonalRoad');
    // A template's own degrade distances (arid: 12 / 30) override the global keys.
    expect(claimAccessClass('highway', 10, false, true, GP, [12, 30])).toBe('highway');
  });

  it('gives the §3.3.3 worked example: fuel $1.23, parts 1.4 wk, mob 1.54, class anchor 2.2, distScale 0.70', () => {
    const f = accessFactorsFor('winterTrail', 45 + 14, 1, GP);
    expect(f.distScale).toBeCloseTo(0.7, 2);
    expect(f.fuelAdderUsdPerGal).toBeCloseTo(1.23, 2);
    expect(f.partsLeadWeeks).toBeCloseTo(1.4, 2);
    expect(f.mobMult).toBeCloseTo(1.54, 2);
    expect(f.mobMultClass).toBe(2.2);
    // The fuel adder is a year-1 anchor × cpiIndex; the distance scale is clamped to [0.6, 1.8].
    expect(accessFactorsFor('winterTrail', 59, 1.1, GP).fuelAdderUsdPerGal).toBeCloseTo(1.75 * 0.7012 * 1.1, 3);
    expect(accessFactorsFor('highway', 1, 1, GP).distScale).toBe(0.6);
    expect(accessFactorsFor('highway', 1000, 1, GP).distScale).toBe(1.8);
  });
});

describe('water (§3.3.4)', () => {
  const creek = { sourceKind: 'creek' as const, baseGpm: 0.8 * 150 * 4 };
  const spring = { sourceKind: 'spring' as const, baseGpm: 32 };
  it('gives the §3.3.4 example: 4 upstream miles → 480 gpm usable, 672 at sff 1.4, 288 at 0.6, low flow 216', () => {
    expect(creek.baseGpm).toBe(480);
    expect(waterAvailableFromFlow(creek, 1.4, 1)).toBeCloseTo(672, 9);
    expect(waterAvailableFromFlow(creek, 0.6, 1)).toBeCloseTo(288, 9);
    expect(lowFlowGpm(creek, GP)).toBeCloseTo(216, 9);
  });
  it('scales springs and wells barely with the hydrograph: a 32-gpm spring gives 30.7 at sff 0.6', () => {
    expect(waterAvailableFromFlow(spring, 0.6, 1)).toBeCloseTo(30.72, 9);
    expect(sourceScale('well', 3)).toBeCloseTo(1.05, 12);
    expect(sourceScale('none', 1)).toBe(0);
    expect(lowFlowGpm(spring, GP)).toBeCloseTo(28.8, 9);
  });
  it('applies the drought hook once, to springs and wells only (D-3.47)', () => {
    expect(waterAvailableFromFlow(spring, 1, 0.5)).toBeCloseTo(waterAvailableFromFlow(spring, 1, 1) / 2, 12);
    expect(waterAvailableFromFlow(creek, 1, 0.5)).toBe(waterAvailableFromFlow(creek, 1, 1));
  });
});

describe('environment and selection (§3.4, §3.4.1)', () => {
  it('gives the sensitivity example 0.45 (fish-bearing, not anadromous, 4 of 20 blocks wetland)', () => {
    expect(
      sensitivityOf({ fishBearing: true, anadromous: false, wetlandShare: 4 / 20, specialStatus: false, noise: 0 }, GP),
    ).toBeCloseTo(0.45, 12);
    expect(
      sensitivityOf({ fishBearing: true, anadromous: true, wetlandShare: 1, specialStatus: true, noise: 0.2 }, GP),
    ).toBe(1);
  });
  it('puts the channel in the column whose span contains its offset', () => {
    expect(channelColumn(0, 4)).toBe(2);
    expect(channelColumn(-1, 4)).toBe(1);
    expect(channelColumn(-80, 4)).toBe(1);
    expect(channelColumn(80, 4)).toBe(2);
    expect(channelColumn(0, 8)).toBe(4);
  });
  it('stakes good-looking ground more often, overlooked ground almost at random', () => {
    const zRich = selectionZ([0.0095 * Math.E], 0.0095, GP);
    expect(zRich).toBeCloseTo(2, 12);
    expect(selectionZ([], 0.0095, GP)).toBe(-3);
    const creek = heldProbability(zRich, { depositType: 'creek' }, 0.82, GP);
    const bench = heldProbability(zRich, { depositType: 'bench' }, 0.82, GP);
    expect(creek).toBeCloseTo(1 / (1 + Math.exp(-(Math.log(0.82 / 0.18) + 1.2 * 2))), 12);
    expect(bench).toBeLessThan(creek);
    expect(heldProbability(0, { depositType: 'gulch' }, 0.7, GP)).toBeCloseTo(0.7, 12);
  });
});
