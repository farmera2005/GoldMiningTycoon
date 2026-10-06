// zod schemas for the §9 equipment data (DESIGN §9 9.2, 9.15; CLAUDE.md "Content and tuning"): the catalog files in
// src/data/equipment and the object-valued `fleet.*` tuning keys. The equipment tests that run them, with the
// cross-reference checks, are in src/data/equipment/catalog.test.ts.
//
// Self-contained on purpose (zod only): tests/data/schemas.ts spreads FLEET_TUNING_KEY_SCHEMAS into its key table and
// tests/data/validation.test.ts spreads EQUIPMENT_COVERAGE into its coverage guard, so importing anything back from
// them here would make an import cycle.
import { z } from 'zod';

const MIX_TOLERANCE = 1e-9;
const num = z.number();
const nonNeg = z.number().nonnegative();
const pos = z.number().positive();
const prob = z.number().min(0).max(1);
const int = z.number().int();
const nonNegInt = z.number().int().nonnegative();
const posInt = z.number().int().positive();

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);
const sumsToOne = (o: object): boolean => Math.abs(sum(Object.values(o) as number[]) - 1) <= MIX_TOLERANCE;

function keyed<K extends string>(keys: readonly K[], inner: z.ZodType) {
  const shape = {} as Record<K, z.ZodType>;
  for (const k of keys) shape[k] = inner;
  return z.strictObject(shape);
}

function range(inner: z.ZodNumber = num) {
  return z.tuple([inner, inner]).refine(([lo, hi]) => lo <= hi, { message: 'range lo > hi' });
}

/** Values that never rise (or never fall, with `dir` 1) in the listed key order. */
function monotone(keys: readonly string[], dir: 1 | -1) {
  return (o: Readonly<Record<string, unknown>>): boolean => {
    for (let i = 1; i < keys.length; i++) {
      const a = o[keys[i - 1] as string];
      const b = o[keys[i] as string];
      if (typeof a !== 'number' || typeof b !== 'number' || dir * (b - a) < 0) return false;
    }
    return true;
  };
}

// ---------------------------------------------------------------------------------------------- enumerations

export const EQUIPMENT_CLASS_IDS = [
  'excavator',
  'dozer',
  'artTruck',
  'loader',
  'washPlant',
  'recovery',
  'pump',
  'generator',
  'drill',
  'conveyor',
  'roadTruck',
  'site',
] as const;
export const COMPONENT_FAMILIES = ['excavator', 'dozer', 'wheeled', 'plant', 'recovery', 'light', 'none'] as const;
export const DEP_FAMILIES = ['excavator', 'dozer', 'wheeled', 'plant', 'light'] as const;
export const BOOK_FAMILIES = ['excavator', 'dozer', 'wheeled', 'plant', 'light', 'site'] as const;
export const LISTING_GROUPS = [
  'excavator',
  'dozer',
  'artTruck',
  'loader',
  'washPlant',
  'pump',
  'generator',
  'other',
] as const;
export const GRADES = ['A', 'B', 'C', 'D'] as const;
export const TEMP_BANDS = ['deepCold', 'cold', 'cool', 'mild', 'hot'] as const;
export const JURISDICTIONS = ['akStyle', 'nvStyle', 'temperateStyle', 'yukon'] as const;
export const MACHINE_ROLES = ['strip', 'dig', 'haul', 'feed', 'plant', 'water', 'power', 'support', 'reclaim'] as const;
export const RATE_SPEC_FIELDS = [
  'rateBcyHr',
  'payloadBcy',
  'ratedBcyHr',
  'fineTreatCapBcyHr',
  'pumpGpm',
  'generatorKw',
  'drillFtHr',
  'stackerCapBcyHr',
] as const;
export const MACHINE_OPTIONS = ['ripper', 'fireSuppression', 'extWarranty', 'scrubber'] as const;
const PHASES = z.union([z.literal(1), z.literal(3), z.literal(5), z.literal(6)]);
const catalogId = z.string().regex(/^[a-z][A-Za-z0-9]*$/);

// ---------------------------------------------------------------------------------------------- classes (9.2.1)

export const equipmentClassSchema = z.strictObject({
  id: z.enum(EQUIPMENT_CLASS_IDS),
  name: z.string().min(1),
  family: z.enum(COMPONENT_FAMILIES),
  depFamily: z.enum(DEP_FAMILIES),
  bookFamily: z.enum(BOOK_FAMILIES),
  rate: z
    .strictObject({
      specField: z.enum(RATE_SPEC_FIELDS),
      unit: z.enum(['bcyHr', 'bcyPerLoad', 'gpm', 'kW', 'ftHr']),
    })
    .nullable(),
  operated: z.boolean(),
  roles: z.array(z.enum(MACHINE_ROLES)),
  loadPool: z.enum(['heavy', 'light']),
  listingGroup: z.enum(LISTING_GROUPS),
});

export const equipmentClassesSchema = keyed(EQUIPMENT_CLASS_IDS, equipmentClassSchema).refine(
  (t) => Object.entries(t).every(([k, v]) => (v as { id: string }).id === k),
  { message: 'a class row is not keyed by its own id' },
);

// ---------------------------------------------------------------------------------------------- models (9.2.2–9.2.4)

const specSchema = z.strictObject({
  rateBcyHr: pos.optional(),
  payloadBcy: pos.optional(),
  ratedBcyHr: pos.optional(),
  prep: z.enum(['trommel', 'shakerDeck', 'grizzly', 'dryWasher']).optional(),
  fineTreatCapBcyHr: pos.optional(),
  pumpGpm: pos.optional(),
  generatorKw: pos.optional(),
  powerKw: nonNeg.optional(),
  drillFtHr: pos.optional(),
  frozenOk: z.boolean().optional(),
  bouldersOk: z.boolean().optional(),
  hasRipper: z.boolean().optional(),
  stackerCapBcyHr: pos.optional(),
  tankGal: pos.optional(),
  capacity: posInt.optional(),
  campTier: z.enum(['basic', 'standard', 'good', 'premium']).optional(),
  security: prob.optional(),
  extraRatedBcyHr: pos.optional(),
  reachFt: pos.optional(),
  hasSafe: z.boolean().optional(),
  hasScrubber: z.boolean().optional(),
  concentrator: z.enum(['jig', 'centrifuge']).optional(),
});

export const equipmentModelSchema = z
  .strictObject({
    id: catalogId,
    classId: z.enum(EQUIPMENT_CLASS_IDS),
    sizeKey: catalogId,
    brandId: catalogId,
    name: z.string().min(1),
    newBaseUsd: pos,
    scale: z.enum(['small', 'medium', 'large']),
    spec: specSchema,
    hp: pos.optional(),
    gph: nonNeg,
    weightLb: pos,
    transport: z
      .strictObject({
        loads: nonNeg,
        oversize: z.boolean(),
        superload: z.boolean(),
        airliftable: z.boolean(),
        assemblyCrewHours: nonNeg.optional(),
        selfPropelled: z.boolean(),
      })
      .refine((t) => t.selfPropelled === (t.loads === 0), { message: 'only a self-propelled item has no loads' }),
    taxClass: z.enum(['mining7', 'lightTruck5']),
    firstYear: int.min(1900).max(2100),
    lastYear: int.min(1900).max(2100).optional(),
    tier4FromYear: int.min(1900).max(2100).optional(),
    phase: PHASES,
    p1DefaultBrandId: catalogId,
  })
  .refine((m) => m.sizeKey === m.id, { message: 'one model per size slot: sizeKey must equal id' })
  .refine((m) => m.lastYear === undefined || m.lastYear >= m.firstYear, { message: 'lastYear < firstYear' })
  .refine((m) => m.brandId === m.p1DefaultBrandId, { message: 'brandId must be the p1DefaultBrandId' });

export const equipmentModelsSchema = z
  .record(z.string(), equipmentModelSchema)
  .refine((t) => Object.entries(t).every(([k, v]) => v.id === k), { message: 'a model is not keyed by its own id' });

// ---------------------------------------------------------------------------------------------- brands (9.2.6)

export const equipmentBrandSchema = z.strictObject({
  id: catalogId,
  name: z.string().min(1),
  newPriceMult: pos,
  hazardMult: pos,
  partsCostMult: pos,
  partsLeadMult: pos,
  retention: pos,
  fuelMult: pos,
  captive: z.boolean(),
  dealerP: prob,
  dealerOnlyIn: z
    .array(z.enum(['subarctic', 'arid', 'temperateMontane']))
    .min(1)
    .optional(),
  share: z.partialRecord(z.enum(EQUIPMENT_CLASS_IDS), z.number().gt(0).max(1)),
  warranty: z.array(
    z.strictObject({ weeks: posInt, hours: posInt.optional(), scope: z.enum(['full', 'powertrain', 'structure']) }),
  ),
  pmPartsFree: z.strictObject({ weeks: posInt, hours: posInt }).optional(),
  defunctYear: int.min(1900).max(2100).optional(),
  makes: z
    .array(catalogId)
    .min(1)
    .refine((xs) => new Set(xs).size === xs.length, { message: 'makes repeats a model' }),
  usedAgeYr: z
    .strictObject({ min: nonNeg.optional(), max: pos.optional() })
    .refine((r) => (r.min ?? 0) <= (r.max ?? Infinity), { message: 'usedAgeYr min > max' })
    .optional(),
});

export const equipmentBrandsSchema = z
  .record(z.string(), equipmentBrandSchema)
  .refine((t) => Object.entries(t).every(([k, v]) => v.id === k), { message: 'a brand is not keyed by its own id' });

// ---------------------------------------------------------------------------------------------- packages (9.2.3)

export const equipmentPackageSchema = z.strictObject({
  id: catalogId,
  name: z.string().min(1),
  items: z.array(z.strictObject({ modelId: catalogId, brandId: catalogId })).min(2),
  discountPct: prob,
  assemblyCrewHours: nonNeg,
  phase: PHASES,
});

export const equipmentPackagesSchema = z
  .record(z.string(), equipmentPackageSchema)
  .refine((t) => Object.entries(t).every(([k, v]) => v.id === k), { message: 'a package is not keyed by its own id' });

// ------------------------------------------------------------------------------------- Inheritor fleet (D-9.61)

export const inheritedFleetSpecSchema = z.strictObject({
  items: z
    .array(
      z.strictObject({
        modelId: catalogId,
        ageYears: pos,
        hours: nonNeg,
        options: z.array(z.enum(MACHINE_OPTIONS)),
      }),
    )
    .min(1),
});

// --------------------------------------------------------------------------------------- fleet.* tuning (9.15)

const gradeTable = (inner: z.ZodType) => keyed(GRADES, inner);
const depCurve = z
  .strictObject({ a: pos, lambda: pos, f: prob })
  .refine((c) => c.a + c.f <= 1, { message: 'dep(0) = a + f must not exceed 1 (resale above list)' });

/**
 * Shapes and DESIGN-stated ranges of the `fleet.*` keys: every object- or array-valued key, plus scalars whose name
 * the generic scalar rule does not classify. Spread into tests/data/schemas.ts TUNING_KEY_SCHEMAS.
 */
export const FLEET_TUNING_KEY_SCHEMAS: Readonly<Record<string, z.ZodType>> = {
  // ---- price model (9.3.2)
  'fleet.depCurve.excavator': depCurve,
  'fleet.depCurve.dozer': depCurve,
  'fleet.depCurve.wheeled': depCurve,
  'fleet.depCurve.plant': depCurve,
  'fleet.depCurve.light': depCurve,
  'fleet.hoursWeight': keyed(DEP_FAMILIES, prob),
  'fleet.refHoursPerYear': pos,
  'fleet.condPriceSlope': nonNeg,
  'fleet.condRefByHours': z
    .array(z.tuple([nonNeg, prob]))
    .min(2)
    .refine((ks) => ks[0]?.[0] === 0 && ks[0]?.[1] === 1, { message: 'condRef(0 h) must be 1 (a new unit)' })
    .refine((ks) => ks.every((k, i) => i === 0 || (ks[i - 1] as [number, number])[0] < k[0]), {
      message: 'knot hours must increase',
    }),
  // ---- listing generation (9.3.3)
  'fleet.listingClassWeights': keyed(LISTING_GROUPS, prob).refine(sumsToOne, { message: 'mix must sum to 1' }),
  'fleet.listingSizeWeights': keyed(
    LISTING_GROUPS,
    z
      .record(catalogId, z.number().gt(0).max(1))
      .refine((o) => Object.keys(o).length > 0, { message: 'a group needs a size slot' })
      .refine(sumsToOne, { message: 'size weights must sum to 1' }),
  ),
  'fleet.hoursPerYearMedian': pos,
  'fleet.p1UsedListingsPerDistrict': nonNegInt,
  'fleet.p1UsedArrivalsPerWeek': nonNeg,
  'fleet.p1UsedListingLifeWeeks': posInt,
  'fleet.p1GradeShares': gradeTable(prob).refine(sumsToOne, { message: 'grade shares must sum to 1' }),
  'fleet.p1GradeAgeYears': gradeTable(range(pos)),
  'fleet.p1DealerUsedAgeYears': gradeTable(pos).refine(monotone(GRADES, 1), { message: 'ages must rise A → D' }),
  // ---- acquisition (9.4)
  'fleet.salesTaxRate': keyed(JURISDICTIONS, prob),
  'fleet.newDepositPct': prob,
  'fleet.packageDiscountPct': prob,
  // ---- P1 grades and flat maintenance (9.14)
  'fleet.p1GradeRateMult': gradeTable(pos).refine(monotone(GRADES, -1), { message: 'rate must not rise A → D' }),
  'fleet.p1GradeMaintMult': gradeTable(pos).refine(monotone(GRADES, 1), { message: 'maintenance must not fall A → D' }),
  'fleet.p1GradePriceMult': gradeTable(pos).refine(monotone(GRADES, -1), { message: 'price must not rise A → D' }),
  'fleet.p1MaintUsdPerHr': z.record(catalogId, nonNeg),
  'fleet.siteUpkeepUsdPerWeek': z.strictObject({ pickup: nonNeg, campShareOfNew: prob }),
  'fleet.toolRentUsdPerDay': keyed(['rocker', 'drywasherHand', 'testPlant'], nonNeg),
  // ---- per-machine functions (9.7)
  'fleet.coldRateMult': keyed(TEMP_BANDS, pos),
  'fleet.coldFuelMult': keyed(TEMP_BANDS, pos),
  // ---- transport (9.5)
  'fleet.legUsdPerLoadMile': keyed(['seasonalRoad', 'winterTrail'], nonNeg),
  'fleet.pavedMilesPerWeek': pos,
  'fleet.seasonalMilesPerWeek': pos,
  'fleet.trailMilesPerWeek': pos,
  'fleet.springRestrictStartWeek': int.min(1).max(52),
  'fleet.interHubMiDefault': pos,
  'fleet.riggingCrewHoursPerWeek': pos,
  // ---- ownership (9.10)
  'fleet.bookLifeYears': keyed(BOOK_FAMILIES, pos),
  'fleet.bookResidual': keyed(BOOK_FAMILIES, prob),
  'fleet.imputedCapitalRate': prob,
};

// ---------------------------------------------------------------------------------------------- coverage

/** The equipment files for tests/data/validation.test.ts's coverage guard, with what validates each. */
export const EQUIPMENT_COVERAGE: Readonly<Record<string, string>> = {
  'equipment/brands.ts': 'equipmentBrandsSchema + cross-references (src/data/equipment/catalog.test.ts)',
  'equipment/classes.ts': 'equipmentClassesSchema (src/data/equipment/catalog.test.ts)',
  'equipment/index.ts': 'aggregator and typed views of the equipment files',
  'equipment/inheritedFleet.ts': 'inheritedFleetSpecSchema + §1 1.8.2 valuation (src/data/equipment/catalog.test.ts)',
  'equipment/models.ts': 'equipmentModelsSchema + cross-references (src/data/equipment/catalog.test.ts)',
  'equipment/packages.ts': 'equipmentPackagesSchema + cross-references (src/data/equipment/catalog.test.ts)',
  'equipment/types.ts': 'types only',
};
