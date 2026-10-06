// The §7 kernel's resolved parameters (DESIGN §7 7.21). Every number a kernel formula reads comes from here, and every
// field is read from one `ops.*` tuning key, so retuning never touches the formulas (CLAUDE.md rule 4). The reader takes a
// key lookup rather than `TuningResolved` keys so the kernel compiles before the §7 rows land in src/data/tuning/ops.ts;
// a wrong or missing key is a data bug and throws. Key shapes for tabled rows (DESIGN 7.21 "a / b / c" rows) are the
// nested readonly objects listed in OPS_KERNEL_TUNING_KEYS.
import type { TuningResolved, TuningValue } from '../../../../data/tuning';
import { invariant } from '../../../core/assert';
import { hashValue } from '../../../core/hash';
import { createWeakMemo } from '../../../core/memo';
import { SIZE_CLASSES } from '../../world/enums';
import {
  ACCESS_CLASSES_K,
  CAMP_TIERS,
  CAPTURE_DEVICES,
  CLIMATE_BANDS_K,
  PAY_TOP_POLICIES,
  PRECIP_BANDS,
  PREPS,
  TEMP_BANDS,
  THAW_SURFACES,
  type AccessClass,
  type CampTier,
  type CaptureDevice,
  type ClimateBandK,
  type PayTopPolicy,
  type PrecipBand,
  type Prep,
  type SizeRecord,
  type TempBand,
  type ThawSurface,
} from './types';

/** Load-factor tasks of 7.11 (§9 `fuelBurnGalHr` reads them). */
export type LoadTask = 'strip' | 'dig' | 'ripping' | 'haul' | 'feed' | 'plant' | 'support' | 'reclaim';
export const LOAD_TASKS: readonly LoadTask[] = [
  'strip',
  'dig',
  'ripping',
  'haul',
  'feed',
  'plant',
  'support',
  'reclaim',
];

/** 7.4 dig multipliers by material class (gravel / bedrock × thawed / frozen / ripped). */
export interface DigMultTable {
  gravelThawed: number;
  gravelFrozen: number;
  gravelRipped: number;
  bedrockThawed: number;
  bedrockFrozen: number;
  bedrockRipped: number;
}
const DIG_MULT_FIELDS = [
  'gravelThawed',
  'gravelFrozen',
  'gravelRipped',
  'bedrockThawed',
  'bedrockFrozen',
  'bedrockRipped',
] as const;

/** 7.4 frozen-overburden multipliers by strip machine. */
export interface StripFrozenTable {
  dozerRipper: number;
  dozerNoRipper: number;
  excavator: number;
}
const STRIP_FROZEN_FIELDS = ['dozerRipper', 'dozerNoRipper', 'excavator'] as const;

/** 7.9 clay scrubbing factor by prep, plus the scrubber option. */
export type ClayScrubTable = Record<Prep | 'scrubber', number>;

export interface OpsKernelParams {
  /** Content hash of every field below (memo keys of callers that cache kernel results). */
  readonly key: string;
  // ---- 7.3 cuts, blocks and the pay column
  readonly contactMeanFt: Readonly<Record<PayTopPolicy, number>>;
  readonly contactErrorSdFt: number;
  readonly contactSkillSlope: number;
  readonly wallDilutionFrac: number;
  readonly bedrockTakeFtMax: number;
  readonly miningLossBase: number;
  readonly miningLossSkillSlope: number;
  readonly miningLossBoulderAdd: number;
  readonly subBlockGradeSigma: number;
  readonly payExposureRampStart: number;
  // ---- 7.4 ground
  readonly thawK: Readonly<Record<TempBand, number>>;
  readonly thawSurfaceMult: Readonly<Record<ThawSurface, number>>;
  readonly thawMuckMult: number;
  readonly overwinterThawRetention: Readonly<Record<ThawSurface, number>>;
  readonly clearDozerHrPerAcre: number;
  readonly digMult: Readonly<DigMultTable>;
  readonly stripFrozenMult: Readonly<StripFrozenTable>;
  readonly excavatorStripCastMult: number;
  readonly cementationStripSlope: number;
  readonly boulderDigPenalty: number;
  readonly boulderPlantPenalty: number;
  readonly tailingsDigMult: number;
  readonly downValleySeqDigMult: number;
  // ---- 7.5 usable hours and 7.12 season factors
  readonly p1MechAvailability: number;
  readonly p3RoutineAvailability: number;
  readonly foremanEffMin: number;
  readonly foremanEffMax: number;
  readonly noForemanEfficiency: number;
  readonly plantHoursMultByBand: Readonly<Record<TempBand, number>>;
  readonly breakupWorkMult: number;
  readonly winterWorkMult: number;
  readonly freezeupPlantMult: number;
  readonly freezeupPlantMultByBand: Readonly<Record<TempBand, number>>;
  // ---- 7.6.1 strip
  readonly dozerRefPushFt: number;
  readonly dozerPushExp: number;
  readonly basePushFt: number;
  readonly pushFtPerExtraCol: number;
  readonly dumpExtraPushFt: number;
  // ---- 7.6.3 haul
  readonly haulBaseFt: number;
  readonly blockSpacingFt: number;
  readonly truckLoadedFtPerMin: number;
  readonly truckEmptyFtPerMin: number;
  readonly truckDumpMin: number;
  readonly truckSpotMin: number;
  readonly haulJobEff: number;
  readonly haulCycleMultByPrecip: Readonly<Record<PrecipBand, number>>;
  readonly loaderCarryRefFt: number;
  // ---- 7.6.4 feed
  readonly directFeedMaxRated: number;
  readonly directFeedDigMult: number;
  readonly directFeedShiftHours: number;
  readonly directFeedSetupBcy: number;
  readonly padFreeBcy: number;
  readonly rehandleTimeMult: number;
  readonly stockpileOverwinterFrozenFrac: number;
  // ---- 7.6.5 plant and 7.6.8 tailings handling
  readonly plantMaxOverfeed: number;
  readonly clayCapCut: Readonly<Record<Prep, number>>;
  readonly tailingsHandlingHrPerKBcy: number;
  readonly plantMoveHoursBase: number;
  readonly plantMoveHoursPerRatedBcyHr: number;
  // ---- 7.6.6 water
  readonly gpmPerBcyHr: number;
  readonly clayWaterAdd: number;
  readonly prepWaterMult: Readonly<Record<Prep, number>>;
  readonly concentratorWaterAdd: number;
  readonly recycleExtraFlow: number;
  readonly recycleMax: number;
  readonly makeupFrac: Readonly<Record<ClimateBandK, number>>;
  readonly plantTdhFt: number;
  readonly pumpStageHeadFt: number;
  readonly leanWaterFloor: number;
  readonly waterTruckGal: number;
  readonly waterTruckFillHr: number;
  readonly waterTruckMph: number;
  readonly waterTruckDayRateUsd: number;
  readonly wellBaseUsd: number;
  readonly wellUsdPerFt: number;
  readonly wellWeeks: number;
  readonly secondWellYieldMult: number;
  readonly wellPumpGalPerHr: number;
  // ---- 7.9 recovery
  readonly baseCapture: Readonly<Record<CaptureDevice, Readonly<SizeRecord>>>;
  readonly overfeedExp: Readonly<SizeRecord>;
  readonly underfeedBenefitFactor: number;
  readonly underfeedPhiFloor: number;
  readonly leanWaterExp: Readonly<SizeRecord>;
  readonly excessWaterExp: Readonly<SizeRecord>;
  readonly coldWaterExp: Readonly<Record<TempBand, number>>;
  readonly prepFineLossExp: Readonly<Record<Prep, number>>;
  readonly clayLossMax: number;
  readonly clayScrubFactor: Readonly<ClayScrubTable>;
  readonly riffleLoadHoursRef: number;
  readonly riffleLoadGradeRef: number;
  readonly riffleLoadExpPer25h: number;
  readonly riffleLoadExpMax: number;
  readonly riffleWearExp: number;
  readonly oversizeCoarseLoss: number;
  readonly oversizeCoarseLossTrap: number;
  readonly untrainedPlantSkill: number;
  readonly rerunHardnessExp: number;
  // ---- 7.10 cleanup and the gold room
  readonly cleanupHoursBase: number;
  readonly cleanupHoursPerRatedBcyHr: number;
  readonly cleanupCrewSize: number;
  readonly maxBoxWeeks: number;
  readonly goldRoomLoss: Readonly<{ noTable: Readonly<SizeRecord>; table: Readonly<SizeRecord> }>;
  readonly goldRoomDirtFracNoTable: number;
  readonly goldRoomDirtFracTable: number;
  readonly skimBase: number;
  readonly skimFrac: number;
  readonly ownerPresentSecurity: number;
  readonly siteSecurityCap: number;
  // ---- 7.14 tailings audit
  readonly tailingsAuditCvMax: number;
  readonly tailingsAuditCvMin: number;
  // ---- 7.11 operating costs and 7.12 site tasks
  readonly idleEngineRunShare: number;
  readonly idleLoadFactor: number;
  readonly taskLoadFactor: Readonly<Record<LoadTask, number>>;
  readonly nightLightGalPerHr: number;
  readonly nightLightFreeWeeksNorth: readonly [number, number];
  readonly consumablesUsdPerBcyWashed: number;
  readonly getUsdPerBcyDug: number;
  readonly getUsdPerBcyStripped: number;
  readonly getFrozenMult: number;
  readonly campUsdPerPersonDay: number;
  readonly campTierMult: Readonly<Record<CampTier, number>>;
  readonly campFuelGalPerPersonDay: number;
  readonly winterCampMult: number;
  readonly siteFixedUsdPerWeek: number;
  readonly revegUsdPerAcre: number;
  readonly siteMobBaseUsd: number;
  readonly siteDemobShare: number;
  readonly siteMobWeeks: Readonly<Record<AccessClass, number>>;
  readonly startupCrewHours: number;
  readonly winterizeCrewHours: number;
  readonly winterizeUsd: number;
}

/**
 * Every `ops.*` key the kernel reads, with its DESIGN 7.21 shape: 'num' a finite number; a string[] a table with
 * exactly those fields (numbers, or size records for 'sizes:' fields); 'pair' a [lo, hi] array.
 */
export const OPS_KERNEL_TUNING_KEYS = {
  'ops.contactMeanFt': PAY_TOP_POLICIES,
  'ops.contactErrorSdFt': 'num',
  'ops.contactSkillSlope': 'num',
  'ops.wallDilutionFrac': 'num',
  'ops.bedrockTakeFtMax': 'num',
  'ops.miningLossBase': 'num',
  'ops.miningLossSkillSlope': 'num',
  'ops.miningLossBoulderAdd': 'num',
  'ops.subBlockGradeSigma': 'num',
  'ops.payExposureRampStart': 'num',
  'ops.thawK': TEMP_BANDS,
  'ops.thawSurfaceMult': THAW_SURFACES,
  'ops.thawMuckMult': 'num',
  'ops.overwinterThawRetention': THAW_SURFACES,
  'ops.clearDozerHrPerAcre': 'num',
  'ops.digMult': DIG_MULT_FIELDS,
  'ops.stripFrozenMult': STRIP_FROZEN_FIELDS,
  'ops.excavatorStripCastMult': 'num',
  'ops.cementationStripSlope': 'num',
  'ops.boulderDigPenalty': 'num',
  'ops.boulderPlantPenalty': 'num',
  'ops.tailingsDigMult': 'num',
  'ops.downValleySeqDigMult': 'num',
  'ops.p1MechAvailability': 'num',
  'ops.p3RoutineAvailability': 'num',
  'ops.foremanEffMin': 'num',
  'ops.foremanEffMax': 'num',
  'ops.noForemanEfficiency': 'num',
  'ops.plantHoursMultByBand': TEMP_BANDS,
  'ops.breakupWorkMult': 'num',
  'ops.winterWorkMult': 'num',
  'ops.freezeupPlantMult': 'num',
  'ops.freezeupPlantMultByBand': TEMP_BANDS,
  'ops.dozerRefPushFt': 'num',
  'ops.dozerPushExp': 'num',
  'ops.basePushFt': 'num',
  'ops.pushFtPerExtraCol': 'num',
  'ops.dumpExtraPushFt': 'num',
  'ops.haulBaseFt': 'num',
  'ops.blockSpacingFt': 'num',
  'ops.truckLoadedFtPerMin': 'num',
  'ops.truckEmptyFtPerMin': 'num',
  'ops.truckDumpMin': 'num',
  'ops.truckSpotMin': 'num',
  'ops.haulJobEff': 'num',
  'ops.haulCycleMultByPrecip': PRECIP_BANDS,
  'ops.loaderCarryRefFt': 'num',
  'ops.directFeedMaxRated': 'num',
  'ops.directFeedDigMult': 'num',
  'ops.directFeedShiftHours': 'num',
  'ops.directFeedSetupBcy': 'num',
  'ops.padFreeBcy': 'num',
  'ops.rehandleTimeMult': 'num',
  'ops.stockpileOverwinterFrozenFrac': 'num',
  'ops.plantMaxOverfeed': 'num',
  'ops.clayCapCut': PREPS,
  'ops.tailingsHandlingHrPerKBcy': 'num',
  'ops.plantMoveHoursBase': 'num',
  'ops.plantMoveHoursPerRatedBcyHr': 'num',
  'ops.gpmPerBcyHr': 'num',
  'ops.clayWaterAdd': 'num',
  'ops.prepWaterMult': PREPS,
  'ops.concentratorWaterAdd': 'num',
  'ops.recycleExtraFlow': 'num',
  'ops.recycleMax': 'num',
  'ops.makeupFrac': CLIMATE_BANDS_K,
  'ops.plantTdhFt': 'num',
  'ops.pumpStageHeadFt': 'num',
  'ops.leanWaterFloor': 'num',
  'ops.waterTruckGal': 'num',
  'ops.waterTruckFillHr': 'num',
  'ops.waterTruckMph': 'num',
  'ops.waterTruckDayRateUsd': 'num',
  'ops.wellBaseUsd': 'num',
  'ops.wellUsdPerFt': 'num',
  'ops.wellWeeks': 'num',
  'ops.secondWellYieldMult': 'num',
  'ops.wellPumpGalPerHr': 'num',
  'ops.baseCapture': CAPTURE_DEVICES.map((d) => `sizes:${d}`),
  'ops.overfeedExp': SIZE_CLASSES,
  'ops.underfeedBenefitFactor': 'num',
  'ops.underfeedPhiFloor': 'num',
  'ops.leanWaterExp': SIZE_CLASSES,
  'ops.excessWaterExp': SIZE_CLASSES,
  'ops.coldWaterExp': TEMP_BANDS,
  'ops.prepFineLossExp': PREPS,
  'ops.clayLossMax': 'num',
  'ops.clayScrubFactor': [...PREPS, 'scrubber'],
  'ops.riffleLoadHoursRef': 'num',
  'ops.riffleLoadGradeRef': 'num',
  'ops.riffleLoadExpPer25h': 'num',
  'ops.riffleLoadExpMax': 'num',
  'ops.riffleWearExp': 'num',
  'ops.oversizeCoarseLoss': 'num',
  'ops.oversizeCoarseLossTrap': 'num',
  'ops.untrainedPlantSkill': 'num',
  'ops.rerunHardnessExp': 'num',
  'ops.cleanupHoursBase': 'num',
  'ops.cleanupHoursPerRatedBcyHr': 'num',
  'ops.cleanupCrewSize': 'num',
  'ops.maxBoxWeeks': 'num',
  'ops.goldRoomLoss': ['sizes:noTable', 'sizes:table'],
  'ops.goldRoomDirtFrac.noTable': 'num',
  'ops.goldRoomDirtFrac.table': 'num',
  'ops.skimBase': 'num',
  'ops.skimFrac': 'num',
  'ops.ownerPresentSecurity': 'num',
  'ops.siteSecurityCap': 'num',
  'ops.tailingsAuditCvMax': 'num',
  'ops.tailingsAuditCvMin': 'num',
  'ops.idleEngineRunShare': 'num',
  'ops.idleLoadFactor': 'num',
  'ops.taskLoadFactor': LOAD_TASKS,
  'ops.nightLightGalPerHr': 'num',
  'ops.nightLightFreeWeeksNorth': 'pair',
  'ops.consumablesUsdPerBcyWashed': 'num',
  'ops.getUsdPerBcyDug': 'num',
  'ops.getUsdPerBcyStripped': 'num',
  'ops.getFrozenMult': 'num',
  'ops.campUsdPerPersonDay': 'num',
  'ops.campTierMult': CAMP_TIERS,
  'ops.campFuelGalPerPersonDay': 'num',
  'ops.winterCampMult': 'num',
  'ops.siteFixedUsdPerWeek': 'num',
  'ops.revegUsdPerAcre': 'num',
  'ops.siteMobBaseUsd': 'num',
  'ops.siteDemobShare': 'num',
  'ops.siteMobWeeks': ACCESS_CLASSES_K,
  'ops.startupCrewHours': 'num',
  'ops.winterizeCrewHours': 'num',
  'ops.winterizeUsd': 'num',
} as const satisfies Record<string, 'num' | 'pair' | readonly string[]>;

export type OpsKernelTuningKey = keyof typeof OPS_KERNEL_TUNING_KEYS;

/** Looks up one tuning value by its dotted key (undefined when the key does not exist). */
export type TuningLookup = (key: string) => TuningValue | undefined;

type Obj = { readonly [k: string]: TuningValue };

function isObj(v: TuningValue | undefined): v is Obj {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function finite(v: TuningValue | undefined, what: string): number {
  invariant(typeof v === 'number' && Number.isFinite(v), () => `${what} must be a finite number`);
  return v;
}

function makeReader(get: TuningLookup) {
  const num = (key: OpsKernelTuningKey): number => finite(get(key), `tuning ${key}`);
  const tableOf = <K extends string>(key: OpsKernelTuningKey, fields: readonly K[]): Record<K, number> => {
    const v = get(key);
    invariant(isObj(v), () => `tuning ${key} must be a table`);
    const out = {} as Record<K, number>;
    for (const f of fields) out[f] = finite(v[f], `tuning ${key}.${f}`);
    return out;
  };
  const sizesOf = (v: TuningValue | undefined, what: string): SizeRecord => {
    invariant(isObj(v), () => `${what} must be a size table`);
    return {
      coarse: finite(v['coarse'], `${what}.coarse`),
      medium: finite(v['medium'], `${what}.medium`),
      fine: finite(v['fine'], `${what}.fine`),
      ultrafine: finite(v['ultrafine'], `${what}.ultrafine`),
    };
  };
  const sizes = (key: OpsKernelTuningKey): SizeRecord => sizesOf(get(key), `tuning ${key}`);
  const nestedSizes = <K extends string>(key: OpsKernelTuningKey, fields: readonly K[]): Record<K, SizeRecord> => {
    const v = get(key);
    invariant(isObj(v), () => `tuning ${key} must be a table`);
    const out = {} as Record<K, SizeRecord>;
    for (const f of fields) out[f] = sizesOf(v[f], `tuning ${key}.${f}`);
    return out;
  };
  const pair = (key: OpsKernelTuningKey): readonly [number, number] => {
    const v = get(key);
    invariant(Array.isArray(v) && v.length === 2, () => `tuning ${key} must be a [lo, hi] pair`);
    return [finite(v[0], `tuning ${key}[0]`), finite(v[1], `tuning ${key}[1]`)];
  };
  return { num, tableOf, sizes, nestedSizes, pair };
}

/** Reads every kernel parameter (throws on a missing or malformed key). */
export function readOpsKernelParams(get: TuningLookup): OpsKernelParams {
  const r = makeReader(get);
  const body: Omit<OpsKernelParams, 'key'> = {
    contactMeanFt: r.tableOf('ops.contactMeanFt', PAY_TOP_POLICIES),
    contactErrorSdFt: r.num('ops.contactErrorSdFt'),
    contactSkillSlope: r.num('ops.contactSkillSlope'),
    wallDilutionFrac: r.num('ops.wallDilutionFrac'),
    bedrockTakeFtMax: r.num('ops.bedrockTakeFtMax'),
    miningLossBase: r.num('ops.miningLossBase'),
    miningLossSkillSlope: r.num('ops.miningLossSkillSlope'),
    miningLossBoulderAdd: r.num('ops.miningLossBoulderAdd'),
    subBlockGradeSigma: r.num('ops.subBlockGradeSigma'),
    payExposureRampStart: r.num('ops.payExposureRampStart'),
    thawK: r.tableOf('ops.thawK', TEMP_BANDS),
    thawSurfaceMult: r.tableOf('ops.thawSurfaceMult', THAW_SURFACES),
    thawMuckMult: r.num('ops.thawMuckMult'),
    overwinterThawRetention: r.tableOf('ops.overwinterThawRetention', THAW_SURFACES),
    clearDozerHrPerAcre: r.num('ops.clearDozerHrPerAcre'),
    digMult: r.tableOf('ops.digMult', DIG_MULT_FIELDS),
    stripFrozenMult: r.tableOf('ops.stripFrozenMult', STRIP_FROZEN_FIELDS),
    excavatorStripCastMult: r.num('ops.excavatorStripCastMult'),
    cementationStripSlope: r.num('ops.cementationStripSlope'),
    boulderDigPenalty: r.num('ops.boulderDigPenalty'),
    boulderPlantPenalty: r.num('ops.boulderPlantPenalty'),
    tailingsDigMult: r.num('ops.tailingsDigMult'),
    downValleySeqDigMult: r.num('ops.downValleySeqDigMult'),
    p1MechAvailability: r.num('ops.p1MechAvailability'),
    p3RoutineAvailability: r.num('ops.p3RoutineAvailability'),
    foremanEffMin: r.num('ops.foremanEffMin'),
    foremanEffMax: r.num('ops.foremanEffMax'),
    noForemanEfficiency: r.num('ops.noForemanEfficiency'),
    plantHoursMultByBand: r.tableOf('ops.plantHoursMultByBand', TEMP_BANDS),
    breakupWorkMult: r.num('ops.breakupWorkMult'),
    winterWorkMult: r.num('ops.winterWorkMult'),
    freezeupPlantMult: r.num('ops.freezeupPlantMult'),
    freezeupPlantMultByBand: r.tableOf('ops.freezeupPlantMultByBand', TEMP_BANDS),
    dozerRefPushFt: r.num('ops.dozerRefPushFt'),
    dozerPushExp: r.num('ops.dozerPushExp'),
    basePushFt: r.num('ops.basePushFt'),
    pushFtPerExtraCol: r.num('ops.pushFtPerExtraCol'),
    dumpExtraPushFt: r.num('ops.dumpExtraPushFt'),
    haulBaseFt: r.num('ops.haulBaseFt'),
    blockSpacingFt: r.num('ops.blockSpacingFt'),
    truckLoadedFtPerMin: r.num('ops.truckLoadedFtPerMin'),
    truckEmptyFtPerMin: r.num('ops.truckEmptyFtPerMin'),
    truckDumpMin: r.num('ops.truckDumpMin'),
    truckSpotMin: r.num('ops.truckSpotMin'),
    haulJobEff: r.num('ops.haulJobEff'),
    haulCycleMultByPrecip: r.tableOf('ops.haulCycleMultByPrecip', PRECIP_BANDS),
    loaderCarryRefFt: r.num('ops.loaderCarryRefFt'),
    directFeedMaxRated: r.num('ops.directFeedMaxRated'),
    directFeedDigMult: r.num('ops.directFeedDigMult'),
    directFeedShiftHours: r.num('ops.directFeedShiftHours'),
    directFeedSetupBcy: r.num('ops.directFeedSetupBcy'),
    padFreeBcy: r.num('ops.padFreeBcy'),
    rehandleTimeMult: r.num('ops.rehandleTimeMult'),
    stockpileOverwinterFrozenFrac: r.num('ops.stockpileOverwinterFrozenFrac'),
    plantMaxOverfeed: r.num('ops.plantMaxOverfeed'),
    clayCapCut: r.tableOf('ops.clayCapCut', PREPS),
    tailingsHandlingHrPerKBcy: r.num('ops.tailingsHandlingHrPerKBcy'),
    plantMoveHoursBase: r.num('ops.plantMoveHoursBase'),
    plantMoveHoursPerRatedBcyHr: r.num('ops.plantMoveHoursPerRatedBcyHr'),
    gpmPerBcyHr: r.num('ops.gpmPerBcyHr'),
    clayWaterAdd: r.num('ops.clayWaterAdd'),
    prepWaterMult: r.tableOf('ops.prepWaterMult', PREPS),
    concentratorWaterAdd: r.num('ops.concentratorWaterAdd'),
    recycleExtraFlow: r.num('ops.recycleExtraFlow'),
    recycleMax: r.num('ops.recycleMax'),
    makeupFrac: r.tableOf('ops.makeupFrac', CLIMATE_BANDS_K),
    plantTdhFt: r.num('ops.plantTdhFt'),
    pumpStageHeadFt: r.num('ops.pumpStageHeadFt'),
    leanWaterFloor: r.num('ops.leanWaterFloor'),
    waterTruckGal: r.num('ops.waterTruckGal'),
    waterTruckFillHr: r.num('ops.waterTruckFillHr'),
    waterTruckMph: r.num('ops.waterTruckMph'),
    waterTruckDayRateUsd: r.num('ops.waterTruckDayRateUsd'),
    wellBaseUsd: r.num('ops.wellBaseUsd'),
    wellUsdPerFt: r.num('ops.wellUsdPerFt'),
    wellWeeks: r.num('ops.wellWeeks'),
    secondWellYieldMult: r.num('ops.secondWellYieldMult'),
    wellPumpGalPerHr: r.num('ops.wellPumpGalPerHr'),
    baseCapture: r.nestedSizes('ops.baseCapture', CAPTURE_DEVICES),
    overfeedExp: r.sizes('ops.overfeedExp'),
    underfeedBenefitFactor: r.num('ops.underfeedBenefitFactor'),
    underfeedPhiFloor: r.num('ops.underfeedPhiFloor'),
    leanWaterExp: r.sizes('ops.leanWaterExp'),
    excessWaterExp: r.sizes('ops.excessWaterExp'),
    coldWaterExp: r.tableOf('ops.coldWaterExp', TEMP_BANDS),
    prepFineLossExp: r.tableOf('ops.prepFineLossExp', PREPS),
    clayLossMax: r.num('ops.clayLossMax'),
    clayScrubFactor: r.tableOf('ops.clayScrubFactor', [...PREPS, 'scrubber'] as const),
    riffleLoadHoursRef: r.num('ops.riffleLoadHoursRef'),
    riffleLoadGradeRef: r.num('ops.riffleLoadGradeRef'),
    riffleLoadExpPer25h: r.num('ops.riffleLoadExpPer25h'),
    riffleLoadExpMax: r.num('ops.riffleLoadExpMax'),
    riffleWearExp: r.num('ops.riffleWearExp'),
    oversizeCoarseLoss: r.num('ops.oversizeCoarseLoss'),
    oversizeCoarseLossTrap: r.num('ops.oversizeCoarseLossTrap'),
    untrainedPlantSkill: r.num('ops.untrainedPlantSkill'),
    rerunHardnessExp: r.num('ops.rerunHardnessExp'),
    cleanupHoursBase: r.num('ops.cleanupHoursBase'),
    cleanupHoursPerRatedBcyHr: r.num('ops.cleanupHoursPerRatedBcyHr'),
    cleanupCrewSize: r.num('ops.cleanupCrewSize'),
    maxBoxWeeks: r.num('ops.maxBoxWeeks'),
    goldRoomLoss: r.nestedSizes('ops.goldRoomLoss', ['noTable', 'table'] as const),
    goldRoomDirtFracNoTable: r.num('ops.goldRoomDirtFrac.noTable'),
    goldRoomDirtFracTable: r.num('ops.goldRoomDirtFrac.table'),
    skimBase: r.num('ops.skimBase'),
    skimFrac: r.num('ops.skimFrac'),
    ownerPresentSecurity: r.num('ops.ownerPresentSecurity'),
    siteSecurityCap: r.num('ops.siteSecurityCap'),
    tailingsAuditCvMax: r.num('ops.tailingsAuditCvMax'),
    tailingsAuditCvMin: r.num('ops.tailingsAuditCvMin'),
    idleEngineRunShare: r.num('ops.idleEngineRunShare'),
    idleLoadFactor: r.num('ops.idleLoadFactor'),
    taskLoadFactor: r.tableOf('ops.taskLoadFactor', LOAD_TASKS),
    nightLightGalPerHr: r.num('ops.nightLightGalPerHr'),
    nightLightFreeWeeksNorth: r.pair('ops.nightLightFreeWeeksNorth'),
    consumablesUsdPerBcyWashed: r.num('ops.consumablesUsdPerBcyWashed'),
    getUsdPerBcyDug: r.num('ops.getUsdPerBcyDug'),
    getUsdPerBcyStripped: r.num('ops.getUsdPerBcyStripped'),
    getFrozenMult: r.num('ops.getFrozenMult'),
    campUsdPerPersonDay: r.num('ops.campUsdPerPersonDay'),
    campTierMult: r.tableOf('ops.campTierMult', CAMP_TIERS),
    campFuelGalPerPersonDay: r.num('ops.campFuelGalPerPersonDay'),
    winterCampMult: r.num('ops.winterCampMult'),
    siteFixedUsdPerWeek: r.num('ops.siteFixedUsdPerWeek'),
    revegUsdPerAcre: r.num('ops.revegUsdPerAcre'),
    siteMobBaseUsd: r.num('ops.siteMobBaseUsd'),
    siteDemobShare: r.num('ops.siteDemobShare'),
    siteMobWeeks: r.tableOf('ops.siteMobWeeks', ACCESS_CLASSES_K),
    startupCrewHours: r.num('ops.startupCrewHours'),
    winterizeCrewHours: r.num('ops.winterizeCrewHours'),
    winterizeUsd: r.num('ops.winterizeUsd'),
  };
  return { key: hashValue(body), ...body };
}

const paramsMemo = createWeakMemo<TuningResolved, OpsKernelParams>('ops.kernelParams');

/**
 * The kernel parameters of a game's resolved tuning (`state.meta.tuning`), cached per tuning object (§2.3 item 6: a
 * cold cache recomputes the same value).
 */
export function opsKernelParams(tuning: TuningResolved): OpsKernelParams {
  return paramsMemo.getOrCompute(tuning, () =>
    readOpsKernelParams((key) => (tuning as unknown as Readonly<Record<string, TuningValue>>)[key]),
  );
}
