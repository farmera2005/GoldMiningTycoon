// DESIGN §7 7.21 default values for every key the kernel reads, in src/data/tuning's flat dotted-key form. Used only by
// the kernel's tests until the §7 package adds these rows to src/data/tuning/ops.ts (that file is the live source; this
// table is a copy the kernel tests pin against DESIGN). Rows marked (delta) are shapes or values DESIGN does not state
// yet; they are reported as design deltas with the kernel.
import type { TuningValue } from '../../../../../data/tuning';
import { hashValue } from '../../../../core/hash';
import { readOpsKernelParams, type OpsKernelParams } from '../params';

export const OPS_DESIGN_TUNING: Readonly<Record<string, TuningValue>> = {
  // 7.3
  'ops.contactMeanFt': { tight: 0, standard: 0.5, generous: 1.0 },
  'ops.contactErrorSdFt': 0.6,
  'ops.contactSkillSlope': 0.6,
  'ops.wallDilutionFrac': 0.04,
  'ops.bedrockTakeFtMax': 5,
  'ops.miningLossBase': 0.03,
  'ops.miningLossSkillSlope': 0.6,
  'ops.miningLossBoulderAdd': 0.02,
  'ops.subBlockGradeSigma': 0.25,
  'ops.payExposureRampStart': 0.5,
  // 7.4
  'ops.thawK': { deepCold: 0, cold: 0, cool: 1.2, mild: 2.0, hot: 2.4 },
  'ops.thawSurfaceMult': { vegetated: 0.12, cleared: 0.45, stripped: 1.0 },
  'ops.thawMuckMult': 0.7,
  'ops.overwinterThawRetention': { vegetated: 0, cleared: 0.3, stripped: 0.8 },
  'ops.clearDozerHrPerAcre': 6,
  'ops.digMult': {
    gravelThawed: 1.0,
    gravelFrozen: 0.35,
    gravelRipped: 0.8,
    bedrockThawed: 0.6,
    bedrockFrozen: 0.45,
    bedrockRipped: 0.55,
  },
  'ops.stripFrozenMult': { dozerRipper: 0.3, dozerNoRipper: 0.08, excavator: 0.35 },
  'ops.excavatorStripCastMult': 0.75,
  'ops.cementationStripSlope': 0.5, // s07 #19
  'ops.boulderDigPenalty': 0.25,
  'ops.boulderPlantPenalty': 0.25,
  'ops.tailingsDigMult': 1.15,
  'ops.downValleySeqDigMult': 0.9,
  // 7.5, 7.12
  'ops.p1MechAvailability': 0.92,
  'ops.p3RoutineAvailability': 0.97,
  'ops.foremanEffMin': 0.85,
  'ops.foremanEffMax': 1.0,
  'ops.noForemanEfficiency': 0.92,
  'ops.plantHoursMultByBand': { deepCold: 1, cold: 1, cool: 0.8, mild: 1, hot: 1 },
  'ops.breakupWorkMult': 0.6,
  'ops.winterWorkMult': 0.8,
  'ops.freezeupPlantMult': 0.6, // s07 #18: the P1 flat value
  'ops.freezeupPlantMultByBand': { deepCold: 0, cold: 0.5, cool: 0.9, mild: 1, hot: 1 }, // P5 (delta: mild, hot)
  // 7.6.1
  'ops.dozerRefPushFt': 150,
  'ops.dozerPushExp': 0.9,
  'ops.basePushFt': 150,
  'ops.pushFtPerExtraCol': 100,
  'ops.dumpExtraPushFt': 50,
  // 7.6.3
  'ops.haulBaseFt': 300,
  'ops.blockSpacingFt': 209,
  'ops.truckLoadedFtPerMin': 704,
  'ops.truckEmptyFtPerMin': 1056,
  'ops.truckDumpMin': 1.2,
  'ops.truckSpotMin': 0.8,
  'ops.haulJobEff': 0.83,
  'ops.haulCycleMultByPrecip': { dry: 1, normal: 1, wet: 1.1, storm: 1.25 }, // P5
  'ops.loaderCarryRefFt': 300,
  // 7.6.4
  'ops.directFeedMaxRated': 75,
  'ops.directFeedDigMult': 0.6,
  'ops.directFeedShiftHours': 4,
  'ops.directFeedSetupBcy': 3000,
  'ops.padFreeBcy': 1500,
  'ops.rehandleTimeMult': 1.25,
  'ops.stockpileOverwinterFrozenFrac': 0.6,
  // 7.6.5, 7.6.8
  'ops.plantMaxOverfeed': 1.5,
  'ops.clayCapCut': { trommel: 0.45, shakerDeck: 0.35, grizzly: 0.25, dryWasher: 0.6 },
  'ops.tailingsHandlingHrPerKBcy': 3.0,
  'ops.plantMoveHoursBase': 4,
  'ops.plantMoveHoursPerRatedBcyHr': 0.16,
  // 7.6.6
  'ops.gpmPerBcyHr': 15,
  'ops.clayWaterAdd': 1.0,
  'ops.prepWaterMult': { trommel: 1.0, shakerDeck: 0.9, grizzly: 0.85, dryWasher: 0 },
  'ops.concentratorWaterAdd': 0.1,
  'ops.recycleExtraFlow': 0.4,
  'ops.recycleMax': 0.9,
  'ops.makeupFrac': { subarctic: 0.12, temperateMontane: 0.15, arid: 0.15 }, // (delta: keyed by §3 ClimateBand)
  'ops.plantTdhFt': 100,
  'ops.pumpStageHeadFt': 100,
  'ops.leanWaterFloor': 0.5,
  'ops.waterTruckGal': 4000,
  'ops.waterTruckFillHr': 0.5,
  'ops.waterTruckMph': 25,
  'ops.waterTruckDayRateUsd': 1400,
  'ops.wellBaseUsd': 15000,
  'ops.wellUsdPerFt': 60,
  'ops.wellWeeks': 2,
  'ops.secondWellYieldMult': 0.7,
  'ops.wellPumpGalPerHr': 1.5,
  // 7.9
  'ops.baseCapture': {
    sluice: { coarse: 0.95, medium: 0.88, fine: 0.62, ultrafine: 0.25 },
    jig: { coarse: 0.96, medium: 0.92, fine: 0.85, ultrafine: 0.55 },
    centrifuge: { coarse: 0.96, medium: 0.92, fine: 0.9, ultrafine: 0.7 },
    dryWasher: { coarse: 0.85, medium: 0.65, fine: 0.35, ultrafine: 0.1 },
  },
  'ops.overfeedExp': { coarse: 0.5, medium: 1.5, fine: 2.6, ultrafine: 2.6 },
  'ops.underfeedBenefitFactor': 0.3,
  'ops.underfeedPhiFloor': 0.6,
  'ops.leanWaterExp': { coarse: 0.3, medium: 1.0, fine: 1.6, ultrafine: 1.6 },
  'ops.excessWaterExp': { coarse: 0, medium: 0.2, fine: 0.6, ultrafine: 0.8 },
  'ops.coldWaterExp': { deepCold: 1.12, cold: 1.12, cool: 1.05, mild: 1, hot: 1 }, // (delta: deepCold)
  'ops.prepFineLossExp': { trommel: 1, shakerDeck: 1, grizzly: 1.25, dryWasher: 1 },
  'ops.clayLossMax': 0.2,
  'ops.clayScrubFactor': { trommel: 0.3, shakerDeck: 0.7, grizzly: 1.0, dryWasher: 1.0, scrubber: 0.1 }, // (delta: dryWasher)
  'ops.riffleLoadHoursRef': 100,
  'ops.riffleLoadGradeRef': 0.02,
  'ops.riffleLoadExpPer25h': 0.1,
  'ops.riffleLoadExpMax': 1.6,
  'ops.riffleWearExp': 0.6,
  'ops.oversizeCoarseLoss': 0.01,
  'ops.oversizeCoarseLossTrap': 0.002,
  'ops.untrainedPlantSkill': 20,
  'ops.rerunHardnessExp': 1.5,
  // 7.10
  'ops.cleanupHoursBase': 4,
  'ops.cleanupHoursPerRatedBcyHr': 0.04,
  'ops.cleanupCrewSize': 2,
  'ops.maxBoxWeeks': 8,
  'ops.goldRoomLoss': {
    noTable: { coarse: 0.002, medium: 0.005, fine: 0.03, ultrafine: 0.1 },
    table: { coarse: 0.001, medium: 0.002, fine: 0.01, ultrafine: 0.04 },
  },
  'ops.goldRoomDirtFrac.noTable': 0.04,
  'ops.goldRoomDirtFrac.table': 0.02,
  'ops.skimBase': 0.25,
  'ops.skimFrac': 0.04,
  'ops.ownerPresentSecurity': 0.15,
  'ops.siteSecurityCap': 0.9,
  // 7.14
  'ops.tailingsAuditCvMax': 0.5,
  'ops.tailingsAuditCvMin': 0.15,
  // 7.11, 7.12
  'ops.idleEngineRunShare': 0.6,
  'ops.idleLoadFactor': 0.3,
  // (delta) 7.11's prose task load factors as a key; §9 9.7.3 quotes the same values
  'ops.taskLoadFactor': {
    strip: 1.0,
    dig: 1.0,
    ripping: 1.15,
    haul: 1.0,
    feed: 0.85,
    plant: 1.0,
    support: 1.0,
    reclaim: 1.0,
  },
  'ops.nightLightGalPerHr': 2.0,
  'ops.nightLightFreeWeeksNorth': [22, 30], // s07 #18
  'ops.consumablesUsdPerBcyWashed': 0.4,
  'ops.getUsdPerBcyDug': 0.05,
  'ops.getUsdPerBcyStripped': 0.03,
  'ops.getFrozenMult': 2.0,
  'ops.campUsdPerPersonDay': 55,
  'ops.campTierMult': { basic: 0.8, standard: 1.0, good: 1.25, premium: 1.5 },
  'ops.campFuelGalPerPersonDay': 3.5,
  'ops.winterCampMult': 1.4,
  'ops.siteFixedUsdPerWeek': 750,
  'ops.revegUsdPerAcre': 600,
  'ops.siteMobBaseUsd': 12000,
  'ops.siteDemobShare': 0.6,
  'ops.siteMobWeeks': { highway: 1, seasonalRoad: 1, winterTrail: 2, flyIn: 2 },
  'ops.startupCrewHours': 120,
  'ops.winterizeCrewHours': 80,
  'ops.winterizeUsd': 3000,
};

/** The kernel parameters at DESIGN's defaults. */
export const DESIGN_PARAMS: OpsKernelParams = readOpsKernelParams((k) => OPS_DESIGN_TUNING[k]);

/** DESIGN defaults with some fields replaced (fixtures that isolate one term). */
export function designParamsWith(over: Partial<Omit<OpsKernelParams, 'key'>>): OpsKernelParams {
  const { key: _key, ...body } = DESIGN_PARAMS;
  const merged = { ...body, ...over };
  return { key: hashValue(merged), ...merged };
}
