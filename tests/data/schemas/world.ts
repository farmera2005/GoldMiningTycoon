// §3 world content: enumerations, the sample-method row §3's drawSample consumes, region templates (§3.2), the bedrock,
// town and holder-name tables. Owned by the §3 package after P1 Wave 0.
import { z } from 'zod';
import {
  keyed,
  mixArray,
  mixOf,
  nonNeg,
  partialMixOf,
  pos,
  posInt,
  prob,
  range,
  sizeRecord,
  someOf,
} from './common';

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
/** §3.10.2 seller knowledge (world/enums.ts SellerKnowledge): what a holder can show. */
export const SELLER_KNOWLEDGE = ['operator', 'prospector', 'heirs', 'absentee'] as const;
export const CLIMATE_BANDS = ['subarctic', 'arid'] as const;
export const CLAIM_ACRES = ['20', '40', '80', '160'] as const;

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
