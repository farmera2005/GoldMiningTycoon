// DESIGN §7 7.6.4 feed modes, 7.6.5 plant capacity (the 7.8 trommel: R_eff 73.1, 63.0 bcy/hr when fed), 7.6.8
// tailings handling and the cleanup and plant-move downtime of 7.10 and s07 #21.
import { describe, expect, it } from 'vitest';
import { EXPLAIN_ON } from '../../../core/calc';
import {
  directFeedCapBcy,
  directFeedShiftDue,
  feedMode,
  feederCapacityBcy,
  overwinterPadFrozenBcy,
  padRehandleShare,
  type FeedModeInput,
} from './feed';
import {
  cleanupCrewHours,
  cleanupHours,
  dryWasherCanRun,
  feedRatio,
  maxFeedTargetBcyHr,
  plantCapacityBcy,
  plantEffectiveRate,
  plantMoveHours,
  tailingsHandlingHours,
} from './plant';
import { DESIGN_PARAMS as P } from './testing/designTuning';

describe('feed modes (7.6.4)', () => {
  const base: FeedModeInput = {
    hasPlant: true,
    feederCount: 0,
    haulerCount: 0,
    digExcavatorCount: 1,
    plantRatedBcyHr: 50,
    plantAdjacentToFace: true,
  };
  it('derives the mode from the line machines', () => {
    expect(feedMode({ ...base, feederCount: 1, haulerCount: 1 }, P)).toBe('padLoader');
    expect(feedMode({ ...base, haulerCount: 2 }, P)).toBe('truckDirect');
    expect(feedMode(base, P)).toBe('excavatorDirect');
    expect(feedMode({ ...base, hasPlant: false }, P)).toBe('none');
  });
  it('excavator direct needs a small plant next to the face (D-7.32); else PLANT_NO_FEED', () => {
    expect(feedMode({ ...base, plantRatedBcyHr: 150 }, P)).toBe('invalid');
    expect(feedMode({ ...base, plantAdjacentToFace: false }, P)).toBe('invalid');
    expect(feedMode({ ...base, digExcavatorCount: 0 }, P)).toBe('invalid');
  });
  it('direct feed runs at 0.60 of dig capacity and shifts every 3,000 bcy', () => {
    expect(directFeedCapBcy(100, P)).toBeCloseTo(60, 12);
    expect(directFeedShiftDue(2999, P)).toBe(false);
    expect(directFeedShiftDue(3000, P)).toBe(true);
  });
  it('pad material beyond the free zone costs rehandle time; frozen pad feeds at the frozen-gravel rate', () => {
    expect(padRehandleShare(1500, P)).toBe(0);
    expect(padRehandleShare(3000, P)).toBeCloseTo(0.5, 12);
    const free = feederCapacityBcy({ refRate: 170, u: 1, rehandleShare: 0, frozenShare: 0 }, P).value;
    expect(free).toBe(170);
    expect(feederCapacityBcy({ refRate: 170, u: 1, rehandleShare: 1, frozenShare: 0 }, P).value).toBeCloseTo(136, 9);
    expect(feederCapacityBcy({ refRate: 170, u: 1, rehandleShare: 0, frozenShare: 1 }, P).value).toBeCloseTo(59.5, 9);
    expect(overwinterPadFrozenBcy(1000, P)).toBeCloseTo(600, 9);
    const on = feederCapacityBcy({ refRate: 170, u: 0.9, rehandleShare: 0.2, frozenShare: 0.1 }, P, EXPLAIN_ON);
    expect(on.calc?.value).toBe(on.value);
  });
});

describe('plant capacity (7.6.5)', () => {
  const r = plantEffectiveRate({ ratedBcyHr: 75, cond: 1, clay: 0, boulders: 0.1, prep: 'trommel', eventMult: 1 }, P);
  it('a 75 bcy/hr trommel on boulders 0.1 runs at R_eff 73.1; fed at target 70 it does 63.0 bcy/hr at u 0.8993', () => {
    expect(r.value).toBeCloseTo(73.125, 9);
    expect(plantCapacityBcy(70, r.value, 0.8993, P)).toBeCloseTo(62.95, 2);
    expect(feedRatio(62.951, 0.8993, r.value)).toBeCloseTo(70 / 73.125, 4);
  });
  it('clay cuts capacity by the prep (trommel 0.45 per unit) and overfeed is capped at 1.5 × R_eff', () => {
    const clay = plantEffectiveRate(
      { ratedBcyHr: 50, cond: 0.96, clay: 0.3, boulders: 0, prep: 'trommel', eventMult: 1 },
      P,
    );
    expect(clay.value).toBeCloseTo(50 * 0.96 * (1 - 0.135), 9);
    expect(plantCapacityBcy(200, 40, 1, P)).toBe(60);
    expect(maxFeedTargetBcyHr(75, P)).toBe(112.5);
  });
  it('a dry washer runs only in dry or normal weeks', () => {
    expect(dryWasherCanRun('dry')).toBe(true);
    expect(dryWasherCanRun('normal')).toBe(true);
    expect(dryWasherCanRun('wet')).toBe(false);
    expect(dryWasherCanRun('storm')).toBe(false);
  });
});

describe('downtime and tailings (7.10, 7.6.8, s07 #21)', () => {
  it('cleanup: 75 bcy/hr → 7 h, 300 → 16 h; off-day crew-hours × 2', () => {
    expect(cleanupHours(75, P)).toBeCloseTo(7, 12);
    expect(cleanupHours(300, P)).toBeCloseTo(16, 12);
    expect(cleanupCrewHours(75, P)).toBeCloseTo(14, 12);
  });
  it('a plant move of a 75 bcy/hr plant takes 16 h', () => {
    expect(plantMoveHours(75, P)).toBeCloseTo(16, 12);
  });
  it('tailings handling: 3,264 bcy washed → 9.8 machine-hours; a stacker carries its share', () => {
    expect(tailingsHandlingHours(3264, 0, P)).toBeCloseTo(9.79, 2);
    expect(tailingsHandlingHours(3264, 3264, P)).toBe(0);
  });
});
