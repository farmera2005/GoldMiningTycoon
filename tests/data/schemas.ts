// zod schemas for every data file under src/data (CLAUDE.md "Content and tuning"; DESIGN §2.10, §2.14 "Data
// validation", D-2.7). TypeScript's `satisfies` checks shapes but not values: these add finiteness, ranges where
// DESIGN states them, mixes that sum to 1, complete enum keys and cross-references. They live with the tests because
// data/ may import only data/ and engine types (DESIGN §2.1), and zod is a test-time dependency.
import { z } from 'zod';
import { FLEET_TUNING_KEY_SCHEMAS } from './schemas/equipment';

// ------------------------------------------------------------------------------------------------ building blocks

export const MIX_TOLERANCE = 1e-9;

/** zod 4's number already rejects NaN and ±Infinity. */
export const num = z.number();
export const nonNeg = z.number().nonnegative();
export const pos = z.number().positive();
export const prob = z.number().min(0).max(1);
export const int = z.number().int();
export const nonNegInt = z.number().int().nonnegative();
export const posInt = z.number().int().positive();

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);
const sumsToOne = (xs: readonly number[]): boolean => Math.abs(sum(xs) - 1) <= MIX_TOLERANCE;

/** A [lo, hi] pair with lo ≤ hi. */
export function range(inner: z.ZodNumber = num) {
  return z.tuple([inner, inner]).refine(([lo, hi]) => lo <= hi, { message: 'range lo > hi' });
}

/** An object with exactly these keys, each matching `inner`. */
export function keyed<K extends string>(keys: readonly K[], inner: z.ZodType) {
  const shape = {} as Record<K, z.ZodType>;
  for (const k of keys) shape[k] = inner;
  return z.strictObject(shape);
}

/** Some of these keys (none other), each matching `inner`. */
export function someOf<K extends string>(keys: readonly K[], inner: z.ZodType) {
  const shape = {} as Record<K, z.ZodOptional<z.ZodType>>;
  for (const k of keys) shape[k] = inner.optional();
  return z.strictObject(shape);
}

/** Exactly these keys, probabilities summing to 1. */
export function mixOf<K extends string>(keys: readonly K[]) {
  return keyed(keys, prob).refine((m) => sumsToOne(Object.values(m) as number[]), { message: 'mix must sum to 1' });
}

/** Some of these keys, probabilities summing to 1 (a template's mix over the classes it uses). */
export function partialMixOf<K extends string>(keys: readonly K[]) {
  return someOf(keys, prob).refine((m) => sumsToOne(Object.values(m) as number[]), { message: 'mix must sum to 1' });
}

/** A fixed-length array of probabilities summing to 1. */
export function mixArray(n: number) {
  return z
    .array(prob)
    .length(n)
    .refine((xs) => sumsToOne(xs), { message: 'mix must sum to 1' });
}

/** A lognormal law LN(median, sigma), optionally clamped to [lo, hi] around its median. */
export const lnLaw = z
  .object({ median: pos, sigma: nonNeg, lo: pos.optional(), hi: pos.optional() })
  .refine((l) => (l.lo ?? 0) <= l.median && l.median <= (l.hi ?? Infinity), { message: 'need lo ≤ median ≤ hi' });

/** Every `xLo` / `xHi` pair of an object is ordered (the §3 tables write ranges as two fields). */
function loHiOrdered(o: Readonly<Record<string, unknown>>): boolean {
  for (const k of Object.keys(o)) {
    if (!k.endsWith('Lo')) continue;
    const hi = o[`${k.slice(0, -2)}Hi`];
    const lo = o[k];
    if (typeof lo === 'number' && typeof hi === 'number' && lo > hi) return false;
  }
  return true;
}

export const tuningValue: z.ZodType = z.lazy(() =>
  z.union([num, z.string(), z.boolean(), z.array(tuningValue), z.record(z.string(), tuningValue)]),
);

// ---------------------------------------------------------------------------------------------- §3 enumerations

export const SIZE_CLASSES = ['coarse', 'medium', 'fine', 'ultrafine'] as const;
export const DEPOSIT_TYPES = ['creek', 'bench', 'deepMuck', 'dredgedGround', 'desertFan', 'gulch'] as const;
export const BEDROCK_TYPES = [
  'schist',
  'slatePhyllite',
  'granite',
  'basaltVolcanic',
  'clayFalse',
  'karstLimestone',
] as const;
export const OLD_TIMER_KINDS = ['none', 'handCut', 'drift', 'dredge', 'dryWash', 'hydraulic', 'recentCat'] as const;
export const TOWN_TIERS = ['outpost', 'serviceTown', 'hubCity'] as const;
export const ACCESS_CLASSES = ['highway', 'seasonalRoad', 'winterTrail', 'flyIn'] as const;
export const SIZE_SETTINGS = ['proximal', 'midReach', 'bench', 'fan', 'gulch'] as const;
export const LISTING_SETTINGS = ['valleyBottom', 'bench', 'dredgedGround', 'fan', 'gulch'] as const;
export const ECON_CLASSES = ['uneconomic', 'marginal', 'good', 'excellent'] as const;
export const HONESTIES = ['accurate', 'optimistic', 'cherryPicked', 'fraudulent'] as const;
export const HOLDER_SITUATIONS = [
  'prospector',
  'absentee',
  'retiringOperator',
  'estate',
  'distressedOperator',
] as const;
export const CLIMATE_BANDS = ['subarctic', 'arid'] as const;
export const CLAIM_ACRES = ['20', '40', '80', '160'] as const;

const sizeRecord = (inner: z.ZodType) => keyed(SIZE_CLASSES, inner);

/** A §3.8 / §4 4.2 sample-method row (MethodParamsData without the id the catalog adds). */
export const sampleMethod = z
  .object({
    positionMode: z.enum(['exposure', 'pit', 'fullColumn', 'interval']),
    exposureDepthFrac: prob.optional(),
    volumeBcy: pos.optional(),
    reachFt: z.record(z.string(), pos).optional(),
    interval: range().optional(),
    maxDepthFt: pos.nullable().optional(),
    frozenOk: z.boolean(),
    bedrockPenFt: nonNeg,
    captureBySize: sizeRecord(prob),
    volumeCv: nonNeg,
    weighCv: nonNeg,
    geomCv: nonNeg,
    thickCv: nonNeg.optional(),
    biasMult: pos.optional(),
    bcyPerFt: pos.optional(),
  })
  .strict();

// ------------------------------------------------------------------------------------------ §4 enumerations

export const REGION_TEMPLATE_IDS = [
  'northernFederal',
  'aridFederal',
  'temperateFederal',
  'alaskaState',
  'yukon',
] as const;
/** The old-timer kinds §4 models on worked ground (4.10.2 offset table; hydraulic and recentCat use other rules). */
export const DEPLETION_KINDS = ['drift', 'handCut', 'dredge', 'dryWash'] as const;
export const CONFIDENCE_CLASSES = ['measured', 'indicated', 'inferred'] as const;
export const SEASON_PHASES = ['winter', 'breakup', 'operating', 'freezeup'] as const;
export const METHOD_IDS = [
  'pan',
  'handPit',
  'drywasher',
  'excavatorPit',
  'trench',
  'bulkSample',
  'auger',
  'churn',
  'churnHistoric',
  'sonic',
  'rc',
  'geophysics',
  'production',
] as const;

/** Values that must not decrease in the listed key order (a ladder such as budget ≤ standard ≤ premier). */
function ascending(keys: readonly string[], strict = false) {
  return (o: Readonly<Record<string, unknown>>): boolean => {
    for (let i = 1; i < keys.length; i++) {
      const a = o[keys[i - 1] as string];
      const b = o[keys[i] as string];
      if (typeof a !== 'number' || typeof b !== 'number' || (strict ? !(a < b) : a > b)) return false;
    }
    return true;
  };
}

/** A §10 ripple row (§4.18): elasticity on goldIdxReal, lag, clamp around the neutral 1.0, escalation with CPI. */
const rippleRow = z
  .strictObject({ elasticity: num, lagWeeks: nonNegInt, clampLo: nonNeg, clampHi: pos, escalate: z.boolean() })
  .refine((r) => r.clampLo <= 1 && 1 <= r.clampHi, { message: 'the clamp must contain the neutral 1.0' });

/** geology.estSmallCountTable (§4.4.4): (N_eff, b, v) rows on a strictly increasing grid of N_eff. */
export const smallCountTableSchema = z
  .array(z.strictObject({ n: pos, b: num, v: nonNeg }))
  .min(2)
  .refine((rows) => rows.every((r, i) => i === 0 || (rows[i - 1] as { n: number }).n < r.n), {
    message: 'the N_eff grid must increase',
  });

// --------------------------------------------------------------------------------------------- tuning: per key

/**
 * Shapes and DESIGN-stated ranges per tuning key. Every object- or array-valued key must appear here (its shape is
 * checked); scalar keys take the naming rules in `scalarRule` and may add a stricter schema here.
 */
export const TUNING_KEY_SCHEMAS: Readonly<Record<string, z.ZodType>> = {
  // ---- game.* (§1 1.20, §2 2.16)
  'game.history.weeklyKeep': posInt,
  'game.startCalendarYear': int.min(1900).max(2500), // §1 1.6 setup bounds
  'game.nw.partsResaleFactor': prob, // §1 1.13: parts count at a share of book
  'game.alerts.inboxRetentionWeeks': posInt,
  'game.start.bootstrapper.companyCashUsd': nonNeg,
  'game.start.bootstrapper.personalCashUsd': nonNeg,
  // ---- geology.world (§3.1, §3.3.1, §3.4)
  'geology.world.districtsP1': posInt,
  'geology.world.districtsFull': posInt,
  'geology.world.maxClaims': posInt,
  'geology.world.mapMi': z.tuple([pos, pos]), // width × height, not a range
  'geology.world.mainLengthMi': range(pos),
  'geology.world.outletEdgeFrac': range(prob),
  'geology.world.nTrib': range(nonNegInt),
  'geology.world.tribPosFrac': range(prob),
  'geology.world.tribAngleDeg': range(z.number().min(0).max(180)),
  'geology.world.tribLengthMi': range(pos),
  'geology.world.branchPosFrac': range(prob),
  'geology.world.branchLengthMi': range(pos),
  'geology.world.valleyHalfWidthFt': z.tuple([range(pos), range(pos), range(pos)]), // creek order 1 / 2 / 3
  'geology.world.withdrawnStretchFrac': range(prob),
  'geology.world.specialStretchFrac': range(prob),
  'geology.world.benchStretchFrac': range(prob),
  'geology.world.benchOffsetFt': range(nonNeg),
  'geology.world.valleyFirstRowMax': nonNegInt,
  'geology.world.valleyGapRows': range(posInt),
  'geology.world.dredgedStretchMi': range(pos),
  'geology.world.dredgedMaxStretches': nonNegInt,
  'geology.world.familyRunParcels': posInt,
  'geology.world.junctionBoostRows': nonNegInt,
  // ---- geology.env (§3.4.1)
  'geology.env.channelOffsetFt': range(),
  'geology.env.sensitivity': keyed(['base', 'fish', 'anadromous', 'wetlandShare', 'specialStatus', 'noiseSd'], prob),
  // ---- geology.prior (§3.9)
  'geology.prior.statusMult': keyed(['held', 'listed', 'open'], pos),
  'geology.prior.paystreakShare': keyed(LISTING_SETTINGS, prob),
  'geology.prior.oldWorkingsMult': keyed(['dredgeTailings', 'tailingsPiles'], z.number().gt(0).max(1)),
  // ---- geology.grade (§3.5)
  'geology.grade.pocketBcy': range(pos),
  'geology.grade.pocketMult': lnLaw,
  'geology.grade.pocketGradeClamp': range(pos),
  'geology.grade.claim': z
    .object({
      decayJitterLo: pos,
      decayJitterHi: pos,
      frozenDegreeLo: prob,
      frozenDegreeHi: prob,
      frozenMaxP: prob,
      clayLogSd: nonNeg,
      boulderLogSd: nonNeg,
      cementLogSd: nonNeg,
      blockMixJitterLogSd: nonNeg,
      coarseStreakThin: prob,
      blockFinenessSd: nonNeg,
      permafrostBlockSd: nonNeg,
      unfrozenSubarcticMax: prob,
      groundBlockSd: nonNeg,
      clayFalseMinClay: prob,
      bedrockJitterLo: pos,
      bedrockJitterHi: pos,
      payStreakWeight: prob,
      maxOverburdenFt: pos,
      minPayFt: pos,
      maxPayFt: pos,
    })
    .refine(loHiOrdered, { message: 'a Lo field exceeds its Hi' })
    .refine((c) => c.minPayFt <= c.maxPayFt, { message: 'minPayFt > maxPayFt' }),
  'geology.grade.boulderSettingMult': keyed(SIZE_SETTINGS, pos),
  // ---- geology.oldTimer (§3.6)
  'geology.oldTimer.liabilityEraYear': int,
  'geology.oldTimer.preStripMaxAgeYr': nonNegInt,
  'geology.oldTimer.filedSeasonMinYear': int,
  'geology.oldTimer.maxExtraction': prob,
  'geology.oldTimer.depleteCap': prob,
  'geology.oldTimer.histRecoveryHand': range(prob),
  'geology.oldTimer.recentCapture': z.array(prob).length(4), // by size class
  'geology.oldTimer.recentOpSkill': range(pos),
  'geology.oldTimer.improvementsUsd': z.strictObject({
    median: pos,
    sigma: nonNeg,
    oldMult: prob,
    oldYears: nonNegInt,
  }),
  'geology.oldTimer.recentStartYear': range(int),
  'geology.oldTimer.kinds': z
    .strictObject({
      drift: z.record(z.string(), num),
      handCut: z.record(z.string(), num),
      dredge: z.record(z.string(), num),
      dryWash: z.record(z.string(), num),
      hydraulic: z.record(z.string(), num),
      recentCat: z.record(z.string(), num),
    })
    .refine((k) => Object.values(k).every(loHiOrdered), { message: 'a kind has Lo > Hi' })
    .refine(
      (k) =>
        Object.values(k).every((row) =>
          Object.entries(row).every(([f, v]) => !/^(extract|top|work)/.test(f) || (v >= 0 && v <= 1)),
        ),
      { message: 'extraction, top and work shares are probabilities' },
    ),
  'geology.oldTimer.driftBottom': z.strictObject({
    topFt: pos,
    bedrockFt: nonNeg,
    decayMult: pos,
    bedrockShareMult: pos,
  }),
  'geology.oldTimer.dredgeEffects': z.strictObject({ boulderMult: pos, decayFt: pos, minBedrockShare: prob }),
  'geology.oldTimer.depleteWeights': keyed(['hand', 'dredge'], z.array(pos).length(4)),
  'geology.oldTimer.pileBcy': z
    .strictObject({
      driftFt: pos,
      driftLo: prob,
      driftHi: prob,
      handCutLo: prob,
      handCutHi: prob,
      dryWashFt: pos,
      dryWashLo: prob,
      dryWashHi: prob,
    })
    .refine(loHiOrdered, { message: 'a Lo field exceeds its Hi' }),
  'geology.oldTimer.pileMix': mixArray(4),
  'geology.oldTimer.preStripBlocks': range(posInt),
  'geology.oldTimer.preStripThawFt': range(pos),
  // ---- geology.permitStub, records, method (§3.6, §3.9, §4 4.2.B)
  'geology.permitStub.minLastSeasonYear': int,
  'geology.permitStub.bondFrac': range(prob),
  'geology.permitStub.rceStubUsdPerAcre': nonNeg,
  'geology.records.priorDrillHoles': range(posInt),
  'geology.records.priorDrillYears': range(int),
  'geology.method.churnHistoric': sampleMethod,
  // ---- geology.particle, sample (§3.8)
  'geology.particle.meanMg': z.tuple([pos, pos, pos]), // medium, fine, ultrafine
  'geology.particle.massCv': z.array(nonNeg).length(4),
  'geology.sample.poissonNormalLambda': pos,
  'geology.sample.cltParticleThreshold': posInt,
  'geology.sample.frozenThreshold': prob,
  'geology.sample.waterTableFt': keyed(CLIMATE_BANDS, pos),
  'geology.sample.waterInflowP': keyed(CLIMATE_BANDS, prob),
  'geology.sample.pocketMix': mixArray(4),
  'geology.sample.waterStopFt': range(pos),
  'geology.sample.tercileCuts': range(prob).refine(([a, b]) => a > 0 && a < b && b < 1, { message: '0 < a < b < 1' }),
  // ---- geology.seller (§3.10)
  'geology.seller.honestyMix': mixOf(HONESTIES),
  'geology.seller.honestyTilts': keyed(HONESTIES, someOf(HOLDER_SITUATIONS, pos)),
  'geology.seller.situationMix': mixOf(HOLDER_SITUATIONS),
  'geology.seller.maxParcelsPerHolder': posInt,
  'geology.seller.methods': keyed(['sellerPan', 'sellerPit3', 'bedrockScrape'], sampleMethod),
  'geology.seller.packageMix': z.strictObject({
    accurate: mixOf(['complete', 'partial', 'none']),
    optimistic: mixOf(['complete', 'partial', 'none']),
    cherryPicked: mixOf(['complete', 'partial', 'none']),
    fraudulent: mixOf(['complete', 'partial', 'none']),
    estateNoneP: prob,
  }),
  'geology.seller.claimedBlocksMult': keyed(HONESTIES, pos),
  'geology.seller.optMult': lnLaw,
  'geology.seller.fraudMult': lnLaw,
  'geology.seller.tellDetect': z.record(z.string(), keyed(['recordsReview', 'geologistReview', 'siteVisit'], prob)),
  // ---- geology.supply (§3.11)
  'geology.supply.minInitialPerDistrict': nonNegInt,
  'geology.supply.relistCooldownWk': nonNegInt,
  'geology.supply.postSaleCooldownWk': nonNegInt,
  'geology.supply.goldLagWk': nonNegInt,
  'geology.supply.starterLeasePerDistrict': nonNegInt,
  'geology.supply.baseListHazard': prob,
  'geology.supply.maxListHazard': prob,
  'geology.supply.npcForfeitRate': prob,
  'geology.supply.seasonMult': keyed(['offSeason', 'preSeason', 'inSeason'], pos),
  'geology.supply.inflowMult': keyed(ECON_CLASSES, pos),
  'geology.supply.saleQualityMult': keyed(ECON_CLASSES, pos),
  'geology.supply.goldMultClamp': range(pos),
  // ---- geology.access (§3.3.3)
  'geology.access.distScaleClamp': range(pos),
  // ---- geology.water (§3.3.4)
  'geology.water.lowFlowShape': keyed(['creek', 'spring'], pos),
  'geology.water.listingShape': keyed(['early', 'mid', 'late'], pos),
  'geology.water.rightStubP': keyed(CLIMATE_BANDS, prob),
  'geology.water.rightStubGpm': range(pos),
  'geology.water.benchLiftFt': range(nonNeg),
  'geology.water.nearestFillFrac': range(prob),
  // ---- geology.refEcon (§3.7)
  'geology.refEcon.payable': prob,
  'geology.refEcon.capture': z.array(prob).length(4), // by size class
  'geology.refEcon.clayRecoveryPenalty': prob,
  'geology.refEcon.goodMargin': prob,
  'geology.refEcon.excellentMargin': prob,
  'geology.refEcon.stripUsd': keyed(CLIMATE_BANDS, nonNeg),
  'geology.refEcon.washUsd': keyed(CLIMATE_BANDS, nonNeg),
  'geology.refEcon.devBaseUsd': keyed(CLIMATE_BANDS, nonNeg),
  'geology.refEcon.devPerAcreUsd': keyed(CLIMATE_BANDS, nonNeg),
  // ---- geology.siteVisit (§3.12)
  'geology.siteVisit.costUsd': keyed(ACCESS_CLASSES, nonNeg),
  'geology.siteVisit.days': keyed(ACCESS_CLASSES, posInt),
  // ---- geology.* estimator, records, programs (§4 4.20)
  'geology.estPriorMedianAdj': someOf(REGION_TEMPLATE_IDS, num.min(-1).max(1)), // log valve per template, default 0
  'geology.estThinCoverSiteWeight': prob, // a precision weight on the hand-cut depth bound (0 turns it off)
  'geology.estSmallCountTable': smallCountTableSchema,
  'geology.planWashUsdPerPayBcy': keyed(CLIMATE_BANDS, nonNeg),
  'geology.planStripUsdPerBcy': keyed(CLIMATE_BANDS, nonNeg),
  // §4.7: strip × (1 + 0.6·frozen + 0.5·cement), wash × (1 + 0.3·boulders + 0.3·clay), recovery × (1 − 0.15·clay).
  'geology.planGroundMult': z.strictObject({
    stripFrozen: nonNeg,
    stripCement: nonNeg,
    washBoulders: nonNeg,
    washClay: nonNeg,
    recClay: prob,
  }),
  'geology.planTercileValues': keyed(['low', 'med', 'high'], prob).refine(ascending(['low', 'med', 'high'], true), {
    message: 'need low < med < high',
  }),
  'geology.estProdAttribLogSd': keyed(['oneBlock', 'severalBlocks'], nonNeg).refine(
    ascending(['oneBlock', 'severalBlocks']),
    { message: 'one block is attributed at least as well as several' },
  ),
  // §4.10.2: [worked, passed-over] log-grade offsets on paystreak blocks; the passed-over offset is ≤ 0 (the
  // old-timers took the richer blocks) and a worked block lost gold, so neither exceeds the virgin selection.
  'geology.recordsWorkedLogOffset': keyed(DEPLETION_KINDS, z.tuple([num.min(-5).max(1), num.min(-5).max(0)])),
  'geology.recordsWorkedShare': keyed(DEPLETION_KINDS, z.number().gt(0).max(1)), // q_kind
  'geology.recordsRemovalLog': keyed(DEPLETION_KINDS, num.max(0)), // ℓ_kind = E[ln(1 − x)] ≤ 0
  'geology.recordsTailingsPriorMedian': keyed(['handEra', 'dozer', 'dredge'], pos),
  // Item weights multiply the find probability (4.10.2), so each lies in [0, 1].
  'geology.recordsItemWeight': keyed(
    ['creekHistory', 'oldWorkings', 'priorExploration', 'filedProduction', 'permitHistory'],
    prob,
  ),
  'geology.reviewerMult': z
    .strictObject({
      owner: prob,
      staffBase: prob,
      staffPerSkill: nonNeg,
      ownerGeologist: prob,
      consultantBudget: prob,
      consultantStandard: prob,
      consultantPremier: prob,
    })
    .refine(ascending(['consultantBudget', 'consultantStandard', 'consultantPremier']), {
      message: 'consultant tiers must not get worse',
    })
    .refine((r) => r.staffBase + 100 * r.staffPerSkill <= 1, { message: 'a skill-100 staff reviewer exceeds 1' }),
  'geology.tellSkillMult': z
    .strictObject({
      recordsDivisor: pos,
      ownerGeologist: pos,
      staffBase: nonNeg,
      staffPerSkill: nonNeg,
      consultantBudget: pos,
      consultantStandard: pos,
      consultantPremier: pos,
    })
    .refine(ascending(['consultantBudget', 'consultantStandard', 'consultantPremier']), {
      message: 'consultant tiers must not get worse',
    }),
  // §4.8 block classes: the measured limit is the tightest.
  'geology.confBlockMaxLogSd': keyed(CONFIDENCE_CLASSES, pos).refine(ascending(CONFIDENCE_CLASSES, true), {
    message: 'need measured < indicated < inferred',
  }),
  'geology.contractorLeadWeeksBase': keyed(['sonic', 'rc', 'auger', 'churn', 'geophysics', 'pitting'], nonNegInt),
  'geology.ripple.drilling': rippleRow,
  'geology.ripple.pitting': rippleRow,
  'geology.ripple.geophysics': rippleRow,
  'geology.ripple.consultants': rippleRow,
  'geology.ripple.lab': rippleRow,
  'geology.ripple.leadTime': rippleRow,
  // ---- market.* (§10 10.19)
  'market.openingSpotUsdPerFineOz': pos,
  'market.openingDieselRackUsdPerGal': pos,
  'market.preHistory.keepWeeks': nonNegInt,
  'market.cb.normal': nonNeg,
  // ---- fleet.* (§9 9.15): tests/data/schemas/equipment.ts
  ...FLEET_TUNING_KEY_SCHEMAS,
};

/**
 * Naming rules for scalar keys (CLAUDE.md "Names carry units"; DESIGN's tables): probabilities, shares and fractions
 * lie in [0, 1]; multipliers are positive; money, spreads and counts of weeks are non-negative.
 */
export function scalarRule(key: string): z.ZodType {
  const last = key.slice(key.lastIndexOf('.') + 1);
  if (/(P|Prob|Share|Frac)$/.test(last)) return prob;
  if (/Mult$/.test(last)) return pos;
  if (/(Usd|UsdPer[A-Za-z]+)$/.test(last)) return nonNeg;
  if (/(Sd|LogSd|Sigma|Cv)$/.test(last)) return nonNeg;
  if (/(Weeks|Wk)$/.test(last)) return nonNegInt;
  return z.union([num, z.boolean(), z.string()]);
}

// ------------------------------------------------------------------------------------------ difficulty (§1 1.11)

export const diffEntry = z.union([z.strictObject({ mul: pos }), z.strictObject({ set: tuningValue })]);
export const difficultyTableSchema = z.record(
  z.string().regex(/^[a-z]+\.[A-Za-z0-9.]+$/),
  z.strictObject({ easy: diffEntry, standard: diffEntry, hard: diffEntry }),
);

// --------------------------------------------------------------------------------------- region templates (§3.2)

const nameList = z
  .array(z.string().min(1))
  .min(1)
  .refine((xs) => new Set(xs).size === xs.length, { message: 'names repeat' });

const depositMult = z.strictObject({ grade: pos, ob: pos, pay: pos, halfWidth: pos });

export const regionTemplateSchema = z
  .object({
    id: z.string().min(1),
    phase: z.number().int().min(1).max(6),
    displayName: z.string().min(1),
    climateBand: z.enum(['subarctic', 'arid', 'temperateMontane']),
    recordsQuality: prob,
    districtRoadMix: partialMixOf(ACCESS_CLASSES),
    roadWinterMaintainedP: prob,
    townTierMix: partialMixOf(TOWN_TIERS),
    townRoadMi: range(pos),
    hubRoadMi: range(pos),
    aquifer: z.strictObject({ wellGpm: range(pos), depthFt: range(pos) }).optional(),
    parcelsPerDistrict: range(posInt),
    stakedFraction: prob,
    patentedShare: prob,
    overlayP: z.strictObject({ withdrawn: prob, specialStatus: prob }),
    overlayLabels: z.strictObject({ withdrawn: z.string().min(1), specialStatus: z.string().min(1) }),
    env: z.strictObject({
      fishByOrder: z.tuple([prob, prob, prob]),
      anadromousP: prob,
      wetlandP: someOf(DEPOSIT_TYPES, prob),
      springWetland: z.boolean(),
    }),
    valley: z.union([
      z.strictObject({ kind: z.literal('creek') }),
      z.strictObject({ kind: z.literal('wash'), overlayFanMainFrac: prob, specialFanFrac: range(prob) }),
    ]),
    benchSideP: prob.optional(),
    trailDegradeMi: range(pos).optional(),
    claimSizeMix: mixOf(CLAIM_ACRES),
    depositMix: partialMixOf(DEPOSIT_TYPES),
    gMed: pos,
    sigma: keyed(['district', 'creek', 'rich', 'claim', 'block'], nonNeg),
    richRangeFt: pos,
    blockRangeAlongFt: pos,
    halfWidthMedFt: pos,
    sigHalfWidth: nonNeg,
    wanderSdFt: nonNeg,
    bgRatio: prob,
    overburden: z.strictObject({ medFt: pos, sig: z.array(nonNeg).length(5) }),
    pay: z.strictObject({ medFt: pos, sig: z.array(nonNeg).length(3) }),
    depositMult: keyed(DEPOSIT_TYPES, depositMult),
    bedrockMix: partialMixOf(BEDROCK_TYPES),
    permafrostP: someOf(DEPOSIT_TYPES, prob),
    clayMed: prob,
    boulderMed: prob,
    cementMed: someOf(DEPOSIT_TYPES, prob),
    fineness: z
      .strictObject({ mean: prob, districtSd: nonNeg, claimSd: nonNeg, lo: prob, hi: prob })
      .refine((f) => f.lo <= f.mean && f.mean <= f.hi, { message: 'need lo ≤ mean ≤ hi' }),
    sizeMixPriors: someOf(SIZE_SETTINGS, mixArray(4)),
    coarseMg: someOf(SIZE_SETTINGS, pos),
    verticalDecayFt: someOf(DEPOSIT_TYPES, pos),
    pocketP: prob,
    oldTimerMix: someOf(DEPOSIT_TYPES, partialMixOf(OLD_TIMER_KINDS)),
    water: z.union([
      z.strictObject({ kind: z.literal('creek'), gpmPerUpstreamMi: pos, sig: nonNeg }),
      z.strictObject({
        kind: z.literal('arid'),
        springP: prob,
        springMedGpm: pos,
        springSig: nonNeg,
        wellMedGpm: pos,
        wellSig: nonNeg,
        depthMedFt: pos,
        depthSig: nonNeg,
        wellClampGpm: range(pos),
        depthClampFt: range(pos),
      }),
    ]),
    names: z.strictObject({ districts: nameList, towns: nameList, hubs: nameList, creeks: nameList }),
  })
  // Every deposit type a template deals carries the per-type tables the generator reads for it.
  .superRefine((t, ctx) => {
    for (const d of Object.keys(t.depositMix)) {
      for (const table of ['oldTimerMix', 'verticalDecayFt'] as const) {
        if (!(d in t[table])) ctx.addIssue({ code: 'custom', message: `${table} has no ${d}`, path: [table] });
      }
    }
  });

export const bedrockTableSchema = keyed(
  BEDROCK_TYPES,
  z.strictObject({ cleanupFt: pos, goldShare: prob, note: z.string().min(1) }),
);

export const townServicesSchema = keyed(
  TOWN_TIERS,
  z.strictObject({
    fuel: z.boolean(),
    partsCounter: z.boolean(),
    weldingShop: z.boolean(),
    goldBuyer: z.boolean(),
    airstrip: z.boolean(),
    clinic: z.boolean(),
    motel: z.boolean(),
    equipmentDealers: z.boolean(),
    laborPoolMult: pos,
  }),
);

export const holderNamesSchema = z.record(z.string(), nameList);

// --------------------------------------------------------------------------------------------- other data files

/** src/data/balance/seeds.json (BALANCE §6.2): one fixed base per rules phase, p0…p6, each a safe integer. */
export const seedsSchema = keyed(['p0', 'p1', 'p2', 'p3', 'p4', 'p5', 'p6'], nonNegInt.max(Number.MAX_SAFE_INTEGER));

/** src/data/tuning/ui.ts (DESIGN §13.25): app configuration, `ui.*` keys only, with the units its names carry. */
export const uiConfigSchema = z
  .record(z.string().regex(/^ui\.[A-Za-z0-9.]+$/), z.union([num, z.boolean(), z.string()]))
  .superRefine((cfg, ctx) => {
    const bad = (k: string, message: string) =>
      ctx.addIssue({ code: 'custom', message: `${k}: ${message}`, path: [k] });
    for (const [k, v] of Object.entries(cfg)) {
      if (typeof v !== 'number') continue;
      const last = k.slice(k.lastIndexOf('.') + 1);
      if (/(Pct|Frac|Opacity[A-Za-z]*)$/.test(last) && (v < 0 || v > 1)) bad(k, 'must lie in [0, 1]');
      if (/(Px|Weeks|Kb|Slots|Keep|Entries|Children|Depth|InMemory|Threshold|Decimals[A-Za-z0-9]*)$/.test(last)) {
        if (!Number.isInteger(v) || v < 0) bad(k, 'must be a non-negative integer');
      }
      if (/(Ms|Usd|Ratio[0-9]|Step|PerGPerM3)$/.test(last) && !(v > 0)) bad(k, 'must be positive');
    }
    if (!['system', 'daylight', 'lamplight'].includes(String(cfg['ui.theme.default']))) {
      bad('ui.theme.default', 'must be system, daylight or lamplight');
    }
  });

/** src/data/text/ui.ts (DESIGN §13.19): `group.CODE` keys to non-empty English strings. */
// Keys are dotted camelCase families (`setup.NAME_EMPTY`, `quickSave.failed`), as CLAUDE.md names alert kinds and tuning keys.
export const uiTextSchema = z.record(z.string().regex(/^[a-z][A-Za-z]*\.[A-Za-z_]+$/), z.string().min(1));

/** src/data/events/hooks.ts (DESIGN §2.10, §12 12.3): unique, namespaced keys with bounds around neutral. */
const bounds = range().optional();
export const hookRegistrySchema = z
  .array(
    z
      .strictObject({
        key: z.string().regex(/^[a-z]+\.[A-Za-z0-9.]+$/),
        ownerSection: z.number().int().min(1).max(14),
        neutral: num,
        unit: z.string().min(1),
        mulBounds: bounds,
        addBounds: bounds,
        setBounds: bounds,
      })
      .refine((h) => [h.setBounds].every((b) => b === undefined || (b[0] <= h.neutral && h.neutral <= b[1])), {
        message: 'setBounds must contain neutral',
      }),
  )
  .refine((hs) => new Set(hs.map((h) => h.key)).size === hs.length, { message: 'hook keys repeat' });

// --------------------------------------------------------------------------------------- §4 prospecting content

/** A §4.2.B draw block: §3's SampleMethodParams with the method's id and whether it reports sieved class masses. */
export const methodDraw = z
  .object({ ...sampleMethod.shape, id: z.enum(METHOD_IDS), reportsClassMasses: z.boolean() })
  .strict()
  .refine((d) => d.positionMode !== 'exposure' || d.exposureDepthFrac !== undefined, {
    message: 'an exposure method needs exposureDepthFrac',
  });

/** §4.2.A sample volume: fixed per unit, per ft of sampled column (drills), a choice (pits) or a range (bulk). */
const sampleBcyRule = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('fixed'), bcy: pos }),
  z.strictObject({ kind: z.literal('perFtOfColumn'), bcyPerFt: pos }),
  z
    .strictObject({ kind: z.literal('choices'), bcy: z.array(pos).min(1), defaultBcy: pos })
    .refine((r) => r.bcy.includes(r.defaultBcy), { message: 'the default must be one of the choices' }),
  z
    .strictObject({ kind: z.literal('range'), minBcy: pos, maxBcy: pos, defaultBcy: pos })
    .refine((r) => r.minBcy <= r.defaultBcy && r.defaultBcy <= r.maxBcy, { message: 'need min ≤ default ≤ max' }),
  z.strictObject({ kind: z.literal('none') }),
]);

const ownDelivery = z.strictObject({
  crew: z.record(z.string(), posInt),
  machineClasses: z.array(z.string().min(1)),
  unitsPerPersonDay: pos.optional(),
  unitsPerCrewDay: pos.optional(),
  consumablesUsdPerUnit: nonNeg,
  toolRentUsdPerDay: nonNeg.optional(),
});

const contractorTerms = z
  .strictObject({
    rateUsdPerUnit: nonNeg.optional(),
    rateUsdPerDay: nonNeg.optional(),
    unitsPerDay: pos,
    mobUsd: nonNeg,
    standbyUsdPerDay: nonNeg.optional(),
    minUnits: nonNeg.optional(),
    bouldersSlow: prob.optional(),
  })
  .refine((c) => (c.rateUsdPerUnit === undefined) !== (c.rateUsdPerDay === undefined), {
    message: 'a contractor charges per unit or per day, not both',
  });

/** One §4.2 method row (DESIGN §4.2.A logistics columns, §4.2.B measurement columns). */
export const methodRow = z
  .strictObject({
    id: z.enum(METHOD_IDS),
    family: z.enum(['surface', 'handPit', 'pit', 'trench', 'bulk', 'drill', 'geophysics', 'production']),
    unit: z.enum(['station', 'sample', 'pit', 'section', 'payBcy', 'ft', 'lineKm', 'cleanup']),
    activity: z.enum(['handSample', 'handSluice', 'mechSample', 'bulkSample', 'drill']).nullable(),
    draw: methodDraw.nullable(),
    depthLimit: z.enum(['row', 'machineReach']),
    sampleBcy: sampleBcyRule,
    reportsClassMasses: z.boolean(),
    informsSizeMix: z.boolean(),
    falseBedrockP: prob,
    requiresGeologist: z.boolean(),
    credited: z.boolean(),
    seasonMult: keyed(SEASON_PHASES, prob), // 0 = not allowed in the phase (§4.2.A)
    own: ownDelivery.optional(),
    contractor: contractorTerms.optional(),
    disturbanceAcPerUnit: nonNeg,
    backfilled: z.boolean(),
    resultLagWeeks: nonNegInt,
    labUsdPerPayInterval: nonNeg.optional(),
    labUsdPerBarrenInterval: nonNeg.optional(),
  })
  .superRefine((m, ctx) => {
    const bad = (message: string, path: string): void => {
      ctx.addIssue({ code: 'custom', message, path: [path] });
    };
    if (m.draw !== null && m.draw.id !== m.id) bad(`draw.id ${m.draw.id} is not the row id`, 'draw');
    if (m.draw !== null && m.draw.reportsClassMasses !== m.reportsClassMasses) bad('class-mass flags disagree', 'draw');
    // A drill's sample volume is its core per ft of column, the same number the draw uses (§4.2.B).
    if (m.sampleBcy.kind === 'perFtOfColumn' && m.draw?.bcyPerFt !== m.sampleBcy.bcyPerFt)
      bad('sampleBcy.bcyPerFt differs from draw.bcyPerFt', 'sampleBcy');
    // Pits and trenches dig to the machine's reach, so their row leaves maxDepthFt open (§4.2.B "reach").
    if (m.depthLimit === 'machineReach' && m.draw?.maxDepthFt !== null)
      bad('a reach-limited row sets maxDepthFt', 'draw');
    if (m.family === 'drill' && m.activity !== null && m.labUsdPerPayInterval === undefined)
      bad('a contract drill needs lab fees', 'labUsdPerPayInterval');
    if (m.draw === null && !['geophysics', 'production'].includes(m.family))
      bad('only geophysics and production rows have no draw', 'draw');
  });

export const prospectingMethodsSchema = z
  .record(z.enum(METHOD_IDS), methodRow)
  .refine((rows) => METHOD_IDS.every((id) => rows[id]?.id === id), {
    message: 'every MethodId has a row keyed by its own id',
  });

export const geophysicsDepthCvSchema = z
  .strictObject({ seismic: nonNeg, gprGood: nonNeg, gprPoor: nonNeg, gprGoodMaxDepthFt: pos, maxDepthFt: pos })
  .refine((g) => g.gprGood <= g.gprPoor && g.gprGoodMaxDepthFt <= g.maxDepthFt, {
    message: 'GPR in good conditions is no worse than in poor, within the tool depth',
  });

const consultantTier = z.strictObject({ usdPerDay: pos, skill: z.number().int().min(0).max(100) });

/** src/data/prospecting/engagements.ts (DESIGN §4.2.A lower rows, §4.13). */
export const prospectingEngagementsSchema = z.strictObject({
  recordsReview: z.strictObject({
    feesUsd: nonNeg,
    travelUsd: nonNeg,
    days: keyed(['owner', 'staffGeologist', 'consultantBilled'], posInt),
    resultLagWeeks: keyed(['own', 'consultant'], nonNegInt),
  }),
  consultantPER: z
    .strictObject({
      baseUsd: nonNeg,
      perSampledBlockUsd: nonNeg,
      capUsd: pos,
      minConsultantSiteDays: nonNegInt,
      resultLagWeeks: nonNegInt,
      notInBreakup: z.boolean(),
    })
    .refine((p) => p.baseUsd <= p.capUsd, { message: 'the base fee exceeds the cap' }),
  geologistReview: z.strictObject({ consultantUsd: nonNeg, ownDays: posInt, resultLagWeeks: nonNegInt }),
  consultantDays: z.strictObject({
    tiers: z
      .strictObject({ budget: consultantTier, standard: consultantTier, premier: consultantTier })
      .refine((t) => t.budget.skill < t.standard.skill && t.standard.skill < t.premier.skill, {
        message: 'tiers must rise in skill',
      }),
    expensesUsdPerDay: nonNeg,
    travelUsdPerTrip: keyed(ACCESS_CLASSES, nonNeg),
    engagedWeeks: posInt,
  }),
  staffGeologist: z.strictObject({ salaryUsdPerYear: pos }),
  technicalReport: z.strictObject({ usd: pos }),
});
