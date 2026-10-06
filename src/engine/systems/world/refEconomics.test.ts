// DESIGN §3.7 reference-economics yardstick: the worked block, break-evens and the frozen / thawed ratio (§3.18).
import { describe, expect, it } from 'vitest';
import { baseTuning } from '../../../data/tuning';
import { snapshotGenParams } from './params';
import { classify, refBlockEconomics, refBreakEvenGrade, refEconomics, refRecovery } from './refEconomics';
import type { BlockState, BlockTruth, ClaimTruth } from './types';
import type { ClaimId } from '../../core/ids';

const RE = snapshotGenParams(baseTuning, []).refEcon;

// The §3.7 worked block (north): OB 15 ft, T 5 ft, B 1.5 ft; g 0.012; mix 25/40/27/8; fineness 0.86; permafrost 0.8,
// clay 0.15, boulders 0.2.
const WORKED: BlockTruth = {
  overburdenFt: 15,
  payThicknessFt: 5,
  bedrockCleanupFt: 1.5,
  gradeOzPerBcy: 0.012,
  virginGradeOzPerBcy: 0.012,
  sizeMix: { coarse: 0.25, medium: 0.4, fine: 0.27, ultrafine: 0.08 },
  coarseMeanMg: 150,
  fineness: 0.86,
  permafrost: 0.8,
  clay: 0.15,
  boulders: 0.2,
  cementation: 0,
  bedrockType: 'schist',
  bedrockGoldShare: 0.2,
  verticalDecayFt: 2,
  paystreakFraction: 1,
  minedOutFraction: 0,
};

describe('refEconomics block terms (§3.7 worked block)', () => {
  it('recovery R = 0.777 × 0.978 = 0.760', () => {
    expect(refRecovery(WORKED, RE)).toBeCloseTo(0.7769 * 0.9775, 6);
  });

  it('revenue $328.0k ± $0.5k and cost $268.8k ± $0.5k', () => {
    const e = refBlockEconomics(WORKED, undefined, 'subarctic', RE);
    expect(e.payBcy).toBeCloseTo(6.5 * 1613, 6);
    expect(e.overburdenBcy).toBeCloseTo(15 * 1613, 6);
    expect(Math.abs(e.revenueUsd - 328_000)).toBeLessThan(500);
    expect(Math.abs(e.costUsd - 268_800)).toBeLessThan(500);
  });

  it('breaks even at 0.0098 oz/bcy frozen and 0.0073 thawed', () => {
    expect(refBreakEvenGrade(WORKED, undefined, 'subarctic', RE)).toBeCloseTo(0.0098, 4);
    expect(refBreakEvenGrade({ ...WORKED, permafrost: 0 }, undefined, 'subarctic', RE)).toBeCloseTo(0.0073, 4);
  });

  it('puts the frozen (0.8) / thawed break-even ratio at strip 3:1 at 1.36 ± 0.01 (D-3.36)', () => {
    const at3 = { ...WORKED, overburdenFt: 3 * 6.5 };
    const frozen = refBreakEvenGrade(at3, undefined, 'subarctic', RE);
    const thawed = refBreakEvenGrade({ ...at3, permafrost: 0 }, undefined, 'subarctic', RE);
    expect(Math.abs(frozen / thawed - 1.36)).toBeLessThan(0.01);
  });

  it('counts only remaining pay and overburden, with an unprocessed tailings pile as overburden', () => {
    const bs: BlockState = {
      strippedBcy: 15 * 1613,
      minedBcy: 2000,
      sampledBcy: 100,
      oldTailingsTakenBcy: 0,
      disturbed: true,
      disturbanceOrigin: 'player',
      reclaimed: false,
      thawProgress: 0,
    };
    const withPile: BlockTruth = {
      ...WORKED,
      oldTailings: { bcy: 4000, gradeOzPerBcy: 0.01, sizeMix: WORKED.sizeMix },
    };
    const e = refBlockEconomics(withPile, bs, 'subarctic', RE);
    expect(e.payBcy).toBeCloseTo(6.5 * 1613 - 2100, 6);
    expect(e.overburdenBcy).toBeCloseTo(4000, 6);
  });
});

describe('classes (§3.7)', () => {
  it('uses the CDV and margin thresholds', () => {
    expect(classify(0, 0.9, RE)).toBe('uneconomic');
    expect(classify(-1, 0.9, RE)).toBe('uneconomic');
    expect(classify(100_000, 0.9, RE)).toBe('marginal');
    expect(classify(750_000, 0.4, RE)).toBe('good');
    expect(classify(750_000, 0.39, RE)).toBe('marginal');
    expect(classify(3_000_000, 0.6, RE)).toBe('excellent');
    expect(classify(3_000_000, 0.59, RE)).toBe('good');
  });

  it('mines exactly the blocks that pay and charges the development cost per mined acre', () => {
    const rich = { ...WORKED, permafrost: 0, gradeOzPerBcy: 0.05, virginGradeOzPerBcy: 0.05 };
    const poor = { ...WORKED, gradeOzPerBcy: 0.002, virginGradeOzPerBcy: 0.002 };
    const truth: ClaimTruth = {
      claimId: 'clm_000001' as ClaimId,
      truthHash: 'x',
      coarseMeanMg: 150,
      blocks: [rich, poor, rich],
    };
    const r = refEconomics(truth, () => undefined, 'subarctic', RE);
    expect(r.minedIdxs).toEqual([0, 2]);
    const one = refBlockEconomics(rich, undefined, 'subarctic', RE);
    const net = 2 * (one.revenueUsd - one.costUsd);
    expect(r.cdvUsd).toBeCloseTo(net - 150_000 - 2 * 8_000, 6);
    expect(r.margin).toBeCloseTo(net / (2 * one.revenueUsd), 12);
    expect(r.minedContainedOz).toBeCloseTo(2 * one.payBcy * 0.05, 9);
  });
});
