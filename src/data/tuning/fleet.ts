// `fleet.*` tuning constants (DESIGN §9 9.15). Keys must start with 'fleet.'. USD are year-1 dollars, × cpiIndex where
// a price is read. Catalog, brand and package tables live in src/data/equipment (9.2).
//
// This file holds the 9.15 rows P1–P2 code reads (contract §9.3: "§9 9.15 P1 rows"; the P3–P5 rows ship with their
// systems). The two difficulty-scaled §9 keys, `fleet.privateLemonShare` and `fleet.failureHazardMult` (§1 1.11), are
// P3 and join with their difficulty rows. Where a 9.15 row writes a value without a key name, the key named here is
// this package's (marked "(name)") and is reported for 9.15.
import type { TuningTable } from './types';

/** P1 visible condition grades (9.14). */
type GradeTable<T> = { readonly A: T; readonly B: T; readonly C: T; readonly D: T };

export const fleetTuning = {
  // ---- Price model (9.3.2)
  // dep_f(a) = A × exp(−λ a) + F per family, fit to R4's resale-by-age table (D-9.7); a = age-equivalent years.
  'fleet.depCurve.excavator': { a: 0.809, lambda: 0.1165, f: 0.03 },
  'fleet.depCurve.dozer': { a: 0.82, lambda: 0.1024, f: 0.06 },
  'fleet.depCurve.wheeled': { a: 0.809, lambda: 0.13, f: 0.03 },
  'fleet.depCurve.plant': { a: 0.72, lambda: 0.15, f: 0.04 }, // plant, recovery, conveyor
  'fleet.depCurve.light': { a: 0.75, lambda: 0.14, f: 0.05 }, // pumps, gensets, drills, road trucks, site items
  // ageEq = (1 − w_h) × ageYr + w_h × hours / refHoursPerYear; w_h by depreciation family (plant and light 0.3).
  'fleet.hoursWeight': { excavator: 0.5, dozer: 0.5, wheeled: 0.5, plant: 0.3, light: 0.3 },
  'fleet.refHoursPerYear': 1500,
  'fleet.condPriceSlope': 0.8,
  // condRef(H): piecewise-linear [hours, condSignal] knots, flat beyond the last (D-9.32).
  'fleet.condRefByHours': [
    [0, 1.0],
    [1500, 0.85],
    [3000, 0.71],
    [5000, 0.61],
    [7500, 0.5],
    [10000, 0.53],
    [15000, 0.58],
  ],

  // ---- Listing generation (9.3.3, D-9.63)
  // Seven classes by name; every other class (recovery, drill, conveyor, road truck, site) lists under `other`.
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
  // Size slot weights within each listing group over every 9.2 size slot (DESIGN gives excavator.ex13 0.10; the rest
  // are this package's, logged). P1 renormalizes over the P1 models of the group (D-9.63). §4's hand tools and the
  // shop building never list (rented by the day, or built); slots without a catalog row yet join with their P3 rows.
  'fleet.listingSizeWeights': {
    excavator: { ex13: 0.1, ex20: 0.3, ex30: 0.32, ex45: 0.2, ex70: 0.08 },
    dozer: { dz6: 0.3, dz7: 0.22, dz8: 0.28, dz9: 0.14, dz10: 0.06 },
    artTruck: { adt25: 0.3, adt30: 0.45, adt40: 0.25 },
    loader: { ld950: 0.35, ld966: 0.4, ld980: 0.25 },
    washPlant: {
      grz40: 0.14,
      tr30: 0.1,
      tr50: 0.18,
      tr75: 0.16,
      tr150: 0.12,
      tr300: 0.04,
      der150: 0.05,
      sh200: 0.05,
      sh350: 0.03,
      dw20: 0.08,
      scrub: 0.02, // plant add-ons list with the plants
      run3x24: 0.03,
    },
    pump: { pmp4: 0.25, pmp6: 0.35, pmp8: 0.22, pmp10: 0.12, pmp12: 0.06 },
    generator: { gen50: 0.2, gen100: 0.32, gen200: 0.25, gen300: 0.15, gen500: 0.08 },
    other: {
      pickup: 0.25,
      campT8: 0.08,
      campS12: 0.04,
      campSlp6: 0.02,
      campM25: 0.01,
      campP25: 0.01,
      campSafe: 0.01,
      jigS: 0.06,
      jigL: 0.03,
      cenS: 0.04,
      cenM: 0.06,
      cenL: 0.02,
      table: 0.03,
      goldRoom: 0.01,
      stk30: 0.02,
      cnv24: 0.02,
      tank1k: 0.06,
      tank10k: 0.03,
      svcTruck: 0.06,
      fuelTruck: 0.04,
      lowboy: 0.03,
      drAug: 0.02,
      drRC: 0.02,
      drBeck: 0.02,
      drSonic: 0.01,
    },
  },
  // hours = ageYr × LN(hoursPerYearMedian, hoursPerYearSigma); plants and light items × lightPlantHoursMult.
  'fleet.hoursPerYearMedian': 1150,
  'fleet.hoursPerYearSigma': 0.35, // (name) 9.3.3's log-sd of hours per year
  'fleet.lightPlantHoursMult': 0.6,
  'fleet.p1UsedListingsPerDistrict': 6,
  'fleet.p1UsedArrivalsPerWeek': 1,
  'fleet.p1UsedListingLifeWeeks': 6,
  'fleet.p1GradeShares': { A: 0.15, B: 0.4, C: 0.3, D: 0.15 } satisfies GradeTable<number>,
  'fleet.p1GradeAgeYears': { A: [1, 4], B: [3, 9], C: [7, 15], D: [12, 30] } satisfies GradeTable<
    readonly [number, number]
  >,
  // Dealer graded-used offers (D-9.58): the grade midpoints of p1GradeAgeYears.
  'fleet.p1DealerUsedAgeYears': { A: 2.5, B: 6, C: 11, D: 21 } satisfies GradeTable<number>,
  'fleet.p1UsedRipperShare': 0.5, // rotating used dz6 listings with a ripper (D-9.60)
  'fleet.ripperUsd': 35000, // D6 ripper option, × cpi (9.2.1, D-9.60)

  // ---- Acquisition (9.4, D-9.67)
  // Sales tax on a cash purchase by §3 District.jurisdictionId (D-9.48; Yukon GST is recoverable).
  'fleet.salesTaxRate': { akStyle: 0, nvStyle: 0.071, temperateStyle: 0, yukon: 0 },
  'fleet.newDealerPrepWeeks': 1, // (name) an in-stock new unit's dealer prep; P1 units are always in stock (9.14)
  'fleet.newDepositPct': 0.1,
  'fleet.depositRefundWeeks': 2,
  'fleet.newOrderHoldWeeks': 4,
  'fleet.packageDiscountPct': 0.03, // dealer packages (9.2.3, P3)

  // ---- P1 condition grades and flat maintenance (9.14, D-9.24, D-9.25, D-9.49)
  'fleet.p1GradeRateMult': { A: 1, B: 0.96, C: 0.91, D: 0.85 } satisfies GradeTable<number>,
  'fleet.p1GradeMaintMult': { A: 1, B: 1.15, C: 1.25, D: 1.6 } satisfies GradeTable<number>,
  'fleet.p1GradePriceMult': { A: 1.2, B: 1.05, C: 0.9, D: 0.7 } satisfies GradeTable<number>,
  // USD per SMR hour: R4 §7 mid R&M + undercarriage/tires + PM. The P1 rows are DESIGN's (D-9.25); the phase-3 rows
  // follow the same method (D-9.57, logged): ex45 35 + 9 + 5.5 = 49.5 → 50; dz9 55 + 45 + 10 = 110; adt40
  // 28 + 16 + 5 = 49; ld980 = 966 × list 720/500 (as ld950 ≈ 966 × 0.76) = 47.5 → 48. R4 has no plant rows, so the
  // trommel line's own scale carries the large plant and its add-ons: tr50 11 and tr150 28 give cost ∝ list^0.81
  // (which returns tr75's 15), so tr300 = 28 × (950/380)^0.81 = 58.9 → 59, the scrubber 11 × (140/120)^0.81 = 12.46
  // → 12 and the conveyor 11 × (60/120)^0.81 = 6.3 → 6; cenL = cenM × list 240/110 = 13; pmp10 = pmp6 × 95/38 = 10;
  // gen300 = gen100 × 120/50 = 7.2 → 7, gen500 × 200/50 = 12. Site items have none.
  'fleet.p1MaintUsdPerHr': {
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
    ex45: 50,
    dz9: 110,
    adt40: 49,
    ld980: 48,
    tr300: 59,
    scrub: 12,
    cnv24: 6,
    cenL: 13,
    pmp10: 10,
    gen300: 7,
    gen500: 12,
  },
  'fleet.p1OpWearShare': 0.6, // share of P1 maintenance that responds to operator skill (§8)
  'fleet.p1InHouseMaintMult': 0.7,
  'fleet.p1OwnerShopMaintMult': 0.7, // 0.80 is the pre-agreed fallback if BALANCE O-07 fails for the Mechanic (D-9.49)
  'fleet.p1DealerCashShare': 0.8, // P1 dealer cash sale: 0.80 × resaleEstimate, instant (9.10)
  // Site upkeep while the claim's site is active (D-9.68): pickup USD per week (× cpi) to exp.parts; each camp unit a
  // share of its new price per week to exp.camp. (name: `campShareOfNew`)
  'fleet.siteUpkeepUsdPerWeek': { pickup: 150, campShareOfNew: 0.001 },
  // §4's day rates for the prospecting tools (9.2.4, D-9.47).
  'fleet.toolRentUsdPerDay': { rocker: 25, drywasherHand: 40, testPlant: 150 },

  // ---- Per-machine functions, P1 forms (9.7.2, 9.7.3; §1 suggested values, D-9.2)
  'fleet.coldRateMult': { deepCold: 0.92, cold: 0.97, cool: 1, mild: 1, hot: 1 },
  'fleet.coldFuelMult': { deepCold: 1.15, cold: 1.05, cool: 1, mild: 1, hot: 1 },

  // ---- Transport and mobilization (9.5, D-9.13)
  'fleet.lowboyLoadFixedUsd': 1200,
  'fleet.lowboyUsdPerLoadedMile': 5.5,
  'fleet.lowboyDeadheadMult': 1.5,
  'fleet.legUsdPerLoadMile': { seasonalRoad: 14, winterTrail: 300 },
  'fleet.permitOsUsd': 150,
  'fleet.permitSlUsd': 2500,
  'fleet.pilotUsdPerMi': 2,
  'fleet.airUsdPerLb': 1.4,
  'fleet.transportSchedulingWeeks': 1,
  'fleet.pavedMilesPerWeek': 1500, // (name) 9.5 weeks: pavedMi / 1,500
  'fleet.seasonalMilesPerWeek': 600, // (name) 9.5 weeks: seasonalMi / 600
  'fleet.trailMilesPerWeek': 60,
  'fleet.springRestrictionMult': 1.35,
  'fleet.springRestrictStartWeek': 10,
  'fleet.interHubMiDefault': 300,
  'fleet.riggingUsdPerHr': 115,
  'fleet.riggingCrewHoursPerWeek': 120,
  'fleet.driveUsdPerMile': 2.5,

  // ---- Ownership economics (9.10, D-9.22)
  'fleet.bookLifeYears': { excavator: 8, dozer: 10, wheeled: 8, plant: 8, light: 5, site: 7 },
  'fleet.bookResidual': { excavator: 0.25, dozer: 0.3, wheeled: 0.2, plant: 0.15, light: 0.15, site: 0.1 },
  'fleet.imputedCapitalRate': 0.08, // cash-owned machines in machineCostPerHour
} as const satisfies TuningTable;

/**
 * Old §1 keys that alias a grade-D value of a 9.15 table and hold no value of their own (9.15, D-9.49): resolve them
 * from the resolved tuning, so a change to grade D changes them too and the two can never diverge.
 */
export const fleetTuningAliases = {
  'fleet.p1InheritedMaintMult': { key: 'fleet.p1GradeMaintMult', field: 'D' },
  'fleet.p1InheritedRateMult': { key: 'fleet.p1GradeRateMult', field: 'D' },
} as const satisfies Readonly<Record<string, { readonly key: keyof typeof fleetTuning; readonly field: string }>>;
