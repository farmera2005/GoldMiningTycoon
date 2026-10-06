// DESIGN §7 7.11 operating costs (7.23 "Costs: the 7.11.1 week = $44,379 ± $5") and the 7.12 site-task prices.
import { describe, expect, it } from 'vitest';
import { EXPLAIN_ON } from '../../../core/calc';
import {
  campFuelGal,
  campUsd,
  consumablesUsd,
  deliveredFuelUsdPerGal,
  demobilizationUsd,
  machineFuelGal,
  mobilizationUsd,
  mobilizationWeeks,
  nightLightingGal,
  personDaysOnSite,
  revegetationUsd,
  siteMobilization,
  siteFixedUsd,
  smrHours,
  taskLoadFactor,
  waterTruckingUsd,
  weekOpsCosts,
  winterizeUsd,
  type WeekCostInput,
} from './costs';
import { DESIGN_PARAMS as P } from './testing/designTuning';

// The 7.11.1 week: seasonal road, diesel $3.60 + $0.90 freight; crew of 6 plus the owner; 1,625 gal of machine fuel.
const WEEK: WeekCostInput = {
  machineFuelGal: 1625,
  personDays: personDaysOnSite(6, true, 'running'),
  deliveredUsdPerGal: deliveredFuelUsdPerGal(3.6, 0.9, 1),
  consumables: {
    washedBcy: 3264,
    dugBcy: 3114,
    dugHardBcy: 0.21 * 3114,
    strippedBcy: 6999,
    strippedFrozenBcy: 1909,
    cpiIndex: 1,
  },
  campTier: 'standard',
  campCostMult: 1,
  winter: false,
  site: 'running',
  waterTrucksPerDay: 0,
  daysScheduled: 6,
  waterTruckCostMult: 1,
  cpiIndex: 1,
};
const MAINTENANCE_USD = 11135; // §9: 325 SMR hours at P1 rates
const WAGES_USD = 19951; // §8: $16,353 × 1.22

describe('the 7.11.1 week', () => {
  const c = weekOpsCosts(WEEK, P).value;

  it('fuel 1,625 + 172 gal camp at $4.50 ≈ $8,086; consumables ≈ $1,762; camp 49 × $55 = $2,695; site fixed $750', () => {
    expect(WEEK.personDays).toBe(49);
    expect(c.fuelGal).toBeCloseTo(1796.5, 9);
    expect(c.fuelUsd).toBeCloseTo(8086, -1);
    expect(c.consumablesUsd).toBeCloseTo(1762, -1);
    expect(c.campUsd).toBe(2695);
    expect(c.siteFixedUsd).toBe(750);
    expect(c.waterTruckingUsd).toBe(0);
  });

  it('totals $44,379 ± $5 with §9 maintenance and §8 wages, $13.60 per bcy washed', () => {
    const total = c.totalUsd + MAINTENANCE_USD + WAGES_USD;
    expect(Math.abs(total - 44379)).toBeLessThanOrEqual(5);
    expect(total / 3264).toBeCloseTo(13.6, 1);
    // Fuel plus wages are 63% of the week's cost.
    expect((c.fuelUsd + WAGES_USD) / total).toBeCloseTo(0.63, 2);
  });

  it('explains the cost lines without changing them', () => {
    const on = weekOpsCosts(WEEK, P, EXPLAIN_ON);
    expect(on.value).toEqual(c);
    expect(on.calc?.value).toBe(c.totalUsd);
  });
});

describe('fuel (7.11)', () => {
  it('a machine burns at task load while working and at idle load for the engine-running share of its wait', () => {
    // An ex30 (6.0 gph): 24.3 h of work and 35.0 h waiting on haul.
    expect(
      machineFuelGal({ workHours: 24.3, waitHours: 35, burnAtTaskGalHr: 6, burnAtIdleGalHr: 6 * 0.3 }, P),
    ).toBeCloseTo(183.6, 9);
    expect(smrHours(24.3, 35, P)).toBeCloseTo(45.3, 9);
  });

  it('task load factors: strip, dig, haul and plant 1.0, ripping 1.15, feed 0.85', () => {
    expect(taskLoadFactor('ripping', P)).toBe(1.15);
    expect(taskLoadFactor('feed', P)).toBe(0.85);
    expect(taskLoadFactor('haul', P)).toBe(1);
  });

  it('night lighting is free in the northern midnight-sun weeks 22–30', () => {
    expect(nightLightingGal(60, 28, true, P)).toBe(0);
    expect(nightLightingGal(60, 35, true, P)).toBe(120);
    expect(nightLightingGal(60, 28, false, P)).toBe(120);
  });

  it('the fuel-adder hook multiplies the freight adder, never the rack price', () => {
    expect(deliveredFuelUsdPerGal(3.6, 1.75, 2)).toBeCloseTo(7.1, 12);
    expect(campFuelGal(49, P)).toBeCloseTo(171.5, 12);
  });
});

describe('person-days, camp and site costs (7.11, s07 #23)', () => {
  it('person-days count standby crew and the owner while the site is open', () => {
    expect(personDaysOnSite(3, false, 'ready')).toBe(21);
    expect(personDaysOnSite(3, true, 'winterized')).toBe(0);
    expect(personDaysOnSite(3, true, 'none')).toBe(0);
    expect(siteFixedUsd('winterized', 1, P)).toBe(0);
    expect(siteFixedUsd('mobilizing', 1.1, P)).toBeCloseTo(825, 9);
  });

  it('camp tiers, the winter multiplier and the camp-cost hook', () => {
    const base = { personDays: 49, tier: 'basic' as const, cpiIndex: 1, costMult: 1, winter: false };
    expect(campUsd(base, P).value).toBeCloseTo(2156, 9);
    expect(campUsd({ ...base, tier: 'premium', winter: true }, P).value).toBeCloseTo(49 * 55 * 1.5 * 1.4, 9);
    expect(campUsd({ ...base, costMult: 1.2 }, P).value).toBeCloseTo(2156 * 1.2, 9);
  });

  it('frozen or bedrock bcy cost double on their tools', () => {
    const c = consumablesUsd(
      { washedBcy: 0, dugBcy: 1000, dugHardBcy: 1000, strippedBcy: 1000, strippedFrozenBcy: 0, cpiIndex: 1 },
      P,
    ).value;
    expect(c).toBeCloseTo(100 + 30, 9);
  });

  it('water trucks: $1,400 per truck-day × cpi × the trucking hook', () => {
    expect(waterTruckingUsd(1, 6, 1, 1, P)).toBe(8400);
    expect(waterTruckingUsd(2, 7, 1.1, 1.5, P)).toBeCloseTo(2 * 7 * 1400 * 1.1 * 1.5, 9);
  });
});

describe('site tasks (7.12)', () => {
  it('mobilization $12,000 × mobMult × cpi; demobilization 0.6 of it; weeks by access', () => {
    expect(mobilizationUsd(1.5, 1, P)).toBe(18000);
    expect(demobilizationUsd(1.5, 1, P)).toBeCloseTo(10800, 9);
    expect(mobilizationWeeks('winterTrail', P)).toBe(2);
    expect(mobilizationWeeks('highway', P)).toBe(1);
    expect(siteMobilization({ mobMult: 1.5, cpiIndex: 1, access: 'winterTrail' }, P).value).toEqual({
      usd: 18000,
      weeks: 2,
      demobUsd: 10800,
    });
  });

  it('winterizing $3,000 × cpi; revegetation $600 per acre', () => {
    expect(winterizeUsd(1.05, P)).toBeCloseTo(3150, 9);
    expect(revegetationUsd(1.5, 1, P)).toBe(900);
  });
});
