// DESIGN §7 7.4 material classes, rip assist and groundTaskMult (7.23 "fully thawed column dig mult = 0.849",
// the season-ahead table, the 7.8 dig rate).
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { TuningResolved } from '../../../../data/tuning';
import { EXPLAIN_ON } from '../../../core/calc';
import {
  REFERENCE_GROUND,
  boulderDigFactor,
  cementationStripFactor,
  digCapacity,
  digColumnTimes,
  digMultColumn,
  digMultFromTimes,
  digSequenceMult,
  frozenMixMult,
  groundTaskMult,
  groundTaskMultForTuning,
  pushFactorOf,
  ripCapacityBcy,
  type DigColumnMaterial,
} from './ground';
import { DESIGN_PARAMS as P, OPS_DESIGN_TUNING } from './testing/designTuning';
import type { GroundCtx } from './types';

// The 7.4 season-ahead block: p = 1.0, a 7.5 ft column (5.5 ft gravel + 2 ft bedrock take), no boulders.
const SEASON_AHEAD = (thawedFt: number): DigColumnMaterial => ({
  gravelFt: 5.5,
  bedrockFt: 2,
  thawedFt,
  permafrost: 1,
});

describe('dig multiplier of the column (7.4)', () => {
  it('a fully thawed 5.5 + 2 ft column digs at 0.849 (7.23)', () => {
    expect(digMultColumn(SEASON_AHEAD(7.5), 0, P).value).toBeCloseTo(0.849, 3);
  });

  // [thaw ft, unripped, ripped] from 7.4's "why strip a season ahead" table.
  const rows: [number, number, number][] = [
    [2.28, 0.47, 0.75],
    [2.72, 0.5, 0.76],
    [3.88, 0.58, 0.79],
    [3.36, 0.54, 0.78],
    [4.34, 0.62, 0.8],
  ];
  it.each(rows)('thawed %s ft → %s unripped / %s ripped', (thaw, unripped, ripped) => {
    expect(digMultColumn(SEASON_AHEAD(thaw), 0, P).value).toBeCloseTo(unripped, 2);
    expect(digMultColumn(SEASON_AHEAD(thaw), 1, P).value).toBeCloseTo(ripped, 2);
  });

  it('the 7.8 cut (5.5 ft gravel + 1.5 ft bedrock, thawed, boulders 0.1) digs at 0.853 → 128.0 bcy/hr', () => {
    const col: DigColumnMaterial = { gravelFt: 5.5, bedrockFt: 1.5, thawedFt: 7, permafrost: 0.6 };
    const mult = digMultColumn(col, 0, P).value;
    expect(mult).toBeCloseTo(0.875, 12);
    const cap = digCapacity({ refRate: 150, boulders: 0.1, seqMult: 1, u: 0.8993, column: col, ripCapBcy: 0 }, P).value;
    expect(cap.digRateBcyHr).toBeCloseTo(127.97, 2);
    expect(cap.digBcy).toBeCloseTo(127.97 * 0.8993, 1);
    expect(cap.rippedBcy).toBe(0);
  });

  it('frozen mix multipliers are harmonic means', () => {
    expect(frozenMixMult(0.6, 0.3)).toBeCloseTo(1 / (0.4 + 2), 12);
    expect(frozenMixMult(0, 0.08)).toBe(1);
    expect(frozenMixMult(1, 0.35)).toBeCloseTo(0.35, 12);
  });

  it('deeper thaw never lowers the dig rate (property, 7.23 monotonicity)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 8, noNaN: true }),
        fc.double({ min: 0, max: 3, noNaN: true }),
        fc.double({ min: 0, max: 10, noNaN: true }),
        fc.double({ min: 0, max: 10, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (g, b, t1, t2, pf, rho) => {
          const lo = Math.min(t1, t2);
          const hi = Math.max(t1, t2);
          const a = digMultColumn({ gravelFt: g, bedrockFt: b, thawedFt: lo, permafrost: pf }, rho, P).value;
          const c = digMultColumn({ gravelFt: g, bedrockFt: b, thawedFt: hi, permafrost: pf }, rho, P).value;
          expect(c).toBeGreaterThanOrEqual(a - 1e-12);
        },
      ),
    );
  });
});

describe('rip assist (7.4)', () => {
  const col = SEASON_AHEAD(2.28);
  const base = { refRate: 150, boulders: 0, seqMult: 1, u: 0.9, column: col };

  it('rip capacity is Σ rate × ops.stripFrozenMult.dozerRipper × u', () => {
    expect(ripCapacityBcy([{ refRate: 250, u: 0.9 }], P)).toBeCloseTo(67.5, 12);
  });

  it('no rip capacity digs at the unripped multiplier; ample capacity at the ripped one', () => {
    const none = digCapacity({ ...base, ripCapBcy: 0 }, P).value;
    expect(none.digMult).toBeCloseTo(digMultColumn(col, 0, P).value, 12);
    const ample = digCapacity({ ...base, ripCapBcy: 1e6 }, P).value;
    expect(ample.digMult).toBeCloseTo(digMultColumn(col, 1, P).value, 12);
    expect(ample.rippedShare).toBeCloseTo(1, 12);
  });

  it('partial rip capacity rips exactly R frozen bcy and spends the hour exactly', () => {
    const r = 20;
    const c = digCapacity({ ...base, ripCapBcy: r }, P).value;
    const t = digColumnTimes(col, P);
    expect(c.rippedBcy).toBe(r);
    const frozen = c.digBcy * t.frozenShare;
    const hours =
      c.digBcy * t.nonFrozen + (r / t.frozenShare) * t.frozenRipped + ((frozen - r) / t.frozenShare) * t.frozenUnripped;
    expect(hours).toBeCloseTo(150 * 0.9, 9);
    expect(c.digMult).toBeGreaterThan(digMultColumn(col, 0, P).value);
    expect(c.digMult).toBeLessThan(digMultColumn(col, 1, P).value);
  });

  it('dig capacity is continuous and non-decreasing in rip capacity (property)', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 200, noNaN: true }),
        fc.double({ min: 0, max: 200, noNaN: true }),
        (a, b) => {
          const lo = digCapacity({ ...base, ripCapBcy: Math.min(a, b) }, P).value.digBcy;
          const hi = digCapacity({ ...base, ripCapBcy: Math.max(a, b) }, P).value.digBcy;
          expect(hi).toBeGreaterThanOrEqual(lo - 1e-9);
        },
      ),
    );
  });
});

describe('task multipliers', () => {
  it('boulders, the down-valley sequence (P2+) and cementation (s07 #19)', () => {
    expect(boulderDigFactor(0.1, P)).toBeCloseTo(0.975, 12);
    expect(digSequenceMult(true, false, true, P)).toBe(0.9);
    expect(digSequenceMult(true, true, true, P)).toBe(1);
    expect(digSequenceMult(true, false, false, P)).toBe(1);
    expect(cementationStripFactor(0.3, P)).toBeCloseTo(1 / 1.15, 12);
    expect(cementationStripFactor(0, P)).toBe(1);
  });

  it('push factor: 150 ft → 1; 200 ft → 0.772; 300 ft → 0.536', () => {
    expect(pushFactorOf(150, P)).toBeCloseTo(1, 12);
    expect(pushFactorOf(200, P)).toBeCloseTo(0.772, 3);
    expect(pushFactorOf(300, P)).toBeCloseTo(0.536, 3);
  });
});

describe('groundTaskMult (D-7.2)', () => {
  it('is 1 at the reference ground for digging, feeding and dozer stripping', () => {
    expect(groundTaskMult('excavator', 'dig', REFERENCE_GROUND, P)).toBe(1);
    expect(groundTaskMult('loader', 'feed', REFERENCE_GROUND, P)).toBe(1);
    expect(groundTaskMult('dozer', 'strip', REFERENCE_GROUND, P)).toBeCloseTo(1, 12);
    expect(groundTaskMult('artTruck', 'haul', REFERENCE_GROUND, P)).toBe(1);
    expect(groundTaskMult('washPlant', 'dig', REFERENCE_GROUND, P)).toBe(1);
  });

  it('reproduces the 7.4 material table', () => {
    const frozen: GroundCtx = { ...REFERENCE_GROUND, frozenShare: 1 };
    const bedrock: GroundCtx = { ...REFERENCE_GROUND, bedrockShare: 1 };
    expect(groundTaskMult('excavator', 'dig', frozen, P)).toBeCloseTo(0.35, 12);
    expect(groundTaskMult('excavator', 'dig', { ...frozen, ripping: true }, P)).toBeCloseTo(0.8, 12);
    expect(groundTaskMult('excavator', 'dig', bedrock, P)).toBeCloseTo(0.6, 12);
    expect(groundTaskMult('excavator', 'dig', { ...bedrock, frozenShare: 1 }, P)).toBeCloseTo(0.45, 12);
    expect(groundTaskMult('excavator', 'dig', { ...bedrock, frozenShare: 1, ripping: true }, P)).toBeCloseTo(0.55, 12);
    expect(groundTaskMult('excavator', 'strip', REFERENCE_GROUND, P)).toBeCloseTo(0.75, 12);
    expect(groundTaskMult('excavator', 'strip', frozen, P)).toBeCloseTo(0.2625, 12);
    expect(groundTaskMult('dozer', 'strip', { ...frozen, ripping: true }, P)).toBeCloseTo(0.3, 12);
    expect(groundTaskMult('dozer', 'strip', frozen, P)).toBeCloseTo(0.08, 12);
    expect(groundTaskMult('dozer', 'rip', REFERENCE_GROUND, P)).toBeCloseTo(0.3, 12);
    expect(groundTaskMult('loader', 'digTailings', REFERENCE_GROUND, P)).toBeCloseTo(1.15, 12);
    expect(groundTaskMult('excavator', 'dig', { ...REFERENCE_GROUND, boulders: 0.1 }, P)).toBeCloseTo(0.975, 12);
    expect(groundTaskMult('dozer', 'strip', { ...REFERENCE_GROUND, pushFt: 200 }, P)).toBeCloseTo(0.772, 3);
  });

  it('reads the kernel parameters from a game tuning object', () => {
    const tuning = { ...OPS_DESIGN_TUNING } as unknown as TuningResolved;
    expect(groundTaskMultForTuning(tuning, 'excavator', 'strip', REFERENCE_GROUND)).toBeCloseTo(0.75, 12);
  });

  it('agrees with the column model on a mixed ground', () => {
    const g: GroundCtx = { ...REFERENCE_GROUND, frozenShare: 0.4, bedrockShare: 0.25 };
    const t = digColumnTimes({ gravelFt: 3, bedrockFt: 1, thawedFt: 0, permafrost: 0.4 }, P);
    expect(groundTaskMult('excavator', 'dig', g, P)).toBeCloseTo(digMultFromTimes(t, 0), 12);
  });
});

describe('explanations', () => {
  it('never change dig values', () => {
    const input = { refRate: 150, boulders: 0.2, seqMult: 1, u: 0.85, column: SEASON_AHEAD(3), ripCapBcy: 15 };
    const off = digCapacity(input, P);
    const on = digCapacity(input, P, EXPLAIN_ON);
    expect(on.value).toEqual(off.value);
    expect(on.calc?.value).toBe(off.value.digBcy);
  });
});
