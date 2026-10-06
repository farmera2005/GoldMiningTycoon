// DESIGN §3.5.4 vertical gold profile and §3.8 worked example 3 (position effects), §3.18 formula tests.
import { describe, expect, it } from 'vitest';
import type { BlockTruth, VerticalProfile } from './types';
import {
  cumulativeGoldShare,
  positionMult,
  positionMultProfile,
  profileOf,
  verticalGoldShare,
  verticalGoldShareProfile,
} from './vertical';

// T = 6, B = 1.5, s_b = 0.20, λg = 2.0, λb = 0.6 (§3.8 worked example 3).
const P: VerticalProfile = { Tg: 6, B: 1.5, sb: 0.2, lambdaG: 2.0, lambdaB: 0.6 };

const BT: BlockTruth = {
  overburdenFt: 15,
  payThicknessFt: 6,
  bedrockCleanupFt: 1.5,
  gradeOzPerBcy: 0.01,
  virginGradeOzPerBcy: 0.01,
  sizeMix: { coarse: 0.25, medium: 0.4, fine: 0.27, ultrafine: 0.08 },
  coarseMeanMg: 150,
  fineness: 0.86,
  permafrost: 0,
  clay: 0.15,
  boulders: 0.2,
  cementation: 0,
  bedrockType: 'schist',
  bedrockGoldShare: 0.2,
  verticalDecayFt: 2.0,
  paystreakFraction: 1,
  minedOutFraction: 0,
};

describe('G(h), the cumulative gold share (§3.5.4)', () => {
  it('is 0 at the bottom of the cleanup zone, s_b at the bedrock surface and 1 at the top of the gravel', () => {
    expect(cumulativeGoldShare(P, -1.5)).toBeCloseTo(0, 12);
    expect(cumulativeGoldShare(P, 0)).toBeCloseTo(0.2, 12);
    expect(cumulativeGoldShare(P, 6)).toBeCloseTo(1, 12);
    // Beyond the column it saturates.
    expect(cumulativeGoldShare(P, -9)).toBeCloseTo(0, 12);
    expect(cumulativeGoldShare(P, 40)).toBeCloseTo(1, 12);
  });

  it('is non-decreasing through the column', () => {
    let prev = -1;
    for (let h = -1.5; h <= 6; h += 0.05) {
      const g = cumulativeGoldShare(P, h);
      expect(g).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = g;
    }
  });

  it('leaves 7.68% of the block gold when only 0.5 ft of a 1.5-ft cleanup zone is cleaned (§3.5.4 example)', () => {
    // Cleaning down to h = −0.5 leaves everything below it: G(−0.5).
    expect(cumulativeGoldShare(P, -0.5)).toBeCloseTo(0.0768, 4);
    // Skipping the cleanup entirely leaves s_b.
    expect(verticalGoldShareProfile(P, -1.5, 0)).toBeCloseTo(0.2, 12);
  });
});

describe('positionMult (§3.8 worked example 3)', () => {
  const cases: [string, number, number, number][] = [
    ['pit stops 2 ft above bedrock', 2, 6, 0.502],
    ['pit stopped by water 3 ft above bedrock', 3, 6, 0.365],
    ['exposure pan, upper 40% of gravel', 3.6, 6, 0.304],
    ['full gravel column, no bedrock', 0, 6, 1.0],
    ['full column + 1 ft bedrock', -1, 6, 1.046],
    ['bedrock scrape, bottom 1 ft gravel + top 1 ft bedrock', -1, 1, 1.905],
  ];
  for (const [what, h1, h2, want] of cases) {
    it(`${what}: ${want}`, () => {
      expect(Math.abs(positionMultProfile(P, h1, h2) - want)).toBeLessThanOrEqual(0.002);
    });
  }

  it('is 1 over the whole column and 0 for an empty interval', () => {
    expect(positionMultProfile(P, -1.5, 6)).toBeCloseTo(1, 12);
    expect(positionMultProfile(P, 2, 2)).toBe(0);
  });

  it('the BlockTruth forms equal the profile forms bit for bit', () => {
    const p = profileOf(BT, 0.6);
    expect(p).toEqual(P);
    for (const [h1, h2] of [
      [2, 6],
      [-1, 1],
      [-1.5, 6],
      [0.3, 4.4],
    ] as const) {
      expect(positionMult(BT, h1, h2, 0.6)).toBe(positionMultProfile(p, h1, h2));
      expect(verticalGoldShare(BT, h1, h2, 0.6)).toBe(verticalGoldShareProfile(p, h1, h2));
    }
  });
});
