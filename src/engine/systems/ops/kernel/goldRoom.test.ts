// DESIGN §7 7.10 cleanup and the gold room (7.23 "Cleanup", "Skim (P5)", "Security"). The worked box is two weeks of
// the 7.8 claim: 51.408 oz of metal, split 30.5 / 44.95 / 21.85 / 2.7% by size, which loses 0.623 oz in a gold room
// without a table and 0.230 oz with one, as 7.10 states.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { EXPLAIN_ON } from '../../../core/calc';
import { goldRoom, goldRoomDirtFrac, siteSecurity, skimProbability } from './goldRoom';
import { DESIGN_PARAMS as P } from './testing/designTuning';
import { sumSizes, type GoldParcelK } from './types';

const BOX_OZ = 51.408;
const BOX: GoldParcelK = {
  rawOz: { coarse: BOX_OZ * 0.305, medium: BOX_OZ * 0.4495, fine: BOX_OZ * 0.2185, ultrafine: BOX_OZ * 0.027 },
  fineOz: BOX_OZ * 0.85,
};

function identityGap(box: GoldParcelK, r: ReturnType<typeof goldRoom>['value']): number {
  return (
    sumSizes(box.rawOz) -
    (sumSizes(r.grLoss.rawOz) + sumSizes(r.skim.rawOz) + r.weighedMetalOz + sumSizes(r.remainder.rawOz))
  );
}

describe('the gold room and the scale (7.10)', () => {
  it('no table: losses 0.623 oz, metal 50.785 oz, the scale reads 52.901 raw oz (4% dirt)', () => {
    const r = goldRoom({ box: BOX, hasTable: false, skillMult: 1, skimmed: false }, P).value;
    expect(sumSizes(r.grLoss.rawOz)).toBeCloseTo(0.623, 3);
    expect(r.metalOz).toBeCloseTo(50.785, 3);
    expect(r.dirtFrac).toBe(0.04);
    expect(r.rawWeighedMilliOz).toBe(52901);
    expect(r.rawWeighedOz).toBe(52.901);
    expect(sumSizes(r.remainder.rawOz)).toBeGreaterThanOrEqual(0);
    expect(Math.abs(identityGap(BOX, r))).toBeLessThan(1e-12);
  });

  it('with a shaker table: losses 0.230 oz and 52.222 raw oz of cleaner gold (2% dirt), 0.39 oz more metal', () => {
    const noTable = goldRoom({ box: BOX, hasTable: false, skillMult: 1, skimmed: false }, P).value;
    const r = goldRoom({ box: BOX, hasTable: true, skillMult: 1, skimmed: false }, P).value;
    expect(sumSizes(r.grLoss.rawOz)).toBeCloseTo(0.23, 3);
    expect(r.rawWeighedOz).toBe(52.222);
    expect(r.metalOz - noTable.metalOz).toBeCloseTo(0.39, 2);
  });

  it('a 12% raw-oz royalty in kind leaves a 46.553 raw oz lot of 37.99 fine oz at 0.85 alloy fineness', () => {
    const r = goldRoom({ box: BOX, hasTable: false, skillMult: 1, skimmed: false }, P).value;
    const royalty = Math.round(r.rawWeighedMilliOz * 0.12);
    expect(royalty).toBe(6348);
    const lot = (r.rawWeighedMilliOz - royalty) / 1000;
    expect(lot).toBe(46.553);
    expect(r.alloyFineness).toBeCloseTo(0.85, 12);
    expect(lot * 0.96 * 0.85).toBeCloseTo(37.99, 2);
    expect(r.weighedFineOz).toBeCloseTo(r.rawWeighedOz * 0.96 * 0.85, 12);
  });

  it('a forced skim (P5) takes 2.031 oz and the scale reads 50.785 raw oz', () => {
    const r = goldRoom({ box: BOX, hasTable: false, skillMult: 1, skimmed: true }, P).value;
    expect(sumSizes(r.skim.rawOz)).toBeCloseTo(2.031, 3);
    expect(r.rawWeighedOz).toBe(50.785);
    expect(Math.abs(identityGap(BOX, r))).toBeLessThan(1e-12);
  });

  it('a weaker gold-room operator loses more and leaves more dirt', () => {
    expect(goldRoomDirtFrac(false, 1.5, P)).toBeCloseTo(0.06, 12);
    const weak = goldRoom({ box: BOX, hasTable: false, skillMult: 1.5, skimmed: false }, P).value;
    expect(sumSizes(weak.grLoss.rawOz)).toBeCloseTo(0.623 * 1.5, 2);
  });

  it('an empty box weighs nothing', () => {
    const empty: GoldParcelK = { rawOz: { coarse: 0, medium: 0, fine: 0, ultrafine: 0 }, fineOz: 0 };
    const r = goldRoom({ box: empty, hasTable: false, skillMult: 1, skimmed: false }, P).value;
    expect(r.rawWeighedMilliOz).toBe(0);
    expect(r.alloyFineness).toBe(0);
  });

  it('box = weighed × (1 − dirt) + gold-room loss + skim + remainder, with remainder ≥ 0, for any box (property)', () => {
    const oz = fc.double({ min: 0, max: 200, noNaN: true });
    fc.assert(
      fc.property(
        fc.record({ coarse: oz, medium: oz, fine: oz, ultrafine: oz }),
        fc.double({ min: 0.6, max: 0.95, noNaN: true }),
        fc.boolean(),
        fc.boolean(),
        fc.double({ min: 0.75, max: 1.5, noNaN: true }),
        (raw, fineness, table, skimmed, mult) => {
          const box: GoldParcelK = { rawOz: raw, fineOz: sumSizes(raw) * fineness };
          const r = goldRoom({ box, hasTable: table, skillMult: mult, skimmed }, P).value;
          expect(sumSizes(r.remainder.rawOz)).toBeGreaterThanOrEqual(0);
          expect(sumSizes(r.remainder.rawOz)).toBeLessThan(0.001);
          expect(Math.abs(identityGap(box, r))).toBeLessThan(1e-9);
          const fineGap = box.fineOz - (r.grLoss.fineOz + r.skim.fineOz + r.weighedFineOz + r.remainder.fineOz);
          expect(Math.abs(fineGap)).toBeLessThan(1e-9);
        },
      ),
    );
  });

  it('explains the weighing without changing it', () => {
    const input = { box: BOX, hasTable: false, skillMult: 1, skimmed: false };
    const on = goldRoom(input, P, EXPLAIN_ON);
    expect(on.value).toEqual(goldRoom(input, P).value);
    expect(on.calc?.value).toBe(52.901);
  });
});

describe('site security and the skim odds (7.10)', () => {
  it('a wall-tent camp (0.20) with the owner present → 0.35; 0.85 with the owner → capped at 0.90', () => {
    expect(siteSecurity(0.2, true, P)).toBeCloseTo(0.35, 12);
    expect(siteSecurity(0.85, true, P)).toBe(0.9);
    expect(siteSecurity(0.2, false, P)).toBe(0.2);
  });

  it('reliability 30, security 0.20 → 0.0980; half on a gold share 0.0735; owner on the claim 0.0796; owner-only 0', () => {
    const base = { minCrewReliability: 30, security: 0.2, highGradeMult: 1, crewGoldShareFrac: 0 };
    expect(skimProbability(base, P)).toBeCloseTo(0.098, 4);
    expect(skimProbability({ ...base, crewGoldShareFrac: 0.5 }, P)).toBeCloseTo(0.0735, 4);
    expect(skimProbability({ ...base, security: siteSecurity(0.2, true, P) }, P)).toBeCloseTo(0.0796, 4);
    expect(skimProbability({ ...base, minCrewReliability: 100 }, P)).toBe(0);
  });
});
