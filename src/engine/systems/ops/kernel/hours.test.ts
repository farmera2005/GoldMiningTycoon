// DESIGN §7 7.5 usable hours (the 7.8 example's u = 0.8993, servicing 5.3 h and coordination 1.4 h), 7.2 supervision
// efficiency (7.23 "Supervision") and 7.12 season factors.
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { EXPLAIN_ON } from '../../../core/calc';
import { foremanEfficiency, mechanicalAvailability, seasonFactor, usableFraction, type UsableSplit } from './hours';
import { DESIGN_PARAMS as P } from './testing/designTuning';
import type { OpsRoleK, SeasonPhaseK, TempBand } from './types';

function lost(s: UsableSplit): number {
  return s.unstaffed + s.servicing + s.breakdown + s.operatorAbsent + s.coordination + s.weather + s.season;
}

describe('u(m, t) and its cause split (7.5)', () => {
  it('the 7.8 week: owner foreman skill 85 → F 0.9775, u 0.8993; 66 h lose 5.3 h servicing and 1.4 h coordination', () => {
    const f = foremanEfficiency('owner', 85, P).value;
    expect(f).toBeCloseTo(0.9775, 12);
    const s = usableFraction({
      staffed: true,
      availability: mechanicalAvailability(false, 0, P),
      operatorAvail: 1,
      foremanEff: f,
      weatherMult: 1,
      seasonMult: 1,
    }).value;
    expect(s.u).toBeCloseTo(0.8993, 4);
    expect(s.servicing * 66).toBeCloseTo(5.28, 2);
    expect(s.coordination * 66).toBeCloseTo(1.37, 2);
  });

  it('the parts sum to the hour exactly, whatever the factors (property)', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        fc.boolean(),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.double({ min: 0, max: 1, noNaN: true }),
        (staffed, masked, a, e, w, z) => {
          const s = usableFraction({
            staffed,
            availability: a,
            masked,
            operatorAvail: e,
            foremanEff: 0.95,
            weatherMult: w,
            seasonMult: z,
          }).value;
          expect(s.u + lost(s)).toBeCloseTo(1, 12);
          expect(s.u).toBeGreaterThanOrEqual(0);
        },
      ),
    );
  });

  it('an unstaffed hour is all unstaffed; a masked hour is breakdown, not servicing', () => {
    const base = { availability: 0.92, operatorAvail: 1, foremanEff: 1, weatherMult: 1, seasonMult: 1 };
    expect(usableFraction({ ...base, staffed: false }).value).toMatchObject({ u: 0, unstaffed: 1, servicing: 0 });
    expect(usableFraction({ ...base, staffed: true, masked: true }).value).toMatchObject({
      u: 0,
      breakdown: 1,
      servicing: 0,
    });
  });

  it('applies the causes in order: weather is cut after coordination', () => {
    const s = usableFraction({
      staffed: true,
      availability: 1,
      operatorAvail: 0.5,
      foremanEff: 0.9,
      weatherMult: 0.8,
      seasonMult: 1,
    }).value;
    expect(s.operatorAbsent).toBeCloseTo(0.5, 12);
    expect(s.coordination).toBeCloseTo(0.05, 12);
    expect(s.weather).toBeCloseTo(0.09, 12);
    expect(s.u).toBeCloseTo(0.36, 12);
  });

  it('P3 availability is the routine value plus the site-support bonus', () => {
    expect(mechanicalAvailability(true, 0.01, P)).toBeCloseTo(0.98, 12);
    expect(mechanicalAvailability(false, 0.01, P)).toBe(0.92);
  });
});

describe('supervision efficiency (7.2, 7.23 "Supervision")', () => {
  it('a skill-70 hired foreman gives 0.955; a skill-55 lead hand (qF 33) 0.8995; a small crew 0.92; none 0', () => {
    expect(foremanEfficiency('hired', 70, P).value).toBeCloseTo(0.955, 12);
    expect(foremanEfficiency('leadHand', 0.6 * 55, P).value).toBeCloseTo(0.8995, 12);
    expect(foremanEfficiency('smallCrew', 36, P).value).toBe(0.92);
    expect(foremanEfficiency('none', 80, P).value).toBe(0);
  });

  it('explains the small crew by its tuning key', () => {
    expect(foremanEfficiency('smallCrew', 0, P, EXPLAIN_ON).calc?.source).toEqual({
      kind: 'tuning',
      key: 'ops.noForemanEfficiency',
    });
  });
});

describe('season factor Z (7.5, 7.12)', () => {
  const z = (
    phase: SeasonPhaseK,
    role: OpsRoleK,
    band: TempBand = 'mild',
    extra: { winterOps?: boolean; freezeupByBand?: boolean } = {},
  ) => seasonFactor({ phase, role, tempBand: band, ...extra }, P).value;

  it('winter: nothing washes; earthworks only with winterOps, never in deep cold', () => {
    expect(z('winter', 'plant')).toBe(0);
    expect(z('winter', 'strip', 'cold')).toBe(0);
    expect(z('winter', 'strip', 'cold', { winterOps: true })).toBe(0.8);
    expect(z('winter', 'dig', 'deepCold', { winterOps: true })).toBe(0);
    expect(z('winter', 'reclaim', 'cold', { winterOps: true })).toBe(0);
  });

  it('breakup: strip and dig at 0.6, no washing, hauling unaffected', () => {
    expect(z('breakup', 'strip')).toBe(0.6);
    expect(z('breakup', 'dig')).toBe(0.6);
    expect(z('breakup', 'plant')).toBe(0);
    expect(z('breakup', 'haul')).toBe(1);
  });

  it('operating: the plant loses cool-week nights (0.80); freeze-up plant 0.6 flat (P1) or by band (P5)', () => {
    expect(z('operating', 'plant', 'cool')).toBe(0.8);
    expect(z('operating', 'plant', 'mild')).toBe(1);
    expect(z('operating', 'dig', 'cool')).toBe(1);
    expect(z('freezeup', 'plant', 'cold')).toBe(0.6);
    expect(z('freezeup', 'plant', 'cold', { freezeupByBand: true })).toBe(0.5);
    expect(z('freezeup', 'plant', 'deepCold', { freezeupByBand: true })).toBe(0);
    expect(z('freezeup', 'strip', 'cold')).toBe(1);
  });
});
