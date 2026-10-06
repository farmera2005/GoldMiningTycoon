// The §9 equipment data against DESIGN §9 (9.2 catalog, 9.3 prices, 9.5 transport, 9.14 P1 maintenance, 9.15
// tuning, 9.17 tests, D-9.57–D-9.75) and BALANCE T-09: zod validation, every cross-reference, the values DESIGN's
// tables state, and the worked examples recomputed from the data. The formulas here are small reference versions
// written in the test so the data is pinned before §9's engine code exists; fleet-core's own tests check its
// implementation against the same examples.
import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import { hookRegistry } from '../events/hooks';
import { gameTuning } from '../tuning/game';
import { fleetTuning, fleetTuningAliases } from '../tuning/fleet';
import type { TuningValue } from '../tuning/types';
import {
  BRAND_IDS,
  CLASS_IDS,
  EQUIPMENT_BRANDS,
  EQUIPMENT_CLASSES,
  EQUIPMENT_MODELS,
  EQUIPMENT_PACKAGES,
  INHERITED_FLEET_SPEC,
  MODEL_IDS,
  P1_MODEL_IDS,
  TOOL_MODEL_IDS,
  isBrandId,
  isModelId,
  type BrandId,
  type DepFamily,
  type EquipmentModel,
  type ModelId,
} from '.';
import {
  FLEET_TUNING_KEY_SCHEMAS,
  LISTING_GROUPS,
  equipmentBrandsSchema,
  equipmentClassesSchema,
  equipmentModelsSchema,
  equipmentPackagesSchema,
  inheritedFleetSpecSchema,
} from '../../../tests/data/schemas/equipment';

function problems(schema: z.ZodType, value: unknown): string[] {
  const r = schema.safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
}

const T = fleetTuning;
const TUNING: Readonly<Record<string, TuningValue>> = fleetTuning;
const has = (rec: object, key: string): boolean => Object.prototype.hasOwnProperty.call(rec, key);
const model = (id: ModelId): EquipmentModel => EQUIPMENT_MODELS[id];
const classOf = (id: ModelId) => EQUIPMENT_CLASSES[model(id).classId];
const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);
type Grade = 'A' | 'B' | 'C' | 'D';

// ------------------------------------------------------------------------------------- reference formulas (9.3.2)

function depF(family: DepFamily, ageEq: number): number {
  const c = T[`fleet.depCurve.${family}`];
  return c.a * Math.exp(-c.lambda * ageEq) + c.f;
}

function ageEqOf(id: ModelId, ageYr: number, hours: number): number {
  const w = T['fleet.hoursWeight'][classOf(id).depFamily];
  return (1 - w) * ageYr + (w * hours) / T['fleet.refHoursPerYear'];
}

function condRef(hours: number): number {
  const knots = T['fleet.condRefByHours'];
  const last = knots[knots.length - 1] as readonly [number, number];
  if (hours >= last[0]) return last[1];
  for (let i = 1; i < knots.length; i++) {
    const [h1, v1] = knots[i] as readonly [number, number];
    const [h0, v0] = knots[i - 1] as readonly [number, number];
    if (hours <= h1) return v0 + ((v1 - v0) * (hours - h0)) / (h1 - h0);
  }
  return last[1];
}

/** P1 used price (9.3.2, D-9.58–D-9.60): (newBase + options) × dep at condRef × the grade's price multiplier. */
function p1UsedAskUsd(id: ModelId, ageYr: number, hours: number, grade: Grade, optionsUsd = 0): number {
  return (
    (model(id).newBaseUsd + optionsUsd) *
    depF(classOf(id).depFamily, ageEqOf(id, ageYr, hours)) *
    T['fleet.p1GradePriceMult'][grade]
  );
}

/** Hours of a dealer graded-used offer (D-9.58): age × the median, × 0.6 for plants and light items. */
function offerHours(id: ModelId, ageYr: number): number {
  const lightOrPlant = ['plant', 'light'].includes(classOf(id).depFamily);
  return ageYr * T['fleet.hoursPerYearMedian'] * (lightOrPlant ? T['fleet.lightPlantHoursMult'] : 1);
}

// ------------------------------------------------------------------------------------- reference transport (9.5)

interface Leg {
  readonly kind: 'paved' | 'seasonalRoad' | 'winterTrail';
  readonly miles: number;
}

function legRate(kind: Leg['kind']): number {
  if (kind === 'paved') return T['fleet.lowboyUsdPerLoadedMile'] * T['fleet.lowboyDeadheadMult'];
  return T['fleet.legUsdPerLoadMile'][kind];
}

function loadsOf(ids: readonly ModelId[]): { heavy: number; light: number; total: number; os: number } {
  let heavy = 0;
  let lightHundredths = 0; // fractional light loads in integer hundredths, so 0.3 + 0.4 + … sums exactly
  let os = 0;
  for (const id of ids) {
    const m = model(id);
    if (m.transport.selfPropelled) continue;
    if (classOf(id).loadPool === 'heavy') heavy += m.transport.loads;
    else lightHundredths += Math.round(m.transport.loads * 100);
    if (m.transport.oversize) os += 1;
  }
  const light = lightHundredths / 100;
  return { heavy, light, total: heavy + Math.ceil(lightHundredths / 100), os };
}

function transportUsd(ids: readonly ModelId[], mobMultClass: number, legs: readonly Leg[]): number {
  const { total, os } = loadsOf(ids);
  const perLoad = T['fleet.lowboyLoadFixedUsd'] * mobMultClass + sum(legs.map((l) => l.miles * legRate(l.kind)));
  const assembly = sum(ids.map((id) => model(id).transport.assemblyCrewHours ?? 0)) * T['fleet.riggingUsdPerHr'];
  return total * perLoad + os * T['fleet.permitOsUsd'] + assembly;
}

// ------------------------------------------------------------------------------------------- DESIGN's tables

/** 9.2.2–9.2.4: new $, the rate spec (or capacity), gph and hp as the tables state them. */
const DESIGN_ROWS: Readonly<Record<ModelId, { usd: number; rate?: number; gph: number; hp?: number }>> = {
  ex20: { usd: 280_000, rate: 100, gph: 4.0, hp: 165 },
  ex30: { usd: 430_000, rate: 150, gph: 6.0, hp: 290 },
  ex45: { usd: 650_000, rate: 240, gph: 9.0, hp: 415 },
  dz6: { usd: 520_000, rate: 130, gph: 5.5, hp: 220 },
  dz8: { usd: 1_050_000, rate: 250, gph: 10.0, hp: 360 },
  dz9: { usd: 1_500_000, rate: 380, gph: 14.0, hp: 460 },
  adt30: { usd: 560_000, rate: 18, gph: 6.0, hp: 360 },
  adt40: { usd: 700_000, rate: 24, gph: 7.5, hp: 490 },
  ld950: { usd: 380_000, rate: 110, gph: 4.0, hp: 230 },
  ld966: { usd: 500_000, rate: 170, gph: 5.5, hp: 300 },
  ld980: { usd: 720_000, rate: 260, gph: 6.5, hp: 400 },
  grz40: { usd: 38_000, rate: 40, gph: 0 },
  tr50: { usd: 120_000, rate: 50, gph: 3.0, hp: 75 },
  tr75: { usd: 180_000, rate: 75, gph: 4.0, hp: 100 },
  tr150: { usd: 380_000, rate: 150, gph: 6.0, hp: 150 },
  tr300: { usd: 950_000, rate: 300, gph: 0 },
  dw20: { usd: 35_000, rate: 20, gph: 1.5, hp: 25 },
  scrub: { usd: 140_000, gph: 0 },
  jigS: { usd: 30_000, rate: 25, gph: 0 },
  cenM: { usd: 110_000, rate: 35, gph: 0 },
  cenL: { usd: 240_000, rate: 90, gph: 0 },
  cnv24: { usd: 60_000, rate: 150, gph: 0 },
  pmp6: { usd: 38_000, rate: 1_500, gph: 2.5 },
  pmp10: { usd: 95_000, rate: 3_800, gph: 6.0 },
  gen100: { usd: 50_000, rate: 100, gph: 5.4 },
  gen300: { usd: 120_000, rate: 300, gph: 15.5 },
  gen500: { usd: 200_000, rate: 500, gph: 26 },
  pickup: { usd: 65_000, gph: 0 },
  campT8: { usd: 40_000, gph: 0 },
  campM25: { usd: 450_000, gph: 0 },
  tank10k: { usd: 48_000, gph: 0 },
  rocker: { usd: 900, gph: 0 },
  drywasherHand: { usd: 1_500, gph: 0 },
  testPlant: { usd: 9_000, gph: 0.6 },
};

/** 9.2.7: the P1 catalog. */
const P1_MACHINES = [
  'ex20',
  'ex30',
  'dz6',
  'dz8',
  'ld950',
  'ld966',
  'adt30',
  'grz40',
  'tr50',
  'tr75',
  'tr150',
  'dw20',
  'jigS',
  'cenM',
  'pmp6',
  'gen100',
  'pickup',
  'campT8',
] as const;
/** D-9.57 phase-3 rows, the other pkg300 items and 9.5's example tank. */
const PHASE3 = [
  'ex45',
  'dz9',
  'adt40',
  'ld980',
  'tr300',
  'cenL',
  'pmp10',
  'gen300',
  'campM25',
  'scrub',
  'cnv24',
  'gen500',
  'tank10k',
] as const;

/** Every 9.2 size slot by listing group (the rows P3 adds included), for the listing-weight check. */
const DESIGN_SLOTS: Readonly<Record<(typeof LISTING_GROUPS)[number], readonly string[]>> = {
  excavator: ['ex13', 'ex20', 'ex30', 'ex45', 'ex70'],
  dozer: ['dz6', 'dz7', 'dz8', 'dz9', 'dz10'],
  artTruck: ['adt25', 'adt30', 'adt40'],
  loader: ['ld950', 'ld966', 'ld980'],
  washPlant: [
    'grz40',
    'tr30',
    'tr50',
    'tr75',
    'tr150',
    'tr300',
    'der150',
    'sh200',
    'sh350',
    'dw20',
    'scrub',
    'run3x24',
  ],
  pump: ['pmp4', 'pmp6', 'pmp8', 'pmp10', 'pmp12'],
  generator: ['gen50', 'gen100', 'gen200', 'gen300', 'gen500'],
  other: [
    'jigS',
    'jigL',
    'cenS',
    'cenM',
    'cenL',
    'table',
    'goldRoom',
    'stk30',
    'cnv24',
    'drAug',
    'drRC',
    'drBeck',
    'drSonic',
    'svcTruck',
    'fuelTruck',
    'tank1k',
    'tank10k',
    'lowboy',
    'pickup',
    'shopBldg',
    'campT8',
    'campS12',
    'campSlp6',
    'campM25',
    'campP25',
    'campSafe',
    'rocker',
    'drywasherHand',
    'testPlant',
  ],
};

// ===================================================================================================== tests

describe('the equipment schemas (tests/data/schemas/equipment.ts)', () => {
  it('validate every catalog file', () => {
    expect(problems(equipmentClassesSchema, EQUIPMENT_CLASSES)).toEqual([]);
    expect(problems(equipmentModelsSchema, EQUIPMENT_MODELS)).toEqual([]);
    expect(problems(equipmentBrandsSchema, EQUIPMENT_BRANDS)).toEqual([]);
    expect(problems(equipmentPackagesSchema, EQUIPMENT_PACKAGES)).toEqual([]);
    expect(problems(inheritedFleetSpecSchema, INHERITED_FLEET_SPEC)).toEqual([]);
  });

  it('have teeth', () => {
    const wrongKey = { ...EQUIPMENT_MODELS, ex30: { ...model('ex30'), id: 'ex20' } };
    expect(problems(equipmentModelsSchema, wrongKey)).not.toEqual([]);
    const flying = {
      ...EQUIPMENT_MODELS,
      pickup: { ...model('pickup'), transport: { ...model('pickup').transport, selfPropelled: false } },
    };
    expect(problems(equipmentModelsSchema, flying).join()).toMatch(/self-propelled/);
    expect(
      problems(FLEET_TUNING_KEY_SCHEMAS['fleet.p1GradeShares'] as z.ZodType, { A: 0.2, B: 0.4, C: 0.3, D: 0.15 }),
    ).not.toEqual([]);
    expect(
      problems(FLEET_TUNING_KEY_SCHEMAS['fleet.depCurve.dozer'] as z.ZodType, { a: 0.95, lambda: 0.1, f: 0.06 }),
    ).not.toEqual([]);
    expect(
      problems(FLEET_TUNING_KEY_SCHEMAS['fleet.p1GradeRateMult'] as z.ZodType, { A: 1, B: 0.96, C: 0.97, D: 0.85 }),
    ).not.toEqual([]);
    const badBrand = { ...EQUIPMENT_BRANDS, marlow: { ...EQUIPMENT_BRANDS.marlow, usedAgeYr: { min: 16, max: 12 } } };
    expect(problems(equipmentBrandsSchema, badBrand)).not.toEqual([]);
  });

  it('every object-valued fleet.* key has a shape schema, and every schema names a key', () => {
    for (const [key, value] of Object.entries(TUNING)) {
      if (typeof value === 'object') expect(has(FLEET_TUNING_KEY_SCHEMAS, key), key).toBe(true);
    }
    for (const key of Object.keys(FLEET_TUNING_KEY_SCHEMAS)) expect(has(TUNING, key), key).toBe(true);
  });
});

describe('fleet.* values (9.15 and the decisions it cites)', () => {
  it('state DESIGN’s P1 values', () => {
    const want: Readonly<Record<string, TuningValue>> = {
      'fleet.depCurve.excavator': { a: 0.809, lambda: 0.1165, f: 0.03 },
      'fleet.depCurve.dozer': { a: 0.82, lambda: 0.1024, f: 0.06 },
      'fleet.depCurve.wheeled': { a: 0.809, lambda: 0.13, f: 0.03 },
      'fleet.depCurve.plant': { a: 0.72, lambda: 0.15, f: 0.04 },
      'fleet.depCurve.light': { a: 0.75, lambda: 0.14, f: 0.05 },
      'fleet.hoursWeight': { excavator: 0.5, dozer: 0.5, wheeled: 0.5, plant: 0.3, light: 0.3 },
      'fleet.refHoursPerYear': 1500,
      'fleet.condPriceSlope': 0.8,
      'fleet.condRefByHours': [
        [0, 1],
        [1500, 0.85],
        [3000, 0.71],
        [5000, 0.61],
        [7500, 0.5],
        [10000, 0.53],
        [15000, 0.58],
      ],
      'fleet.listingClassWeights': {
        excavator: 0.22,
        dozer: 0.18,
        artTruck: 0.12,
        loader: 0.14,
        washPlant: 0.1,
        pump: 0.08,
        generator: 0.06,
        other: 0.1,
      },
      'fleet.hoursPerYearMedian': 1150,
      'fleet.hoursPerYearSigma': 0.35,
      'fleet.lightPlantHoursMult': 0.6,
      'fleet.p1UsedListingsPerDistrict': 6,
      'fleet.p1UsedArrivalsPerWeek': 1,
      'fleet.p1UsedListingLifeWeeks': 6,
      'fleet.p1GradeShares': { A: 0.15, B: 0.4, C: 0.3, D: 0.15 },
      'fleet.p1GradeAgeYears': { A: [1, 4], B: [3, 9], C: [7, 15], D: [12, 30] },
      'fleet.p1DealerUsedAgeYears': { A: 2.5, B: 6, C: 11, D: 21 },
      'fleet.p1UsedRipperShare': 0.5,
      'fleet.ripperUsd': 35000,
      'fleet.salesTaxRate': { akStyle: 0, nvStyle: 0.071, temperateStyle: 0, yukon: 0 },
      'fleet.newDealerPrepWeeks': 1,
      'fleet.newDepositPct': 0.1,
      'fleet.depositRefundWeeks': 2,
      'fleet.newOrderHoldWeeks': 4,
      'fleet.packageDiscountPct': 0.03,
      'fleet.p1GradeRateMult': { A: 1, B: 0.96, C: 0.91, D: 0.85 },
      'fleet.p1GradeMaintMult': { A: 1, B: 1.15, C: 1.25, D: 1.6 },
      'fleet.p1GradePriceMult': { A: 1.2, B: 1.05, C: 0.9, D: 0.7 },
      'fleet.p1OpWearShare': 0.6,
      'fleet.p1InHouseMaintMult': 0.7,
      'fleet.p1OwnerShopMaintMult': 0.7,
      'fleet.p1DealerCashShare': 0.8,
      'fleet.siteUpkeepUsdPerWeek': { pickup: 150, campShareOfNew: 0.001 },
      'fleet.toolRentUsdPerDay': { rocker: 25, drywasherHand: 40, testPlant: 150 },
      'fleet.coldRateMult': { deepCold: 0.92, cold: 0.97, cool: 1, mild: 1, hot: 1 },
      'fleet.coldFuelMult': { deepCold: 1.15, cold: 1.05, cool: 1, mild: 1, hot: 1 },
      'fleet.lowboyLoadFixedUsd': 1200,
      'fleet.lowboyUsdPerLoadedMile': 5.5,
      'fleet.lowboyDeadheadMult': 1.5,
      'fleet.legUsdPerLoadMile': { seasonalRoad: 14, winterTrail: 300 },
      'fleet.permitOsUsd': 150,
      'fleet.permitSlUsd': 2500,
      'fleet.pilotUsdPerMi': 2,
      'fleet.airUsdPerLb': 1.4,
      'fleet.transportSchedulingWeeks': 1,
      'fleet.pavedMilesPerWeek': 1500,
      'fleet.seasonalMilesPerWeek': 600,
      'fleet.trailMilesPerWeek': 60,
      'fleet.springRestrictionMult': 1.35,
      'fleet.springRestrictStartWeek': 10,
      'fleet.interHubMiDefault': 300,
      'fleet.riggingUsdPerHr': 115,
      'fleet.riggingCrewHoursPerWeek': 120,
      'fleet.driveUsdPerMile': 2.5,
      'fleet.bookLifeYears': { excavator: 8, dozer: 10, wheeled: 8, plant: 8, light: 5, site: 7 },
      'fleet.bookResidual': { excavator: 0.25, dozer: 0.3, wheeled: 0.2, plant: 0.15, light: 0.15, site: 0.1 },
      'fleet.imputedCapitalRate': 0.08,
    };
    for (const [key, value] of Object.entries(want)) expect(TUNING[key], key).toEqual(value);
    // the remaining keys are this package's tables, checked by their own tests below
    const rest = Object.keys(TUNING).filter((k) => !has(want, k));
    expect(rest.sort()).toEqual(['fleet.listingSizeWeights', 'fleet.p1MaintUsdPerHr']);
  });

  it('leaves the P3 difficulty-scaled keys to P3 (§1 1.11 rows join with them)', () => {
    expect(has(TUNING, 'fleet.privateLemonShare')).toBe(false);
    expect(has(TUNING, 'fleet.failureHazardMult')).toBe(false);
  });
});

describe('classes (9.2.1)', () => {
  it('are the twelve classes, keyed by id, with 9.2.1–9.3.2–9.10 families', () => {
    expect(Object.keys(EQUIPMENT_CLASSES).sort()).toEqual([...CLASS_IDS].sort());
    expect(EQUIPMENT_CLASSES.recovery.depFamily).toBe('plant'); // 9.3.2: "plant, recovery, conveyor"
    expect(EQUIPMENT_CLASSES.site.depFamily).toBe('light'); // camps and pickups on the light curve (D-9.61)
    expect(EQUIPMENT_CLASSES.site.bookFamily).toBe('site');
    expect(EQUIPMENT_CLASSES.site.family).toBe('none');
  });

  it('operated classes are exactly 9.7.2’s S list', () => {
    const operated = CLASS_IDS.filter((c) => EQUIPMENT_CLASSES[c].operated);
    expect(operated.sort()).toEqual(['artTruck', 'dozer', 'drill', 'excavator', 'loader']);
  });

  it('name their listing group: the seven weighted classes by name, the rest under other', () => {
    const named = Object.keys(T['fleet.listingClassWeights']).filter((g) => g !== 'other');
    for (const c of CLASS_IDS) {
      expect(EQUIPMENT_CLASSES[c].listingGroup, c).toBe(named.includes(c) ? c : 'other');
    }
  });

  it('every depreciation family and book family has its tuning rows', () => {
    for (const c of CLASS_IDS) {
      const def = EQUIPMENT_CLASSES[c];
      expect(has(TUNING, `fleet.depCurve.${def.depFamily}`), c).toBe(true);
      expect(has(T['fleet.hoursWeight'], def.depFamily), c).toBe(true);
      expect(has(T['fleet.bookLifeYears'], def.bookFamily), c).toBe(true);
      expect(has(T['fleet.bookResidual'], def.bookFamily), c).toBe(true);
    }
  });
});

describe('models (9.2.2–9.2.4, 9.2.7, D-9.57)', () => {
  it('MODEL_IDS lists every row once; ids, size keys and helpers agree', () => {
    expect([...MODEL_IDS].sort()).toEqual(Object.keys(EQUIPMENT_MODELS).sort());
    expect(new Set(MODEL_IDS).size).toBe(MODEL_IDS.length);
    for (const id of MODEL_IDS) {
      expect(model(id).id).toBe(id);
      expect(model(id).sizeKey).toBe(id);
      expect(isModelId(id)).toBe(true);
    }
    expect(isModelId('ex13')).toBe(false); // a P3 slot without a row yet
    expect(isModelId('toString')).toBe(false);
  });

  it('phase 1 is the 18 machines of 9.2.7 plus §4’s three tools; the phase-3 rows are D-9.57’s', () => {
    expect([...P1_MODEL_IDS].sort()).toEqual([...P1_MACHINES, ...TOOL_MODEL_IDS].sort());
    expect(P1_MACHINES).toHaveLength(18);
    const phase3 = MODEL_IDS.filter((id) => model(id).phase === 3);
    expect([...phase3].sort()).toEqual([...PHASE3].sort());
    expect(MODEL_IDS.every((id) => model(id).phase === 1 || model(id).phase === 3)).toBe(true);
  });

  it('state 9.2’s prices, rates, fuel and horsepower', () => {
    expect(Object.keys(DESIGN_ROWS).sort()).toEqual([...MODEL_IDS].sort());
    for (const id of MODEL_IDS) {
      const want = DESIGN_ROWS[id];
      const m = model(id);
      expect(m.newBaseUsd, id).toBe(want.usd);
      expect(m.gph, id).toBe(want.gph);
      expect(m.hp, id).toBe(want.hp);
      const rate = classOf(id).rate;
      if (want.rate !== undefined) {
        expect(rate, id).not.toBeNull();
        expect(m.spec[rate?.specField ?? 'rateBcyHr'], id).toBe(want.rate);
      }
    }
    expect(model('campT8').spec).toEqual({ capacity: 8, campTier: 'basic', security: 0.2 });
    expect(model('campM25').spec).toEqual({ capacity: 25, campTier: 'good', security: 0.5 });
    expect(model('tank10k').spec.tankGal).toBe(10_000);
    expect(model('ex20').spec.reachFt).toBe(16);
    expect(model('ex30').spec.reachFt).toBe(22);
    expect(model('ex45').spec.reachFt).toBe(27);
  });

  it('carry the spec their class rates them by (plant add-ons excepted)', () => {
    for (const id of MODEL_IDS) {
      const m = model(id);
      const rate = classOf(id).rate;
      const addOn = m.spec.hasScrubber === true || m.spec.extraRatedBcyHr !== undefined;
      if (rate !== null && !addOn) expect(m.spec[rate.specField], id).toBeGreaterThan(0);
      if (m.classId === 'washPlant' && !addOn) expect(m.spec.prep, id).toBeDefined();
      if (m.classId === 'recovery') expect(m.spec.concentrator, id).toBeDefined();
      if (m.spec.campTier !== undefined) expect(m.classId, id).toBe('site');
    }
    expect(model('jigS').spec.concentrator).toBe('jig');
    expect(model('cenM').spec.concentrator).toBe('centrifuge');
    expect(model('cenL').spec.concentrator).toBe('centrifuge');
    expect(model('scrub').spec.hasScrubber).toBe(true);
    expect(model('dw20').spec.prep).toBe('dryWasher');
    expect(model('grz40').spec.prep).toBe('grizzly');
  });

  it('D7+ dozers carry a ripper; the D6’s is an option (9.2.1, D-9.60)', () => {
    expect(model('dz6').spec.hasRipper).toBe(false);
    expect(model('dz8').spec.hasRipper).toBe(true);
    expect(model('dz9').spec.hasRipper).toBe(true);
    expect(T['fleet.ripperUsd']).toBe(35_000);
  });

  it('electric plants draw power and burn no fuel; diesel trommels to 150 run their own engine (9.2.3)', () => {
    expect(model('tr300').spec.powerKw).toBe(220);
    expect(model('cenM').spec.powerKw).toBe(22);
    expect(model('cenL').spec.powerKw).toBe(45);
    expect(model('jigS').spec.powerKw).toBe(5);
    expect(model('scrub').spec.powerKw).toBe(55);
    expect(model('cnv24').spec.powerKw).toBe(15);
    for (const id of ['tr50', 'tr75', 'tr150', 'pmp6', 'pmp10'] as const) expect(model(id).spec.powerKw, id).toBe(0);
    for (const id of MODEL_IDS) if ((model(id).spec.powerKw ?? 0) > 0) expect(model(id).gph, id).toBe(0);
  });

  it('size scale follows 9.2.5’s fleet.sizeLaborScale bands', () => {
    const small = ['ex20', 'dz6', 'ld950', 'grz40', 'tr50', 'tr75', 'dw20', 'pmp6', 'pmp10', 'gen100'] as const;
    const large = ['ex45', 'dz8', 'dz9', 'adt40', 'ld980', 'tr150', 'tr300', 'gen300', 'gen500'] as const;
    for (const id of small) expect(model(id).scale, id).toBe('small');
    for (const id of large) expect(model(id).scale, id).toBe('large');
    for (const id of ['ex30', 'ld966', 'adt30'] as const) expect(model(id).scale, id).toBe('medium');
  });

  it('only pickups (road vehicles) take the 5-year light-truck tax class (9.2.1, R4 §8)', () => {
    for (const id of MODEL_IDS) expect(model(id).taxClass, id).toBe(id === 'pickup' ? 'lightTruck5' : 'mining7');
  });

  it('model years admit every used age the generators and the Inheritor need', () => {
    const startYear = gameTuning['game.startCalendarYear'];
    const oldestInherited = Math.max(...INHERITED_FLEET_SPEC.items.map((i) => i.ageYears));
    for (const id of MODEL_IDS) {
      expect(model(id).firstYear, id).toBeLessThanOrEqual(startYear - oldestInherited);
      expect(model(id).firstYear, id).toBeLessThanOrEqual(startYear - T['fleet.p1GradeAgeYears'].D[1]);
    }
  });
});

describe('brands (9.2.6, D-9.71)', () => {
  it('are the nine brands, keyed by id', () => {
    expect([...BRAND_IDS].sort()).toEqual(Object.keys(EQUIPMENT_BRANDS).sort());
    for (const b of BRAND_IDS) {
      expect(EQUIPMENT_BRANDS[b].id).toBe(b);
      expect(isBrandId(b)).toBe(true);
    }
  });

  it('state 9.2.6’s multipliers', () => {
    const row = (b: BrandId) => {
      const x = EQUIPMENT_BRANDS[b];
      return [x.newPriceMult, x.hazardMult, x.partsCostMult, x.partsLeadMult, x.retention, x.fuelMult];
    };
    expect(row('caldera')).toEqual([1.05, 0.8, 1.1, 0.7, 1.1, 1.0]);
    expect(row('hokuto')).toEqual([1.0, 0.9, 1.0, 1.0, 1.05, 0.94]);
    expect(row('nordvik')).toEqual([1.03, 0.9, 1.15, 1.25, 1.0, 0.92]);
    expect(row('ironside')).toEqual([0.86, 1.1, 0.9, 1.3, 0.85, 1.05]);
    expect(row('tianlong')).toEqual([0.66, 1.35, 0.75, 2.5, 0.65, 1.08]);
    expect(row('marlow').slice(1)).toEqual([1.15, 1.3, 4.0, 0.6, 1.12]);
    expect(row('klondike')).toEqual([1.0, 0.9, 0.85, 0.6, 1.0, 1.0]);
    expect(row('vortex')).toEqual([1.1, 0.8, 1.2, 1.5, 1.05, 0.95]);
    expect(row('generic')).toEqual([1, 1, 1, 1, 1, 1]);
    expect(EQUIPMENT_BRANDS.hokuto.pmPartsFree).toEqual({ weeks: 156, hours: 2_000 });
    expect(EQUIPMENT_BRANDS.tianlong.warranty).toEqual([{ weeks: 156, hours: 5_000, scope: 'full' }]);
    expect(EQUIPMENT_BRANDS.marlow.defunctYear).toBe(2011);
    expect(EQUIPMENT_BRANDS.marlow.warranty).toEqual([]);
  });

  it('every model has a maker, its default brand makes it, and a used listing can always draw a brand', () => {
    for (const id of MODEL_IDS) {
      const makers = BRAND_IDS.filter((b) => (EQUIPMENT_BRANDS[b].makes as readonly string[]).includes(id));
      expect(makers.length, id).toBeGreaterThan(0);
      expect(makers, `${id}: p1DefaultBrandId`).toContain(model(id).p1DefaultBrandId);
      expect(model(id).brandId, id).toBe(model(id).p1DefaultBrandId);
      // the 9.3.3 brand draw: share[class] over the makers of the model (D-9.71)
      const cls = model(id).classId;
      for (const b of makers)
        expect(EQUIPMENT_BRANDS[b].share[cls] ?? 0, `${b} share of ${cls} (${id})`).toBeGreaterThan(0);
    }
    for (const b of BRAND_IDS)
      for (const m of EQUIPMENT_BRANDS[b].makes) expect(isModelId(m), `${b} makes ${m}`).toBe(true);
  });

  it('9.2.6’s default heavy-iron shares (Nordvik 0.35 of trucks)', () => {
    const shares = (cls: 'excavator' | 'loader') => BRAND_IDS.map((b) => EQUIPMENT_BRANDS[b].share[cls] ?? 0);
    expect(sum(shares('excavator'))).toBeCloseTo(1, 12);
    expect(sum(shares('loader'))).toBeCloseTo(1, 12);
    expect(EQUIPMENT_BRANDS.nordvik.share.artTruck).toBe(0.35);
  });

  it('age limits: Marlow used ≥ 16 yr (defunct 2011 at the 2027 start), Tianlong ≤ 12 yr (9.3.3)', () => {
    const startYear = gameTuning['game.startCalendarYear'];
    expect(EQUIPMENT_BRANDS.marlow.usedAgeYr).toEqual({ min: 16 });
    expect(startYear - (EQUIPMENT_BRANDS.marlow.defunctYear ?? Number.NaN)).toBe(16);
    expect(EQUIPMENT_BRANDS.tianlong.usedAgeYr).toEqual({ max: 12 });
    expect(EQUIPMENT_BRANDS.marlow.dealerP).toBe(0);
    expect(EQUIPMENT_BRANDS.vortex.dealerP).toBe(0);
    expect(EQUIPMENT_BRANDS.klondike.dealerOnlyIn).toEqual(['subarctic']);
  });
});

describe('packages (9.2.3, D-9.44) and BALANCE T-09 (b)', () => {
  const pkg = EQUIPMENT_PACKAGES.pkg300;
  const list = (id: ModelId, b: BrandId) => model(id).newBaseUsd * EQUIPMENT_BRANDS[b].newPriceMult;

  it('pkg300 lists at $1,575,280 with the real brand multipliers (9.17 #22)', () => {
    const items = sum(pkg.items.map((i) => list(i.modelId, i.brandId)));
    expect(items).toBeCloseTo(1_624_000, 6);
    expect(items * (1 - pkg.discountPct)).toBeCloseTo(1_575_280, 6);
    expect(pkg.discountPct).toBe(T['fleet.packageDiscountPct']);
    expect(pkg.phase).toBe(3);
  });

  it('pkg300 items are phase-3 rows made by the item’s brand; assembly 300 h; power within the gen500', () => {
    for (const i of pkg.items) {
      expect(model(i.modelId).phase, i.modelId).toBe(3);
      expect(EQUIPMENT_BRANDS[i.brandId].makes as readonly string[], i.modelId).toContain(i.modelId);
    }
    const own = sum(pkg.items.map((i) => model(i.modelId).transport.assemblyCrewHours ?? 0));
    expect(own).toBe(300);
    expect(pkg.assemblyCrewHours).toBe(300);
    const kw = sum(pkg.items.map((i) => model(i.modelId).spec.powerKw ?? 0));
    expect(kw).toBe(335);
    expect(kw).toBeLessThanOrEqual(0.75 * (model('gen500').spec.generatorKw ?? 0));
  });

  it('T-09 (b): new dz9 list (default brand) and the pkg300 package are each ≥ $1.5M', () => {
    expect(list('dz9', model('dz9').p1DefaultBrandId)).toBeGreaterThanOrEqual(1_500_000);
    expect(sum(pkg.items.map((i) => list(i.modelId, i.brandId))) * (1 - pkg.discountPct)).toBeGreaterThanOrEqual(
      1_500_000,
    );
  });
});

describe('price model data (9.3.2, 9.17 #1–2)', () => {
  it('dep_f: excavator 5 → 0.4818, dozer 12 → 0.3000, wheeled 20 → 0.0901, plant 8 → 0.2569', () => {
    expect(depF('excavator', 5)).toBeCloseTo(0.4818, 4);
    expect(depF('dozer', 12)).toBeCloseTo(0.3, 4);
    expect(depF('wheeled', 20)).toBeCloseTo(0.0901, 4);
    expect(depF('plant', 8)).toBeCloseTo(0.2569, 4);
  });

  it('dep(0) ≤ 1 for every family: a delivery-new unit is never worth more than list', () => {
    for (const f of ['excavator', 'dozer', 'wheeled', 'plant', 'light'] as const)
      expect(depF(f, 0), f).toBeLessThanOrEqual(1);
  });

  it('condRef: 0 h → 1.00; 9,800 → 0.5276; 14,800 → 0.578; 40,000 → 0.58', () => {
    expect(condRef(0)).toBe(1);
    expect(condRef(9_800)).toBeCloseTo(0.5276, 4);
    expect(condRef(14_800)).toBeCloseTo(0.578, 4);
    expect(condRef(40_000)).toBeCloseTo(0.58, 10);
  });

  it('9.3.2’s private-listing example from the data: base $186.0k, FMV(claimed) $218.0k, FMV(true) $202.7k', () => {
    const caldera = EQUIPMENT_BRANDS.caldera;
    const ae = ageEqOf('ex30', 8, 9_800);
    expect(ae).toBeCloseTo(7.267, 3);
    const dep = depF('excavator', ae) ** (1 / caldera.retention);
    const base = model('ex30').newBaseUsd * caldera.newPriceMult * dep;
    expect(base / 1000).toBeCloseTo(186.0, 1);
    const condMult = (signal: number) => 1 + T['fleet.condPriceSlope'] * (signal - condRef(9_800));
    const ripple = 1.1 ** 0.35; // P5's general-earthmoving ripple at goldIdxReal 1.10, as the example states
    // rebuild parts shares v_c of the excavator family (9.2.5): engine, hydraulics, UC, drivetrain, electrical, structure
    const v = [0.09, 0.085, 0.065, 0.065, 0.015, 0.04];
    const signal = (h: readonly number[]) => sum(h.map((x, i) => x * (v[i] as number))) / sum(v);
    const claimed = signal([0.7, 0.7, 0.5, 0.7, 0.9, 0.9]);
    expect(claimed).toBeCloseTo(0.694, 3);
    expect(Math.abs(base * condMult(claimed) * ripple - 218_000)).toBeLessThan(100);
    const truth = signal([0.52, 0.61, 0.38, 0.66, 0.85, 0.88]);
    expect(truth).toBeCloseTo(0.595, 3);
    expect(Math.abs(base * condMult(truth) * ripple - 202_700)).toBeLessThan(100);
  });

  it('9.7.7’s auction lot from the data: Ironside 2015 30t, 14,800 h → visible FMV $74.6k', () => {
    const ironside = EQUIPMENT_BRANDS.ironside;
    const dep = depF('excavator', ageEqOf('ex30', 12, 14_800)) ** (1 / ironside.retention);
    expect((model('ex30').newBaseUsd * ironside.newPriceMult * dep) / 1000).toBeCloseTo(74.6, 1);
  });
});

describe('P1 used market data (9.3.3, D-9.58–D-9.63) and BALANCE T-09 (c)', () => {
  it('grade shares, age ranges and the dealer offers’ grade midpoints', () => {
    const shares = T['fleet.p1GradeShares'];
    expect(sum([shares.A, shares.B, shares.C, shares.D])).toBeCloseTo(1, 12);
    for (const g of ['A', 'B', 'C', 'D'] as const) {
      const [lo, hi] = T['fleet.p1GradeAgeYears'][g];
      expect(T['fleet.p1DealerUsedAgeYears'][g], g).toBe((lo + hi) / 2);
    }
    expect(T['fleet.p1GradePriceMult']).toEqual({ A: 1.2, B: 1.05, C: 0.9, D: 0.7 });
  });

  it('T-09 (c): ex30, ld966 and adt30 dealer offers at grades B and C each ask $100–500k (BALANCE §8 figures)', () => {
    const want: Record<string, readonly [number, number]> = {
      ex30: [211_000, 113_000],
      ld966: [229_000, 116_000],
      adt30: [256_000, 130_000],
    };
    for (const id of ['ex30', 'ld966', 'adt30'] as const) {
      const asks = (['B', 'C'] as const).map((g) => {
        const age = T['fleet.p1DealerUsedAgeYears'][g];
        return p1UsedAskUsd(id, age, offerHours(id, age), g);
      });
      for (const a of asks) {
        expect(a, id).toBeGreaterThanOrEqual(100_000);
        expect(a, id).toBeLessThanOrEqual(500_000);
      }
      expect(Math.abs((asks[0] as number) - (want[id] as readonly number[])[0]!), `${id} B`).toBeLessThan(1_000);
      expect(Math.abs((asks[1] as number) - (want[id] as readonly number[])[1]!), `${id} C`).toBeLessThan(1_000);
    }
  });

  it('no dealer offer asks more than the model’s new list (D-9.59), at any grade', () => {
    for (const id of P1_MODEL_IDS) {
      for (const g of ['A', 'B', 'C', 'D'] as const) {
        const age = T['fleet.p1DealerUsedAgeYears'][g];
        const ask = p1UsedAskUsd(id, age, offerHours(id, age), g);
        expect(ask, `${id} ${g}`).toBeLessThan(model(id).newBaseUsd);
        // the dz6 with ripper: (newBase + ripper) × the same factors (D-9.60), against its list with the option
        if (id === 'dz6') {
          const withRipper = p1UsedAskUsd(id, age, offerHours(id, age), g, T['fleet.ripperUsd']);
          expect(withRipper, `dz6+ripper ${g}`).toBeLessThan(model(id).newBaseUsd + T['fleet.ripperUsd']);
        }
      }
    }
  });

  it('listing weights: class mix and size mixes sum to 1; ex13 is 0.10; every listable P1 model can list', () => {
    const cw = T['fleet.listingClassWeights'];
    expect(Object.keys(cw).sort()).toEqual([...LISTING_GROUPS].sort());
    expect(sum(Object.values(cw))).toBeCloseTo(1, 12);
    const sw: Readonly<Record<string, Readonly<Record<string, number>>>> = T['fleet.listingSizeWeights'];
    expect(Object.keys(sw).sort()).toEqual([...LISTING_GROUPS].sort());
    for (const g of LISTING_GROUPS) {
      expect(sum(Object.values(sw[g] ?? {})), g).toBeCloseTo(1, 12);
      for (const slot of Object.keys(sw[g] ?? {})) {
        expect(DESIGN_SLOTS[g], `${g}.${slot} is not a 9.2 size slot of the group`).toContain(slot);
        if (isModelId(slot)) expect(classOf(slot).listingGroup, slot).toBe(g);
      }
    }
    expect(sw['excavator']?.['ex13']).toBe(0.1);
    for (const id of MODEL_IDS) {
      const weight = sw[classOf(id).listingGroup]?.[id] ?? 0;
      if ((TOOL_MODEL_IDS as readonly string[]).includes(id))
        expect(weight, `${id}: tools are rented, not listed`).toBe(0);
      else expect(weight, id).toBeGreaterThan(0);
    }
  });

  it('P1 renormalizes each group over its P1 models (D-9.63): every group with a P1 model keeps positive mass', () => {
    const sw: Readonly<Record<string, Readonly<Record<string, number>>>> = T['fleet.listingSizeWeights'];
    for (const g of LISTING_GROUPS) {
      const p1 = P1_MODEL_IDS.filter((id) => classOf(id).listingGroup === g);
      const mass = sum(p1.map((id) => sw[g]?.[id] ?? 0));
      if (p1.length > 0) expect(mass, g).toBeGreaterThan(0);
    }
  });
});

describe('P1 maintenance (9.14, 9.15, D-9.25, D-9.57)', () => {
  const maint: Readonly<Record<string, number>> = T['fleet.p1MaintUsdPerHr'];

  it('DESIGN’s P1 rows exactly', () => {
    expect({
      ...maint,
      ex45: 0,
      dz9: 0,
      adt40: 0,
      ld980: 0,
      tr300: 0,
      scrub: 0,
      cnv24: 0,
      cenL: 0,
      pmp10: 0,
      gen300: 0,
      gen500: 0,
    }).toEqual({
      ex20: 24,
      ex30: 33,
      dz6: 40,
      dz8: 78,
      ld950: 25,
      ld966: 33,
      adt30: 38,
      grz40: 5,
      tr50: 11,
      tr75: 15,
      tr150: 28,
      dw20: 6,
      jigS: 3,
      cenM: 6,
      pmp6: 4,
      gen100: 3,
      ex45: 0,
      dz9: 0,
      adt40: 0,
      ld980: 0,
      tr300: 0,
      scrub: 0,
      cnv24: 0,
      cenL: 0,
      pmp10: 0,
      gen300: 0,
      gen500: 0,
    });
  });

  it('cover every non-site row P1 can run (phase 1 and the phase-3 fixture rows), and no site item', () => {
    for (const id of MODEL_IDS) {
      if (model(id).classId === 'site')
        expect(has(maint, id), `${id}: site items have upkeep, not maintenance`).toBe(false);
      else expect(maint[id], id).toBeGreaterThan(0);
    }
    for (const id of Object.keys(maint)) expect(isModelId(id), id).toBe(true);
  });

  it('the phase-3 rows follow D-9.25’s method (R4 §7 mid R&M + UC/tires + PM, or the P1 rows’ scaling)', () => {
    const mid = (lo: number, hi: number) => (lo + hi) / 2;
    const r4 = (rm: [number, number], uc: [number, number], pm: [number, number]) =>
      Math.round(mid(...rm) + mid(...uc) + mid(...pm));
    // the P1 anchors reproduce from R4 first
    expect(r4([18, 28], [4, 8], [3, 5])).toBe(maint['ex30']);
    expect(r4([30, 45], [25, 40], [6, 10])).toBe(maint['dz8']);
    expect(r4([18, 28], [8, 14], [3, 5])).toBe(maint['adt30']);
    expect(r4([16, 26], [6, 10], [3, 5])).toBe(maint['ld966']);
    expect(maint['ex45']).toBe(r4([28, 42], [6, 12], [4, 7]));
    expect(maint['dz9']).toBe(r4([45, 65], [35, 55], [8, 12]));
    expect(maint['adt40']).toBe(r4([22, 34], [12, 20], [4, 6]));
    expect(maint['ld980']).toBe(Math.round((maint['ld966'] as number) * (720 / 500)));
    expect(maint['ld950']).toBe(Math.round((maint['ld966'] as number) * (380 / 500)));
    const b = Math.log((maint['tr150'] as number) / (maint['tr50'] as number)) / Math.log(380 / 120);
    const trommel = (usd: number) => Math.round((maint['tr50'] as number) * (usd / 120_000) ** b);
    expect(trommel(180_000)).toBe(maint['tr75']); // the scale returns DESIGN's tr75
    expect(maint['tr300']).toBe(trommel(950_000));
    expect(maint['scrub']).toBe(trommel(140_000));
    expect(maint['cnv24']).toBe(trommel(60_000));
    expect(maint['cenL']).toBe(Math.round((maint['cenM'] as number) * (240 / 110)));
    expect(maint['pmp10']).toBe(Math.round((maint['pmp6'] as number) * (95 / 38)));
    expect(maint['gen300']).toBe(Math.round((maint['gen100'] as number) * (120 / 50)));
    expect(maint['gen500']).toBe(Math.round((maint['gen100'] as number) * (200 / 50)));
  });

  it('9.17 #19: skill-20 operator on a grade-A 30t $48.84/SMR h; grade C, skill 50 $41.25; × 0.70 in-house', () => {
    const skillWearMult20 = 1.8; // §8 skillWearMult(20), 9.7.4
    const opMult = 1 + T['fleet.p1OpWearShare'] * (skillWearMult20 - 1);
    const rate = maint['ex30'] as number;
    expect(rate * T['fleet.p1GradeMaintMult'].A * opMult).toBeCloseTo(48.84, 10);
    expect(rate * T['fleet.p1GradeMaintMult'].A * opMult * T['fleet.p1InHouseMaintMult']).toBeCloseTo(34.188, 10);
    expect(rate * T['fleet.p1GradeMaintMult'].C).toBeCloseTo(41.25, 10);
  });

  it('the inherited-fleet keys alias grade D and follow it (9.15, D-9.49)', () => {
    const resolveAlias = (tuning: Readonly<Record<string, TuningValue>>, alias: keyof typeof fleetTuningAliases) => {
      const { key, field } = fleetTuningAliases[alias];
      return (tuning[key] as Readonly<Record<string, number>>)[field];
    };
    expect(resolveAlias(TUNING, 'fleet.p1InheritedMaintMult')).toBe(1.6);
    expect(resolveAlias(TUNING, 'fleet.p1InheritedRateMult')).toBe(0.85);
    const changed = { ...TUNING, 'fleet.p1GradeMaintMult': { ...T['fleet.p1GradeMaintMult'], D: 1.5 } };
    expect(resolveAlias(changed, 'fleet.p1InheritedMaintMult')).toBe(1.5);
    for (const alias of Object.keys(fleetTuningAliases))
      expect(has(TUNING, alias), `${alias} holds no value`).toBe(false);
  });

  it('site upkeep (D-9.68): a pickup $150/wk; a campT8 0.1% of $40k = $40/wk', () => {
    expect(T['fleet.siteUpkeepUsdPerWeek'].pickup).toBe(150);
    expect(T['fleet.siteUpkeepUsdPerWeek'].campShareOfNew * model('campT8').newBaseUsd).toBeCloseTo(40, 10);
  });
});

describe('transport data and 9.5’s worked examples (D-9.75, 9.17 #11)', () => {
  it('pins the loads, permits and rigging hours D-9.75 names', () => {
    expect(model('pmp6').transport.loads).toBe(0.3);
    expect(model('gen100').transport.loads).toBe(0.4);
    for (const [id, loads] of [
      ['dz8', 2],
      ['tr75', 2],
      ['tr150', 3],
    ] as const) {
      expect(model(id).transport.loads, id).toBe(loads);
      expect(model(id).transport.oversize, id).toBe(true);
    }
    for (const id of ['tr50', 'grz40', 'dw20', 'jigS', 'cenM'] as const)
      expect(model(id).transport.assemblyCrewHours, id).toBe(0);
    expect(model('tr75').transport.assemblyCrewHours).toBe(60);
    expect(model('tr150').transport.assemblyCrewHours).toBe(90);
    expect(model('tr300').transport.assemblyCrewHours).toBe(240);
  });

  it('heavy-pool items move in whole loads; light-pool items in fractions; only road vehicles drive', () => {
    for (const id of MODEL_IDS) {
      const t = model(id).transport;
      if (t.selfPropelled) {
        expect(id).toBe('pickup');
        continue;
      }
      if (classOf(id).loadPool === 'heavy') expect(Number.isInteger(t.loads) && t.loads >= 1, id).toBe(true);
      else expect(t.loads, id).toBeGreaterThan(0);
    }
  });

  it('airlift: 9.2.3–9.2.4’s "air" items fly; each fits one Hercules lift (R4 §10: ~45k lb)', () => {
    const air = MODEL_IDS.filter((id) => model(id).transport.airliftable);
    expect([...air].sort()).toEqual(
      [
        'campT8',
        'cenM',
        'drywasherHand',
        'dw20',
        'gen100',
        'jigS',
        'pmp10',
        'pmp6',
        'rocker',
        'testPlant',
        'tr50',
      ].sort(),
    );
    for (const id of air) expect(model(id).weightLb, id).toBeLessThanOrEqual(45_000);
    // 9.2.2's klb column for the earthmoving rows
    const klb: Partial<Record<ModelId, number>> = {
      ex20: 50,
      ex30: 75,
      ex45: 108,
      dz6: 50,
      dz8: 85,
      dz9: 108,
      adt30: 52,
      adt40: 68,
      ld950: 42,
      ld966: 52,
      ld980: 68,
    };
    for (const [id, k] of Object.entries(klb)) expect(model(id as ModelId).weightLb, id).toBe((k as number) * 1000);
  });

  const refFleet: readonly ModelId[] = [
    'ex30',
    'dz8',
    'ld966',
    'adt30',
    'tr75',
    'pmp6',
    'gen100',
    'campT8',
    'tank10k',
    'cenM',
  ];

  it('reference fleet: 7 heavy + ceil(2.7) light = 10 loads, 3 OS permits', () => {
    const l = loadsOf(refFleet);
    expect(l.heavy).toBe(7);
    expect(l.light).toBeCloseTo(2.7, 12);
    expect(l.total).toBe(10);
    expect(l.os).toBe(3);
  });

  it('to a winter-trail claim (200 paved, 45 seasonal, 14 trail; mobMultClass 2.2) → $98,550', () => {
    const legs: Leg[] = [
      { kind: 'paved', miles: 200 },
      { kind: 'seasonalRoad', miles: 45 },
      { kind: 'winterTrail', miles: 14 },
    ];
    expect(transportUsd(refFleet, 2.2, legs)).toBeCloseTo(98_550, 6);
    const weeks =
      T['fleet.transportSchedulingWeeks'] +
      200 / T['fleet.pavedMilesPerWeek'] +
      45 / T['fleet.seasonalMilesPerWeek'] +
      14 / T['fleet.trailMilesPerWeek'];
    expect(weeks).toBeCloseTo(1.44, 2);
    expect((model('tr75').transport.assemblyCrewHours ?? 0) / T['fleet.riggingCrewHoursPerWeek']).toBe(0.5);
  });

  it('the same fleet 350 mi by highway (mobMultClass 1.0) → $48,225', () => {
    expect(transportUsd(refFleet, 1.0, [{ kind: 'paved', miles: 350 }])).toBeCloseTo(48_225, 6);
  });

  it('9.7.7’s auction 30t to a seasonal-road claim 59 mi past town (mobMultClass 1.4) → $4,306', () => {
    const legs: Leg[] = [
      { kind: 'paved', miles: 200 },
      { kind: 'seasonalRoad', miles: 59 },
    ];
    expect(transportUsd(['ex30'], 1.4, legs)).toBeCloseTo(4_306, 6);
  });

  it('sales tax on a $100k cash purchase: nvStyle $7,100; the others $0 (9.17 #23)', () => {
    const tax = T['fleet.salesTaxRate'];
    expect(100_000 * tax.nvStyle).toBeCloseTo(7_100, 8);
    expect([tax.akStyle, tax.temperateStyle, tax.yukon]).toEqual([0, 0, 0]);
  });
});

describe('ownership data (9.10)', () => {
  it('book depreciation: a $430k excavator → $775.24/week to a $107.5k residual (9.17 #15)', () => {
    const life = T['fleet.bookLifeYears'].excavator;
    const residual = T['fleet.bookResidual'].excavator;
    expect(430_000 * residual).toBe(107_500);
    expect((430_000 - 430_000 * residual) / (life * 52)).toBeCloseTo(775.24, 2);
  });
});

describe('the Inheritor’s fleet (§1 1.8.2, D-9.61)', () => {
  const items = INHERITED_FLEET_SPEC.items;
  const value = (i: (typeof items)[number]) =>
    p1UsedAskUsd(i.modelId, i.ageYears, i.hours, 'D', i.options.includes('ripper') ? T['fleet.ripperUsd'] : 0);

  it('holds the eight items of 1.8.2 with 1.8.2’s ages and stated meters; the D6 carries the ripper', () => {
    expect(items.map((i) => [i.modelId, i.ageYears])).toEqual([
      ['ex30', 24],
      ['dz6', 30],
      ['ld950', 22],
      ['tr50', 18],
      ['pmp6', 12],
      ['gen100', 15],
      ['pickup', 14],
      ['campT8', 15],
    ]);
    const hours = Object.fromEntries(items.map((i) => [i.modelId, i.hours]));
    expect([hours['ex30'], hours['dz6'], hours['ld950'], hours['gen100']]).toEqual([21_500, 26_000, 18_000, 30_000]);
    expect(items.find((i) => i.modelId === 'dz6')?.options).toEqual(['ripper']);
    for (const i of items) if (i.modelId !== 'dz6') expect(i.options, i.modelId).toEqual([]);
    for (const i of items) expect(model(i.modelId).phase, i.modelId).toBe(1);
  });

  it('values at grade D land on §1’s figures item by item (±$1k) and ≈ $152k in all', () => {
    const want: Record<string, number> = {
      ex30: 35,
      dz6: 51,
      ld950: 32,
      tr50: 10,
      pmp6: 6,
      gen100: 4,
      pickup: 9,
      campT8: 5,
    };
    for (const i of items) expect(Math.abs(value(i) / 1000 - (want[i.modelId] as number)), i.modelId).toBeLessThan(1);
    const ripper = T['fleet.ripperUsd'] * depF('dozer', ageEqOf('dz6', 30, 26_000)) * T['fleet.p1GradePriceMult'].D;
    expect(ripper / 1000).toBeCloseTo(3.25, 2); // "≈ $3k" (§1, D-9.60)
    const total = sum(items.map(value));
    expect(total).toBeGreaterThan(151_000);
    expect(total).toBeLessThan(154_000);
    expect(total).toBeCloseTo(152_604, 0);
  });
});

describe('hooks (§12 12.3; contract §7)', () => {
  it('every fleet.* hook is §9’s, and one with a tuning base consumed in P1 reads an existing fleet key', () => {
    for (const h of hookRegistry) {
      if (!h.key.startsWith('fleet.')) continue;
      expect(h.ownerSection, h.key).toBe(9);
      if (h.base === 'tuning' && h.consumerPhase <= 1) expect(has(TUNING, h.baseKey ?? h.key), h.key).toBe(true);
    }
  });

  it('a fleet tuning key that is also a hook key is that hook’s own tuning base (none in P1)', () => {
    const hooks = new Set(hookRegistry.map((h) => h.key));
    for (const key of Object.keys(TUNING).filter((k) => hooks.has(k))) {
      expect(hookRegistry.find((h) => h.key === key)?.base, key).toBe('tuning');
    }
  });
});
