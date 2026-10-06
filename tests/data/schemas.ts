// zod schemas for every data file under src/data (CLAUDE.md "Content and tuning"; DESIGN §2.10, §2.14 "Data
// validation", D-2.7). TypeScript's `satisfies` checks shapes but not values: these add finiteness, ranges where
// DESIGN states them, mixes that sum to 1, complete enum keys and cross-references. They live with the tests because
// data/ may import only data/ and engine types (DESIGN §2.1), and zod is a test-time dependency.
import { z } from 'zod';

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
  // ---- market.* (§10 10.19)
  'market.openingSpotUsdPerFineOz': pos,
  'market.openingDieselRackUsdPerGal': pos,
  'market.preHistory.keepWeeks': nonNegInt,
  'market.cb.normal': nonNeg,
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
