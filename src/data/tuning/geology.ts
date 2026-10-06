// `geology.*` tuning constants (DESIGN §3.16; §4's keys join this file with the estimator). Keys must start with
// 'geology.'. Region-template values live in src/data/regions (§3.2). Keys marked "(prose)" carry a number DESIGN
// states in §3's pseudo-code without naming a key; they are listed as design deltas so §3.16 can adopt them.
import { smallCountTable } from '../prospecting/smallCountTable';
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
  'geology.env.sensitivity': {
    base: 0.1,
    fish: 0.3,
    anadromous: 0.25,
    wetlandShare: 0.25,
    specialStatus: 0.2,
    noiseSd: 0.05,
  },

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

  // ---- Inherited family ground (§3.6.1; prose constants registered by s03 #16, D-3.73). P1 Wave 0 (contracts-data).
  // §1's spec values (tier weights, depletion add, pre-stripped block count) stay game.inheritor.* / game.*.
  // Family seasons: bcy dug per season LN(6,000, 0.5) over the seasons 2013–2024.
  'geology.inheritor.seasonBcy': { median: 6000, sigma: 0.5 },
  'geology.inheritor.seasons': [2013, 2024],
  // Tier conditioning targets (CDV of the run as one property) and the bisection on the grade scale k.
  'geology.inheritor.tierCdvUsd': { uneconomic: -75000, marginal: 300000, good: 1200000, excellent: 4000000 },
  'geology.inheritor.kBounds': [0.25, 4],
  'geology.inheritor.bisectionSteps': 16,
  // The family ledger is the 'optimistic' transform: rawOz × U(1.2, 1.6); each season is filed w.p. 0.8.
  'geology.inheritor.ledgerMult': [1.2, 1.6],
  'geology.inheritor.filedSeasonP': 0.8,
  'geology.inheritor.pitLogCount': 4,
  // The pre-stripped blocks' thaw (2024 strip drained over two summers) and the run's one cash bond.
  'geology.inheritor.preStripThawFt': [3, 6],
  'geology.inheritor.bondUsd': 6000,

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
  // ---- Seller evidence and claims (§3.10.2, §3.10.3; prose constants registered by s03 #16, D-3.73). P1 Wave 0
  // (contracts-data). Integer pairs are U{lo..hi} counts, real pairs U(lo, hi); snapshotGenParams stores these keys.
  // Sampling plan by seller knowledge: pans and pits as U{lo..hi} counts (3-bcy pits; reach is geology.seller.methods'),
  // an old report and the true history each with a probability.
  'geology.seller.plan': {
    operator: { pans: [0, 0], pits: [6, 15], oldReportP: 0, historyP: 1 },
    prospector: { pans: [10, 30], pits: [0, 4], oldReportP: 0, historyP: 0 },
    heirs: { pans: [0, 0], pits: [0, 0], oldReportP: 0.6, historyP: 0.5 },
    absentee: { pans: [0, 0], pits: [0, 6], oldReportP: 0.5, historyP: 0 },
  },
  // Old report: grade0 = mean virgin paystreak grade × LN(1, gradeLogSd), dated U{1905..1965}.
  'geology.seller.oldReport': { gradeLogSd: 0.4, years: [1905, 1965] },
  // Sellers without their own history count their paystreak blocks × U(0.7, 1.3), rounded.
  'geology.seller.beliefBlocksMult': [0.7, 1.3],
  // Optimistic transforms: screened-feed basis w.p. 0.5; each season's bcy ÷ 1.2 (loose yards as bank) w.p. 0.5;
  // pay thickness × 1.2 and overburden × 0.85.
  'geology.seller.optTransforms': {
    screenedFeedP: 0.5,
    looseYardP: 0.5,
    looseYardDivisor: 1.2,
    payMult: 1.2,
    overburdenMult: 0.85,
  },
  // Cherry-picked bedrock scrapes U{1..3}; fabricated samples U{5..12} and a fineness note w.p. 0.6.
  'geology.seller.cherryScrapes': [1, 3],
  'geology.seller.fraudSamples': [5, 12],
  'geology.seller.fraudFineNoteP': 0.6,
  // Fraudulent history: true history × U(2, 3), or with none U{2..4} invented seasons of U(15,000, 40,000) bcy at
  // 0.75 × the claimed grade.
  'geology.seller.fraudHistoryMult': [2, 3],
  'geology.seller.fraudInventedSeasons': { seasons: [2, 4], bcy: [15000, 40000], claimedGradeFrac: 0.75 },
  // Permit statements (P2+): optimistic upgrades, fraudulent plan-with-bond, heirs' and absentees' 'unknown'.
  'geology.seller.permitStatement': {
    optimisticNoticeToPlanP: 0.25,
    optimisticNoneToNoticeP: 0.2,
    fraudulentPlanWithBondP: 0.5,
    heirsAbsenteeUnknownP: 0.5,
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
  // Prose constants registered by s03 #7 (D-3.67), P1 Wave 0 (contracts-data): drift workings seen, the snow-cover cut
  // on finds, the permafrost indicator's accuracy, and the noise on the flow and boulder readings.
  'geology.siteVisit.driftDetectP': 0.9,
  'geology.siteVisit.snowFindMult': 0.4,
  'geology.siteVisit.permafrostIndicatorP': 0.8,
  'geology.siteVisit.flowNoiseFrac': 0.1,
  'geology.siteVisit.boulderNoiseSd': 0.1,

  // =================================================================================================================
  // §4 Prospecting and resource estimation (DESIGN §4.20). Physics constants (deWijsAlpha, particle masses and CVs,
  // the vertical profile, template sigmas and ranges, bgRatio, pockets, barren creeks, prior status multipliers and
  // geology.records.*) are §3's above and reach the estimator through ClaimPriors and world.genParams, never
  // duplicated here. Method rows (§4.2) live in src/data/prospecting/methods.ts.
  // =================================================================================================================

  // ---- Estimator: prior and paystreak hypotheses (§4.5.1)
  // Calibration valve per template: tune so median ln(P50/truth) at the prior stays within ±0.10. P0 calibration on
  // the reviewed world (1,000 claims per cell, seed base 1000): the visible cells' prior biases, averaged with weights
  // 1/SE² (SE from a bootstrap over worlds), sat +0.075 (north, valve +0.05) and +0.043 (arid, valve −0.02) high, so
  // north +0.05 → 0 and arid −0.02 → −0.05.
  'geology.estPriorMedianAdj': { northernFederal: 0, aridFederal: -0.05 },
  'geology.estStreakResidLogSd': 0.35,
  'geology.estStreakNodes': 9,
  'geology.estStreakHwNodes': 3,
  'geology.estStreakNodesLarge': 7,
  'geology.estLargeClaimBlocks': 40,
  'geology.estHypPruneWeightLarge': 1e-3,
  'geology.estStreakRangeAlongFt': 2000,
  'geology.estHypPruneWeight': 1e-4,
  // (P0 addition, design delta) §3 draws the paystreak centre and half-width row by row (AR(1), §3.5.2), while a
  // configuration is a straight centre line and one half-width. The prior takes the expected log grade and its variance
  // over the rows' misfit (the centre's spread between the end nodes, the half-width's spread about the claim's) from
  // §3's own constants; this scales that variance (0 turns it off). It matters on long claims (160-acre: 40 rows).
  'geology.estStreakMisfitScale': 0.5,
  // (P0 addition, design delta) Old-timers worked only paystreak blocks (§3.6), so a hypothesis that puts a known
  // worked block off the paystreak keeps this likelihood factor per such block. Soft, because §3's paystreak wanders
  // and changes width row by row while a configuration is rigid (centre linear along the claim, one half-width): at
  // 1e-3 the footprint forced wide configurations and overstated worked claims by 0.1–0.2 (ln) at the prior.
  'geology.estWorkedOffStreakLik': 0.1,
  // (P0 addition, design delta) §3's hand-cutters worked only paystreak blocks under thin cover (maxObFt), so a
  // visibly hand-cut block bounds its depth, and through the claim's depth factor the cover expected elsewhere on the
  // claim. The bound enters the depth field as a moment-matched site whose precision is scaled by this weight: the
  // unworked paystreak blocks carry the opposite news (mostly they were left because their cover was thick), which
  // the site does not model, so it is weak: on visibly hand-cut north claims (P0 calibration, 161 claims, prior
  // stage) weight 0 / 0.05 / 0.1 give median ln(P50/truth) +0.135 / −0.007 / −0.121, expected paystreak blocks
  // 10.9 / 8.9 / 8.2 (true 9.0) and P(thin cover) on unworked paystreak blocks 0.15 / 0.25 / 0.34 (true 0.29).
  'geology.estThinCoverSiteWeight': 0.05,
  // (P0 addition, design delta) Old-timers worked a share of the paystreak blocks (§3.6: dry-washers and hand-cutters
  // the top share, recent operators U(15%, 50%), drift miners a share with a work probability), so a complete set of
  // known worked blocks also tells the paystreak's size. A hypothesis's paystreak block count is uncertain by this sd
  // (blocks) around its configuration (the hypothesis grid is coarse), which softens the count likelihood.
  'geology.estWorkedCountSlackBlocks': 2,
  // (P0 addition, design delta) Which blocks were worked also tells the paystreak's size: among N paystreak blocks the
  // chance that the top W are exactly the known ones falls as 1/C(N, W) when the grade ranking is exchangeable. The
  // ranking is partly predictable (centre blocks and rich stretches lead), so the term is tempered by this exponent.
  'geology.estWorkedSetTemper': 1,
  // ---- Estimator: measurement model (§4.4)
  // Calibration floor: tune so P10–P90 coverage stays 0.72–0.88.
  'geology.estModelErrorLogSd': 0.1,
  // (P0 addition, design delta) Calibration floor shared by every sample row of a claim (a claim-level systematic
  // error: capture, position profile, lab), so many samples cannot pin a claim tighter than the model is right. Without
  // it a 160-block pit grid held truth in only 0.66 of P10–P90 bands. Tune with estModelErrorLogSd.
  'geology.estClaimSharedLogSd': 0.05,
  'geology.estPosFullLogSd': 0.1,
  'geology.estPosUpperExtraLogSd': 0.15,
  'geology.estExposureLambdaLogSd': 0.25,
  'geology.estExposureThickElast': 1.6,
  'geology.estSmallCountTable': smallCountTable,
  'geology.estSiteRefineMaxNeff': 3,
  'geology.estSiteRefineSweeps': 2,
  'geology.estSiteRefineGrid': 24,
  'geology.estVarIterations': 2,
  // ---- Estimator: coarse factor and pockets (§4.5.3, §4.4.5, §4.7)
  'geology.estCoarseBlockLogSd': 0.25,
  'geology.estCoarseMassPriorCount': 5,
  'geology.estPocketBcyMean': 1650,
  'geology.estPocketBcy2Mean': 3.33e6,
  'geology.estPocketGradeMin': 0.15,
  'geology.estPocketGradeMult': 15,
  'geology.estPocketGradeCv2': 0.3,
  'geology.estPocketHitNcGrade': 0.04,
  'geology.estPocketHitMult': 6,
  // ---- Estimator: geometry (§4.6)
  'geology.estGeomBSdUnknownFt': 0.39,
  'geology.estGeomBLogSdKnown': 0.115,
  'geology.estCensorTrigger': 1.1,
  'geology.estCensorPadFactor': 1.15,
  'geology.estCensorLogSd': 0.25,
  // ---- Estimator: size mix and fineness (§4.7)
  'geology.estSizeMixPriorMg': 50,
  'geology.estFinenessAssaySd': 0.008,
  'geology.estFinenessParticleSd': 0.08,
  'geology.estFinenessProdSd': 0.005,
  'geology.finenessAssayMinMg': 300,
  'geology.finenessAssayCostUsd': 60,
  // ---- Planning case and economic layer (§4.7; ×cpiIndex where money)
  'geology.planWashUsdPerPayBcy': { subarctic: 12.0, arid: 14.0 },
  'geology.planStripUsdPerBcy': { subarctic: 2.5, arid: 2.2 },
  'geology.planPayable': 0.95,
  'geology.planGroundMult': { stripFrozen: 0.6, stripCement: 0.5, washBoulders: 0.3, washClay: 0.3, recClay: 0.15 },
  'geology.planMiningLossFrac': 0.05,
  'geology.planDilutionFrac': 0.1,
  'geology.planPriceMode': 'ema13',
  'geology.estRepriceStep': 0.02,
  // (prose) §4.7 observed ground terciles low / med / high → 0.15 / 0.5 / 0.85.
  'geology.planTercileValues': { low: 0.15, med: 0.5, high: 0.85 },
  // ---- Production reconciliation (§4.4.6, P1)
  'geology.estFullSolveEveryProdRows': 12,
  'geology.estProdRecoveryLogSd': 0.1,
  'geology.estProdAttribLogSd': { oneBlock: 0.08, severalBlocks: 0.2 },
  // Old-tailings pile prior for pileRawOzEst (§4.7, D-4.61; s04 #3): grade log-sd and ± share of the footprint volume.
  // P1 Wave 0 (contracts-data).
  'geology.pilePrior.logSd': 0.7,
  'geology.pilePrior.volumeFrac': 0.3,
  // ---- Seller claims (§4.10, P1 display and claim-wide test; P2 verification)
  'geology.estSellerVerifiedExtraLogSd': 0.35,
  'geology.sellerTwinMin': 3,
  'geology.sellerTwinZPass': 1.5,
  'geology.sellerFlagZQuestionable': 1.0,
  'geology.sellerFlagZImplausible': 2.0,
  'geology.sellerPreferentialMinShare': 0.3,
  'geology.boxYardToBankFactor': 0.7,
  // ---- Records review (§4.10.2). Offsets: [worked, passed-over] log-grade offsets on paystreak blocks.
  'geology.recordsWorkedLogOffset': {
    drift: [-0.45, -0.38],
    // §3's hand-cutters work only blocks under thin cover (maxObFt), so the worked blocks are chosen by cover more
    // than by grade: measured on §3's generator the worked block's virgin offset is +0.25, not +0.58 (P0 calibration).
    handCut: [-0.84, -0.25],
    dredge: [-1.97, -1.97],
    dryWash: [0.29, -0.52],
  },
  'geology.recordsWorkedShare': { drift: 0.48, handCut: 0.3, dredge: 1.0, dryWash: 0.5 },
  'geology.recordsRemovalLog': { drift: -0.87, handCut: -1.05, dredge: -1.97, dryWash: -0.23 },
  'geology.recordsTailingsPriorMedian': { handEra: 0.012, dozer: 0.005, dredge: 0.0025 },
  'geology.recordsMaxFindProb': 0.95,
  'geology.recordsItemWeight': {
    creekHistory: 1.0,
    oldWorkings: 0.9,
    priorExploration: 1.0,
    filedProduction: 0.8,
    permitHistory: 1.0,
  },
  'geology.recordsFindMult': 1.0, // difficulty 1.0 / 1.0 / 0.9 (§1 1.11)
  'geology.reviewerMult': {
    owner: 0.6,
    staffBase: 0.5,
    staffPerSkill: 0.005,
    ownerGeologist: 0.9,
    consultantBudget: 0.75,
    consultantStandard: 0.85,
    consultantPremier: 0.95,
  },
  'geology.tellSkillMult': {
    recordsDivisor: 0.78,
    ownerGeologist: 1.15,
    staffBase: 0.7,
    staffPerSkill: 0.006,
    consultantBudget: 1.0,
    consultantStandard: 1.15,
    consultantPremier: 1.3,
  },
  // ---- Confidence classes (§4.8)
  'geology.confMeasuredMaxSpread': 1.45,
  'geology.confIndicatedMaxSpread': 1.9,
  'geology.confInferredMaxSpread': 3.5,
  'geology.confMeasuredCoverage': 0.9,
  'geology.confIndicatedCoverage': 0.7,
  'geology.confInferredCoverage': 0.6,
  'geology.confInferredMaxRowGap': 2,
  'geology.confIndicatedMaxCoarseLogSd': 0.06,
  'geology.confMeasuredMaxCoarseLogSd': 0.04,
  'geology.confIndicatedMinProcessedBcy': 75,
  'geology.confMeasuredMinProdBcy': 5000,
  'geology.confMeasuredMinBulkBlocks': 2, // (prose) §4.8 "bulk samples on ≥ 2 blocks of F"
  'geology.confInferredMinBedrockSamples': 6,
  // (prose) §4.8 block-class table: sd(ln G_b) limits and the measured block's minimum sample volume.
  'geology.confBlockMaxLogSd': { measured: 0.25, indicated: 0.45, inferred: 0.75 },
  'geology.confBlockMeasuredMinSampleBcy': 100,
  // ---- Value of information (§4.11, P2)
  'geology.voiMaxCandidates': 6,
  'geology.voiShowTop': 3,
  // ---- Geologists and logging (§4.13, §4.3)
  'geology.geoNoiseMultBase': 1.3,
  'geology.geoNoiseMultPerSkill': 0.006,
  'geology.unloggedNoiseMult': 1.5,
  'geology.unloggedFalseBedrockMult': 2.0,
  'geology.unloggedCaptureMult': 0.93,
  'geology.falseBedrockGeoBase': 1.6,
  'geology.falseBedrockGeoPerSkill': 0.012,
  'geology.programsPerGeologist': 2,
  'geology.ownerGeologistSkill': 75,
  // ---- Sample execution and programs (§4.3, §4.12)
  'geology.pitStopBase': 0.05,
  'geology.pitStopBoulder': 0.1,
  'geology.pitStopMult': 1.0, // difficulty 0.7 / 1.0 / 1.3 (§1 1.11)
  'geology.pitWetDepthFt': 12,
  'geology.pitHrBase': 0.6,
  'geology.pitHrPerFt': 0.06,
  'geology.pitHrPerSampleBcy': 0.1,
  'geology.pitHrBackfill': 0.3,
  'geology.pitHrWetAdd': 0.5,
  'geology.pitFrozenRateMult': 0.35,
  'geology.seasonalFrostFt': 6,
  'geology.testPlantBcyPerHr': 5,
  'geology.frozenPitCostMult': 1.5,
  'geology.drillBedrockPenetrationFt': 3,
  'geology.prospectCostAridMult': 0.75,
  'geology.winterDrillCostMult': 1.15,
  'geology.winterDrillRateMult': 0.8,
  'geology.winterTrailWindowMobMult': 1.4,
  'geology.demobFracOfMob': 0.5,
  'geology.contractorLeadWeeksBase': { sonic: 6, rc: 4, auger: 2, churn: 10, geophysics: 3, pitting: 1 },
  'geology.contractorLeadMult': 1.0, // difficulty 0.8 / 1.0 / 1.25 (§1 1.11)
  'geology.stormLostDays': 3,
  'geology.wetLostDaysEarthwork': 1,
  'geology.deepColdLostDays': 2,
  'geology.hotProductivityMult': 0.75,
  'geology.aridSampleWaterMinGpm': 20,
  'geology.aridWaterHaulUsdPerUnit': 15,
  'geology.reportValidityWeeks': 104,
  // ---- Method cost and rate fields of the P1 rows (§4 4.2.A; s04 #11, D-4.68), P1 Wave 0 (contracts-data). These
  // are 4.21's balance levers; the measurement-model fields stay content in data/prospecting/methods.ts. Field names
  // mirror the row's own / contractor blocks (§14's `geology.method.<id>.contract…` convention); the data test pins
  // methods.ts to these values until §4 reads them from tuning. P1 contractors deliver excavator pits only (D-4.66).
  'geology.method.pan.ownCrew': { any: 1 },
  'geology.method.pan.ownUnitsPerPersonDay': 8,
  'geology.method.pan.ownConsumablesUsdPerUnit': 5,
  'geology.method.handPit.ownCrew': { laborer: 2 },
  'geology.method.handPit.ownUnitsPerCrewDay': 4,
  'geology.method.handPit.ownConsumablesUsdPerUnit': 10,
  'geology.method.handPit.ownToolRentUsdPerDay': 25,
  'geology.method.drywasher.ownCrew': { laborer: 2 },
  'geology.method.drywasher.ownUnitsPerCrewDay': 4,
  'geology.method.drywasher.ownConsumablesUsdPerUnit': 10,
  'geology.method.drywasher.ownToolRentUsdPerDay': 40,
  'geology.method.excavatorPit.ownCrew': { operator: 1, laborer: 2 },
  'geology.method.excavatorPit.ownConsumablesUsdPerUnit': 40,
  'geology.method.excavatorPit.ownToolRentUsdPerDay': 150,
  // Contract pits at $2,500 each north (≈ $1,900 arid through geology.prospectCostAridMult).
  'geology.method.excavatorPit.contractRateUsdPerUnit': 2500,
  'geology.method.excavatorPit.contractUnitsPerDay': 4,
  'geology.method.excavatorPit.contractMobUsd': 4000,
  // ---- Gold ripples (§4.18; §10 rippleDomain on goldIdxReal, P5)
  'geology.ripple.drilling': { elasticity: 0.4, lagWeeks: 13, clampLo: 0.8, clampHi: 1.6, escalate: true },
  'geology.ripple.pitting': { elasticity: 0.3, lagWeeks: 13, clampLo: 0, clampHi: 1e9, escalate: true },
  'geology.ripple.geophysics': { elasticity: 0.2, lagWeeks: 13, clampLo: 0, clampHi: 1e9, escalate: true },
  'geology.ripple.consultants': { elasticity: 0.3, lagWeeks: 26, clampLo: 0, clampHi: 1e9, escalate: true },
  'geology.ripple.lab': { elasticity: 0.1, lagWeeks: 26, clampLo: 0, clampHi: 1e9, escalate: true },
  'geology.ripple.leadTime': { elasticity: 1.5, lagWeeks: 8, clampLo: 0.7, clampHi: 2.5, escalate: false },
  // ---- Tracking and verdict (§4.1, §4.14)
  'geology.maxTrackedClaims': 40,
  'geology.maxTrackedClaimsSim': 8,
  'geology.verdictBarrenMin': 0.05,
} as const satisfies TuningTable;
