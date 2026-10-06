// Shapes and DESIGN-stated ranges of the `geology.*` keys (DESIGN §3 3.16 and §4 4.20). Owned by the §4 package after
// P1 Wave 0, with the §3 keys maintained by the §3 package (the file's §3 and §4 blocks mirror geology.ts).
import { z } from 'zod';
import {
  ascending,
  int,
  keyed,
  lnLaw,
  loHiOrdered,
  mixArray,
  mixOf,
  nonNeg,
  nonNegInt,
  num,
  pos,
  posInt,
  prob,
  range,
  someOf,
} from '../common';
import {
  CONFIDENCE_CLASSES,
  DEPLETION_KINDS,
  REGION_TEMPLATE_IDS,
  rippleRow,
  smallCountTableSchema,
  crewCounts,
} from '../prospecting';
import {
  ACCESS_CLASSES,
  CLIMATE_BANDS,
  ECON_CLASSES,
  HOLDER_SITUATIONS,
  HONESTIES,
  LISTING_SETTINGS,
  SELLER_KNOWLEDGE,
  SIZE_SETTINGS,
  sampleMethod,
} from '../world';

export const GEOLOGY_TUNING_SCHEMAS: Readonly<Record<string, z.ZodType>> = {
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
  // ---- geology.inheritor (§3.6.1; s03 #16, D-3.73)
  'geology.inheritor.seasonBcy': lnLaw,
  'geology.inheritor.seasons': range(int),
  // Targets sit inside each class: just below zero, mid-marginal, 1.6× the good floor, 1.33× the excellent floor.
  'geology.inheritor.tierCdvUsd': keyed(ECON_CLASSES, num).refine(ascending(ECON_CLASSES, true), {
    message: 'tier targets must rise from uneconomic to excellent',
  }),
  'geology.inheritor.kBounds': range(pos),
  'geology.inheritor.bisectionSteps': posInt,
  'geology.inheritor.ledgerMult': range(pos),
  'geology.inheritor.pitLogCount': nonNegInt,
  'geology.inheritor.preStripThawFt': range(pos),
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
  // §3.10.2–3.10.3 prose constants (s03 #16, D-3.73): U{lo..hi} counts and U(lo, hi) factors as [lo, hi].
  'geology.seller.plan': keyed(
    SELLER_KNOWLEDGE,
    z.strictObject({ pans: range(nonNegInt), pits: range(nonNegInt), oldReportP: prob, historyP: prob }),
  ),
  'geology.seller.oldReport': z.strictObject({ gradeLogSd: nonNeg, years: range(int) }),
  'geology.seller.beliefBlocksMult': range(pos),
  'geology.seller.optTransforms': z.strictObject({
    screenedFeedP: prob,
    looseYardP: prob,
    looseYardDivisor: pos,
    payMult: pos,
    overburdenMult: pos,
  }),
  'geology.seller.cherryScrapes': range(nonNegInt),
  'geology.seller.fraudSamples': range(posInt),
  'geology.seller.fraudHistoryMult': range(pos),
  'geology.seller.fraudInventedSeasons': z.strictObject({
    seasons: range(posInt),
    bcy: range(pos),
    claimedGradeFrac: prob,
  }),
  'geology.seller.permitStatement': keyed(
    ['optimisticNoticeToPlanP', 'optimisticNoneToNoticeP', 'fraudulentPlanWithBondP', 'heirsAbsenteeUnknownP'],
    prob,
  ),
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
  // ---- geology.siteVisit (§3.12; the s03 #7 scalars take the naming rules)
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
  // §4 4.2.A cost and rate fields of the P1 method rows (s04 #11, D-4.68): crews by role; the scalars take the
  // naming rules (UsdPer… non-negative).
  'geology.method.pan.ownCrew': crewCounts,
  'geology.method.handPit.ownCrew': crewCounts,
  'geology.method.drywasher.ownCrew': crewCounts,
  'geology.method.excavatorPit.ownCrew': crewCounts,
  'geology.method.pan.ownUnitsPerPersonDay': pos,
  'geology.method.handPit.ownUnitsPerCrewDay': pos,
  'geology.method.drywasher.ownUnitsPerCrewDay': pos,
  'geology.method.excavatorPit.contractUnitsPerDay': pos,
  'geology.ripple.drilling': rippleRow,
  'geology.ripple.pitting': rippleRow,
  'geology.ripple.geophysics': rippleRow,
  'geology.ripple.consultants': rippleRow,
  'geology.ripple.lab': rippleRow,
  'geology.ripple.leadTime': rippleRow,
};
