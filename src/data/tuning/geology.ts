// `geology.*` tuning constants (DESIGN §3.16; §4's keys join this file with the estimator). Keys must start with
// 'geology.'. Region-template values live in src/data/regions (§3.2). Keys marked "(prose)" carry a number DESIGN
// states in §3's pseudo-code without naming a key; they are listed as design deltas so §3.16 can adopt them.
import type { TuningTable } from './types';

export const geologyTuning = {
  // ---- World structure and creek network (§3.1, §3.3.1, §3.4)
  'geology.world.districtsP1': 2,
  'geology.world.districtsFull': 5,
  'geology.world.maxClaims': 320,
  'geology.world.mapMi': [12, 10], // (prose) district map, width × height in miles
  'geology.world.stepMi': 0.25, // (prose) polyline step
  'geology.world.mainLengthMi': [6, 9],
  'geology.world.mainHeadingJitterDeg': 30, // (prose) main stem heads into the map ± 30°
  'geology.world.headingStepSdDeg': 12, // (prose) heading += N(0, 12°) per step
  'geology.world.edgeMarginMi': 1, // (prose) polylines reflect 1 mi inside the map edge
  'geology.world.outletEdgeFrac': [0.25, 0.75], // (prose) where along its edge the outlet sits
  // P0 calibration (§3.18 parcels 65–75 per district): DESIGN U{3..6} / U(1.5, 4) / 0.4 laid ≈ 62 parcels.
  'geology.world.nTrib': [5, 8],
  'geology.world.tribPosFrac': [0.1, 0.9], // (prose)
  'geology.world.tribMinSpacingMi': 0.6, // (prose)
  'geology.world.tribAngleDeg': [35, 70], // (prose)
  'geology.world.tribLengthMi': [2.5, 5],
  'geology.world.branchP': 0.5,
  'geology.world.branchPosFrac': [0.3, 0.8], // (prose)
  'geology.world.branchLengthMi': [0.75, 2],
  'geology.world.valleyHalfWidthFt': [
    [500, 900],
    [250, 500],
    [150, 300],
  ], // (prose) by creek order 1 / 2 / 3
  'geology.world.barrenCreekP': 0.2,
  'geology.world.barrenCreekFactor': 0.15,
  'geology.world.noTrailCreekP': 0.15,
  'geology.world.withdrawnStretchFrac': [0.1, 0.25], // (prose) share of the main stem
  'geology.world.specialStretchFrac': [0.15, 0.3], // (prose) share of a tributary
  'geology.world.benchSideP': 0.6, // fallback; each P1 template sets its own (§3.4: tuned to its bench share)
  'geology.world.benchMinHalfWidthFt': 400, // (prose) benches on order-1 creeks or valleys ≥ 400 ft half-width
  'geology.world.benchStretchFrac': [0.3, 0.7], // (prose)
  'geology.world.benchOffsetFt': [100, 600], // (prose) beyond the valley half-width
  'geology.world.valleyFirstRowMax': 5, // (prose) row = U{0..5}
  'geology.world.valleyGapP': 0.2, // (prose)
  'geology.world.valleyGapRows': [1, 5], // (prose)
  'geology.world.dredgedStretchMi': [1, 3], // (prose)
  'geology.world.dredgedZoneFrac': 0.6, // (prose) lower 60% of the main stem and the largest tributary
  'geology.world.dredgedShareTol': 0.05, // (prose)
  'geology.world.dredgedMaxStretches': 6, // fixed draw slots for dredged stretches (stream rule e)
  'geology.world.familyRunParcels': 3, // §3.4 / §3.6.1 reserved Inheritor run (20-ac valley parcels)
  'geology.world.junctionBoostLog': 0.25,
  'geology.world.junctionBoostRows': 7,
  'geology.world.proximalTopFrac': 0.3, // (prose) proximal = top 30% of a creek's rows, or an order-3 creek
  'geology.world.selSlope': 1.2,
  'geology.world.selSlopeOverlooked': 0.3,
  'geology.world.zqNoPaystreak': -3,
  'geology.world.zqLnScale': 0.5, // (prose) "logit per 0.5 ln of grade"
  'geology.world.trailTortuosity': 1.2,

  // ---- Environment (§3.4.1)
  'geology.env.channelOffsetFt': [-80, 80],
  'geology.env.aspectThawSlope': 0.35,
  'geology.env.aspectFrozenSlope': 0.6,
  'geology.env.sensitivity': { base: 0.1, fish: 0.3, anadromous: 0.25, wetlandShare: 0.25, specialStatus: 0.2, noiseSd: 0.05 },

  // ---- Visible priors (§3.9)
  'geology.prior.statusMult': { held: 1.0, listed: 0.92, open: 0.6 },
  'geology.prior.paystreakShare': { valleyBottom: 0.3, bench: 0.4, dredgedGround: 0.3, fan: 0.3, gulch: 0.3 },
  'geology.prior.listedSigmaAdj': 0,
  'geology.prior.oldWorkingsMult': { dredgeTailings: 0.15, tailingsPiles: 0.6 }, // (prose) priorContainedOz
  'geology.prior.sizeMixJitterLogSd': 0.25, // (prose) ClaimPriors
  'geology.prior.coarseMassLogSd': 0.3, // (prose) ClaimPriors

  // ---- Grade field (§3.5)
  'geology.grade.blockRangeAlongFt': 700,
  'geology.grade.blockRangeAcrossFt': 120,
  'geology.grade.wanderRangeFt': 2000,
  'geology.grade.halfWidthRangeFt': 1500,
  'geology.grade.obRangeFt': 2500,
  'geology.grade.payRangeFt': 1500,
  'geology.grade.obAxisBoost': 0.3,
  'geology.grade.obAxisScaleFt': 400,
  'geology.grade.pocketBcy': [300, 3000],
  'geology.grade.pocketMaxPayFrac': 0.5, // (prose) pocket bcy ≤ 0.5 × payBcy
  'geology.grade.pocketMult': { median: 15, sigma: 0.5 },
  'geology.grade.pocketGradeClamp': [0.15, 2.0],
  'geology.grade.pocketStreakMinF': 0.4, // (prose) pockets only where f ≥ 0.4
  'geology.grade.pocketProximalMult': 1.5, // (prose) × on proximal rows and gulches
  // (prose) §3.5.3 per-claim and per-block draws
  'geology.grade.claim': {
    decayJitterLo: 0.75, // λg × U(0.75, 1.25)
    decayJitterHi: 1.25,
    frozenDegreeLo: 0.6, // frozenDegree U(0.6, 1.0)
    frozenDegreeHi: 1.0,
    frozenMaxP: 0.95,
    clayLogSd: 0.6,
    boulderLogSd: 0.6,
    cementLogSd: 0.5,
    blockMixJitterLogSd: 0.1, // each class × LN(1, 0.10)
    coarseStreakThin: 0.5, // coarse × (0.5 + 0.5 f): coarse gold stays in the channel
    blockFinenessSd: 0.006,
    permafrostBlockSd: 0.08,
    unfrozenSubarcticMax: 0.15, // unfrozen subarctic blocks: permafrost 0.15 × U
    groundBlockSd: 0.05, // clay / boulders / cementation block noise
    clayFalseMinClay: 0.4,
    bedrockJitterLo: 0.8, // Bc and s_b × U(0.8, 1.2)
    bedrockJitterHi: 1.2,
    payStreakWeight: 0.3, // T × (0.7 + 0.3 f)
    maxOverburdenFt: 120,
    minPayFt: 1,
    maxPayFt: 15,
  },
  'geology.grade.boulderSettingMult': { proximal: 1.5, gulch: 1.4, fan: 0.6, bench: 0.8, midReach: 1.0 }, // (prose)

  // ---- Vertical profile (§3.5.4)
  'geology.vertical.bedrockDecayFt': 0.6,
  'geology.vertical.obGradeRatio': 0.03,

  // ---- Old-timers and recent operators (§3.6)
  'geology.oldTimer.liabilityEraYear': 1981,
  'geology.oldTimer.recentReclaimedP': 0.45,
  'geology.oldTimer.preStripP': 0.25,
  'geology.oldTimer.preStripMaxAgeYr': 6,
  'geology.oldTimer.histRecoveryHand': [0.6, 0.85],
  'geology.oldTimer.recentCapture': [0.93, 0.85, 0.55, 0.2],
  'geology.oldTimer.recentOpSkill': [0.85, 1.0],
  'geology.oldTimer.improvementsUsd': { median: 25000, sigma: 0.6, oldMult: 0.4, oldYears: 15 },
  'geology.oldTimer.recentStartYear': [1985, 2018], // (prose) first recent season U{1985..2018}
  'geology.oldTimer.recentGapP': 0.2, // (prose) "occasional gaps": a one-year gap between seasons
  'geology.oldTimer.filedSeasonP': 0.8, // (prose) post-1990 seasons on file
  'geology.oldTimer.filedSeasonMinYear': 1990, // (prose)
  'geology.oldTimer.footprintOnRecordP': 0.7, // (prose)
  // (prose) §3.6 old-timer table: era, blocks affected, extraction and tailings-pile size per kind.
  'geology.oldTimer.kinds': {
    drift: { eraLo: 1898, eraHi: 1930, topLo: 0.4, topHi: 0.8, workP: 0.8, extractLo: 0.6, extractHi: 0.9 },
    handCut: { eraLo: 1898, eraHi: 1940, top: 0.3, maxObFt: 10, extractLo: 0.5, extractHi: 0.8 },
    dredge: { eraLo: 1920, eraHi: 1962, minF: 0.05, extractLo: 0.8, extractHi: 0.92 },
    dryWash: { eraLo: 1930, eraHi: 1942, top: 0.5, extractLo: 0.1, extractHi: 0.3 },
    hydraulic: { eraLo: 1870, eraHi: 1900, extractLo: 0.5, extractHi: 0.8, obMult: 0.5 },
    recentCat: { topLo: 0.15, topHi: 0.5, seasonBlocksLo: 1, seasonBlocksHi: 3, pileLo: 0.6, pileHi: 0.9 },
  },
  'geology.oldTimer.driftBottom': { topFt: 5, bedrockFt: 1, decayMult: 2, bedrockShareMult: 0.6 }, // (prose)
  'geology.oldTimer.dredgeEffects': { boulderMult: 0.3, decayFt: 6, minBedrockShare: 0.5 }, // (prose)
  'geology.oldTimer.maxExtraction': 0.92, // (prose) x ≤ 0.92
  'geology.oldTimer.depleteCap': 0.95, // (prose) a class keeps ≥ 5% of its gold
  'geology.oldTimer.depleteWeights': { hand: [1.3, 1.1, 0.7, 0.3], dredge: [1.1, 1.05, 0.9, 0.6] }, // (prose)
  'geology.oldTimer.pileBcy': {
    // (prose) tailingsPile sizes: drift 5 × 1,613 × U(0.4, 0.7); handCut payBcy × U(0.3, 0.6); dryWash 2 × 1,613 × U(0.2, 0.5)
    driftFt: 5,
    driftLo: 0.4,
    driftHi: 0.7,
    handCutLo: 0.3,
    handCutHi: 0.6,
    dryWashFt: 2,
    dryWashLo: 0.2,
    dryWashHi: 0.5,
  },
  'geology.oldTimer.pileMix': [0.05, 0.2, 0.45, 0.3], // (prose) historic tailings size mix
  'geology.oldTimer.preStripBlocks': [1, 3], // (prose)
  'geology.oldTimer.preStripThawFt': [3, 6], // (prose)

  // ---- Truth permit stub (§3.9, D-3.48)
  'geology.permitStub.minLastSeasonYear': 2000,
  'geology.permitStub.planP': 0.6,
  'geology.permitStub.noticeP': 0.2,
  'geology.permitStub.bondFrac': [0.5, 1.0], // (prose) bond = U(0.5, 1.0) × reclamation estimate of open acres
  'geology.permitStub.rceStubUsdPerAcre': 6000, // P1 stub for §6 reclamationCostEstimate (CLAUDE.md P1 stubs)

  // ---- Public record (§3.6)
  'geology.records.historicGradeRatio': 2.5,
  'geology.records.creekProdLogSd': 0.5,
  'geology.records.priorDrillP': 0.1,
  'geology.records.priorDrillHoles': [3, 8],
  'geology.records.priorDrillYears': [1935, 1985],
  'geology.records.flyInQualityMult': 0.5,

  // ---- §4 method row for historic churn-drill logs (§4 4.2.B `churnHistoric`; moves to data/prospecting with §4)
  'geology.method.churnHistoric': {
    positionMode: 'fullColumn',
    frozenOk: true,
    bedrockPenFt: 3,
    captureBySize: { coarse: 0.9, medium: 0.85, fine: 0.7, ultrafine: 0.4 },
    volumeCv: 0.35,
    weighCv: 0.2,
    geomCv: 0.06,
    thickCv: 0.15,
    biasMult: 1,
    bcyPerFt: 0.01,
  },

  // ---- Particles and sampling (§3.8)
  'geology.particle.meanMg': [3, 0.1, 0.004],
  'geology.particle.massCv': [2.0, 1.0, 0.7, 0.5],
  'geology.sample.deWijsAlpha': 0.028,
  'geology.sample.poissonNormalLambda': 30,
  'geology.sample.cltParticleThreshold': 40,
  'geology.sample.frozenThreshold': 0.5,
  'geology.sample.activeLayerFt': 2.0,
  'geology.sample.waterTableFt': { subarctic: 6, arid: 15 },
  'geology.sample.waterInflowP': { subarctic: 0.25, arid: 0.05 },
  'geology.sample.pocketMix': [0.6, 0.3, 0.08, 0.02],
  'geology.sample.exposureMaxObFt': 0.5,
  'geology.sample.exposureDepthFrac': 0.4, // (prose) default sampled share of the gravel top
  'geology.sample.defaultThickCv': 0.1, // (prose) §4 D-4.43 default
  'geology.sample.waterStopFt': [1, 4], // (prose) inflow stops the pit U(1, 4) ft above bedrock
  'geology.sample.bedrockIdP': 0.9, // (prose) logged bedrock type is right w.p. 0.9
  'geology.sample.groundObsSd': 0.1, // (prose) clay / boulder tercile noise
  'geology.sample.tercileCuts': [0.33, 0.66], // (prose)

  // ---- Sellers (§3.10; honestyMix takes §1 1.11's per-difficulty values through difficulty.ts)
  'geology.seller.honestyMix': { accurate: 0.35, optimistic: 0.35, cherryPicked: 0.22, fraudulent: 0.08 },
  'geology.seller.honestyTilts': {
    accurate: { estate: 1.6, retiringOperator: 1.3 },
    optimistic: { prospector: 1.3, absentee: 1.2 },
    cherryPicked: { distressedOperator: 1.5 },
    fraudulent: { prospector: 1.5, distressedOperator: 1.2, estate: 0.3 },
  },
  'geology.seller.situationMix': {
    prospector: 0.35,
    absentee: 0.25,
    retiringOperator: 0.15,
    estate: 0.1,
    distressedOperator: 0.15,
  },
  'geology.seller.groupRunP': 0.5, // (prose) contiguous held runs grouped under one holder
  'geology.seller.maxParcelsPerHolder': 6, // (prose)
  'geology.seller.methods': {
    sellerPan: {
      positionMode: 'exposure',
      exposureDepthFrac: 0.4,
      volumeBcy: 0.0067,
      frozenOk: false,
      bedrockPenFt: 0,
      captureBySize: { coarse: 0.98, medium: 0.95, fine: 0.85, ultrafine: 0.5 },
      volumeCv: 0.15,
      weighCv: 0.1,
      geomCv: 0.15,
    },
    sellerPit3: {
      positionMode: 'pit',
      volumeBcy: 3,
      reachFt: { operator: 22, prospector: 18 },
      frozenOk: true,
      bedrockPenFt: 0.5,
      captureBySize: { coarse: 0.97, medium: 0.93, fine: 0.8, ultrafine: 0.45 },
      volumeCv: 0.15,
      weighCv: 0.05,
      geomCv: 0.1,
    },
    bedrockScrape: {
      positionMode: 'interval',
      interval: [-1, 1],
      volumeBcy: 0.5,
      frozenOk: true,
      bedrockPenFt: 1,
      captureBySize: { coarse: 0.97, medium: 0.93, fine: 0.8, ultrafine: 0.45 },
      volumeCv: 0.15,
      weighCv: 0.05,
      geomCv: 0.1,
    },
  },
  'geology.seller.packageMix': {
    accurate: { complete: 0.7, partial: 0.3, none: 0 },
    optimistic: { complete: 0.5, partial: 0.5, none: 0 },
    cherryPicked: { complete: 0.3, partial: 0.6, none: 0.1 },
    fraudulent: { complete: 0.3, partial: 0.4, none: 0.3 },
    estateNoneP: 0.5,
  },
  'geology.seller.claimedBlocksMult': { accurate: 1.0, optimistic: 1.2, cherryPicked: 1.0, fraudulent: 1.5 },
  'geology.seller.historyWeightBcy': 20000,
  'geology.seller.optMult': { median: 1.45, sigma: 0.15, lo: 1.15, hi: 2.2 },
  'geology.seller.cherryPitMult': 2.5,
  'geology.seller.cherryReportShare': 0.35,
  'geology.seller.bedrockScrapeP': 0.5,
  'geology.seller.fraudMult': { median: 4.0, sigma: 0.35, lo: 2.5, hi: 10 },
  'geology.seller.fraudSampleSigma': 0.25,
  'geology.seller.fraudTitleDefectP': 0.3,
  'geology.seller.tellDetect': {
    gradeBasisScreened: { recordsReview: 0.1, geologistReview: 0.85, siteVisit: 0 },
    historyLooseYards: { recordsReview: 0.5, geologistReview: 0.6, siteVisit: 0 },
    thicknessOverstated: { recordsReview: 0.2, geologistReview: 0.5, siteVisit: 0.3 },
    sampleClustering: { recordsReview: 0, geologistReview: 0.75, siteVisit: 0 },
    unreportedPits: { recordsReview: 0.55, geologistReview: 0.3, siteVisit: 0.6 },
    bedrockScrapeSamples: { recordsReview: 0, geologistReview: 0.8, siteVisit: 0 },
    historyGaps: { recordsReview: 0.65, geologistReview: 0.2, siteVisit: 0 },
    noProductionRecord: { recordsReview: 0.85, geologistReview: 0.3, siteVisit: 0.5 },
    inflatedHistory: { recordsReview: 0.75, geologistReview: 0.3, siteVisit: 0.3 },
    saltedSignature: { recordsReview: 0, geologistReview: 0.65, siteVisit: 0 },
    unknownLab: { recordsReview: 0.3, geologistReview: 0.7, siteVisit: 0 },
    permitStatusMismatch: { recordsReview: 0.9, geologistReview: 0.1, siteVisit: 0 },
  },

  // ---- Supply (§3.11)
  'geology.supply.initialListedShare': 0.17,
  'geology.supply.minInitialPerDistrict': 6,
  'geology.supply.baseListHazard': 0.025,
  'geology.supply.seasonMult': { offSeason: 1.4, preSeason: 1.2, inSeason: 0.6 },
  'geology.supply.inflowMult': { uneconomic: 1.1, marginal: 1.0, good: 0.8, excellent: 0.6 },
  'geology.supply.saleQualityMult': { uneconomic: 0.7, marginal: 1.0, good: 1.8, excellent: 2.5 },
  'geology.supply.relistCooldownWk': 20,
  'geology.supply.postSaleCooldownWk': 52,
  'geology.supply.goldElasticityUp': 0.5,
  'geology.supply.goldElasticityDown': 1.5,
  'geology.supply.goldLagWk': 8,
  'geology.supply.goldMultClamp': [1.0, 2.5],
  'geology.supply.maxListHazard': 0.1,
  'geology.supply.scarcityMax': 2.5,
  'geology.supply.npcForfeitRate': 0.03,
  'geology.supply.lowGoldMult': 1.5,
  'geology.supply.npcRestakeRatio': 1.0,
  'geology.supply.landOpenedTakenShare': 0.35,
  'geology.supply.starterLeasePerDistrict': 1,

  // ---- Access (§3.3.3)
  'geology.access.highway.fuelAdder': 0.35,
  'geology.access.highway.partsLead': 0.5,
  'geology.access.highway.mobMult': 1.0,
  'geology.access.highway.refMi': 40,
  'geology.access.seasonalRoad.fuelAdder': 0.9,
  'geology.access.seasonalRoad.partsLead': 1.0,
  'geology.access.seasonalRoad.mobMult': 1.4,
  'geology.access.seasonalRoad.refMi': 80,
  'geology.access.winterTrail.fuelAdder': 1.75,
  'geology.access.winterTrail.partsLead': 2.0,
  'geology.access.winterTrail.mobMult': 2.2,
  'geology.access.winterTrail.refMi': 120,
  'geology.access.flyIn.fuelAdder': 5.5,
  'geology.access.flyIn.partsLead': 2.5,
  'geology.access.flyIn.mobMult': 4.0,
  'geology.access.flyIn.refMi': 150,
  'geology.access.distExponent': 0.5,
  'geology.access.distScaleClamp': [0.6, 1.8],
  'geology.access.trailDegrade1Mi': 6,
  'geology.access.trailDegrade2Mi': 18,

  // ---- Water (§3.3.4)
  'geology.water.usableFrac': 0.8,
  'geology.water.lowFlowShape': { creek: 0.45, spring: 0.9 },
  'geology.water.listingShape': { early: 1.4, mid: 0.9, late: 0.75 },
  'geology.water.listingNoiseSigma': 0.2,
  'geology.water.rightStubP': { subarctic: 0.1, arid: 0.3 },
  'geology.water.rightStubGpm': [50, 300],
  'geology.water.benchLiftFt': [30, 300], // (prose) bench pump head U(30, 300)
  'geology.water.nearestFillFrac': [0.3, 1.0], // (prose) nearestFillMi = distanceToTownMi × U(0.3, 1.0)

  // ---- Reference economics yardstick (§3.7; sim, tests and the dev reveal only)
  'geology.refEcon.payable': 0.95,
  'geology.refEcon.capture': [0.95, 0.88, 0.62, 0.25], // §7 sluice-only anchors
  'geology.refEcon.clayRecoveryPenalty': 0.15,
  'geology.refEcon.stripUsd': { subarctic: 2.5, arid: 2.2 },
  'geology.refEcon.washUsd': { subarctic: 12.0, arid: 14.0 },
  'geology.refEcon.devBaseUsd': { subarctic: 150000, arid: 120000 },
  'geology.refEcon.devPerAcreUsd': { subarctic: 8000, arid: 7000 },
  'geology.refEcon.frozenStripAdd': 0.6,
  'geology.refEcon.cementStripAdd': 0.5,
  'geology.refEcon.boulderWashAdd': 0.3,
  'geology.refEcon.clayWashAdd': 0.3,
  'geology.refEcon.frozenWashAdd': 0.4,
  'geology.refEcon.goodCdvUsd': 750000,
  'geology.refEcon.goodMargin': 0.4,
  'geology.refEcon.excellentCdvUsd': 3000000,
  'geology.refEcon.excellentMargin': 0.6,

  // ---- Site visits (§3.12)
  'geology.siteVisit.costUsd': { highway: 400, seasonalRoad: 800, winterTrail: 1800, flyIn: 3500 },
  'geology.siteVisit.days': { highway: 2, seasonalRoad: 3, winterTrail: 4, flyIn: 4 },
} as const satisfies TuningTable;
