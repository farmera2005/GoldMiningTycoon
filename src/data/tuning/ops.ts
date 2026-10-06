// `ops.*` tuning constants (DESIGN §7 7.21). Keys must start with 'ops.'. USD in year-1 dollars × cpiIndex.
// P1 Wave 0 (contracts-data) wrote every 7.21 row with its DESIGN default. Tabled rows ("a / b / c" in 7.21) are one key
// holding a nested readonly object with the field names the §7 kernel reads (systems/ops/kernel/params.ts,
// OPS_KERNEL_TUNING_KEYS); tests/data/opsTuning.test.ts pins every kernel key to the kernel's DESIGN fixture. Shapes and
// values DESIGN does not state yet are marked (delta) and reported for 7.21.
import type { TuningTable } from './types';

export const opsTuning = {
  // ---- Hours, shifts, lines and supervision (7.2, 7.5, 7.12; §8 8.12)
  'ops.hoursPerShiftMin': 4,
  'ops.hoursPerShiftMax': 12,
  // R3's 60–85% plant utilisation with the other losses; P3+ swaps it for daily servicing plus §9 failures.
  'ops.p1MechAvailability': 0.92,
  'ops.p3RoutineAvailability': 0.97,
  // §8 quotes F = 0.85 + 0.15·qF/100.
  'ops.foremanEffMin': 0.85,
  'ops.foremanEffMax': 1.0,
  // Small crew with no foreman (§8 8.12: ≤ staff.smallCrewMaxNoForeman, one line, one shift; D-7.11).
  'ops.noForemanEfficiency': 0.92,
  // P3 plant lines (D-7.19); P1–P2 plans have one line.
  'ops.maxPlantLinesPerClaim': 3,
  // (delta: shape) claim size for line 2 / line 3, keyed by line number.
  'ops.extraLineMinAcres': { 2: 20, 3: 40 },
  'ops.foremanRedeployMax': 0.6,
  // §1 D-1.3: night-freeze shutdowns cut cool operating weeks.
  'ops.plantHoursMultByBand': { deepCold: 1.0, cold: 1.0, cool: 0.8, mild: 1.0, hot: 1.0 },
  // P5 precipitation hours, read by §1's weatherHoursMult composite (1.5.6).
  'ops.weatherHoursMult': { dry: 1.0, normal: 1.0, wet: 0.92, storm: 0.75 },
  // P1 heat hours (§1 D-1.25, D-7.66): day shift × clamp(1 − slope × (meanTempF − threshold), floor, 1); night × nightMult.
  'ops.heat.thresholdF': 80,
  'ops.heat.slopePerF': 0.03,
  'ops.heat.floor': 0.55,
  'ops.heat.nightMult': 0.95,
  // P1 fire-level hours (IFPL, R2; D-7.66): missing levels are 1; level 3 caps the day shift.
  'ops.fireLevelHoursMult': { 1: 0.97, 2: 0.97, 4: 0 },
  'ops.fireLevel3DayShiftMaxHours': 8,
  // Four light towers; the midnight-sun weeks need none.
  'ops.nightLightGalPerHr': 2.0,
  'ops.nightLightFreeWeeksNorth': [22, 30],
  'ops.breakupWorkMult': 0.6,
  'ops.winterWorkMult': 0.8,
  // R4: idle 20–40% of SMU hours.
  'ops.idleEngineRunShare': 0.6,
  'ops.idleLoadFactor': 0.3,
  // (delta: new key) 7.11's task load factors as data; §9 9.7.3 quotes the same values.
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
  // Freeze-up plant capacity: P1 flat; the by-band table is read from P5 behind rulesAtLeast(5) (D-7.66).
  // (delta: mild, hot) DESIGN gives cool, cold and deepCold only.
  'ops.freezeupPlantMult': 0.6,
  'ops.freezeupPlantMultByBand': { deepCold: 0, cold: 0.5, cool: 0.9, mild: 1.0, hot: 1.0 },
  // P3 frozen damage; not difficulty-scaled (D-7.41). Bands warmer than cold never freeze (0).
  'ops.freezeDamageProb': { deepCold: 0.6, cold: 0.25, cool: 0, mild: 0, hot: 0 },

  // ---- Cuts, blocks and the pay column (7.3)
  'ops.contactMeanFt': { tight: 0, standard: 0.5, generous: 1.0 },
  'ops.contactErrorSdFt': 0.6,
  'ops.contactSkillSlope': 0.6,
  // Total dilution ~10–20% (R3 10–30%).
  'ops.wallDilutionFrac': 0.04,
  // R3 1–3 ft, up to 5 (D-7.31).
  'ops.bedrockTakeFtMax': 5,
  'ops.defaultBedrockTakeFt': 1.5,
  'ops.miningLossBase': 0.03,
  'ops.miningLossSkillSlope': 0.6,
  'ops.miningLossBoulderAdd': 0.02,
  'ops.subBlockGradeSigma': 0.25,
  'ops.payExposureRampStart': 0.5,

  // ---- Ground: thaw, digging and stripping (7.4)
  // R3: 3–6 ft a summer, 2–4 in/day at the peak.
  'ops.thawK': { deepCold: 0, cold: 0, cool: 1.2, mild: 2.0, hot: 2.4 },
  // R3: active layer 1–3 ft under vegetation.
  'ops.thawSurfaceMult': { vegetated: 0.12, cleared: 0.45, stripped: 1.0 },
  'ops.thawMuckMult': 0.7,
  'ops.overwinterThawRetention': { vegetated: 0, cleared: 0.3, stripped: 0.8 },
  'ops.clearDozerHrPerAcre': 6,
  // R3, R2 (frozen 20–50%): gravel / bedrock × thawed / frozen / ripped.
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
  // Overburden time × (1 + slope × cementation) for dozer and excavator stripping (D-7.67, s07 #19).
  'ops.cementationStripSlope': 0.5,
  // R3: −10–30% in bouldery ground.
  'ops.boulderDigPenalty': 0.25,
  'ops.boulderPlantPenalty': 0.25,
  'ops.tailingsDigMult': 1.15,
  'ops.downValleySeqDigMult': 0.9,

  // ---- Strip and haul (7.6.1, 7.6.3)
  // R4 push curve (300 ft × 0.52).
  'ops.dozerRefPushFt': 150,
  'ops.dozerPushExp': 0.9,
  'ops.basePushFt': 150,
  'ops.pushFtPerExtraCol': 100,
  'ops.dumpExtraPushFt': 50,
  'ops.haulBaseFt': 300,
  'ops.blockSpacingFt': 209,
  // 8 / 12 mph (R4 8–15 / 12–20).
  'ops.truckLoadedFtPerMin': 704,
  'ops.truckEmptyFtPerMin': 1056,
  // R4: dump 0.7–1.2 min.
  'ops.truckDumpMin': 1.2,
  'ops.truckSpotMin': 0.8,
  // The 50-minute hour (R4).
  'ops.haulJobEff': 0.83,
  // P5 (§1 1.5.6).
  'ops.haulCycleMultByPrecip': { dry: 1.0, normal: 1.0, wet: 1.1, storm: 1.25 },
  'ops.loaderCarryRefFt': 300,

  // ---- Feed, pad and stockpiles (7.6.4)
  // Excavator reach ~30 ft.
  'ops.directFeedMaxRated': 75,
  'ops.directFeedDigMult': 0.6,
  'ops.directFeedShiftHours': 4,
  'ops.directFeedSetupBcy': 3000,
  'ops.padFreeBcy': 1500,
  'ops.stockpileCapMaxBcy': 50000,
  'ops.rehandleTimeMult': 1.25,
  // R2: thawed stockpiles refreeze.
  'ops.stockpileOverwinterFrozenFrac': 0.6,

  // ---- Plant, tailings and plant moves (7.6.5, 7.6.8)
  'ops.tailingsHandlingHrPerKBcy': 3.0,
  'ops.tailingsSurgeBcy': 400,
  // 75 bcy/hr → 16 h.
  'ops.plantMoveHoursBase': 4,
  'ops.plantMoveHoursPerRatedBcyHr': 0.16,
  'ops.plantMaxOverfeed': 1.5,
  // R3: trommel −30–50% in clay.
  'ops.clayCapCut': { trommel: 0.45, shakerDeck: 0.35, grizzly: 0.25, dryWasher: 0.6 },

  // ---- Water (7.6.6)
  // R2 design constant (D-7.18).
  'ops.gpmPerBcyHr': 15,
  // R2: clay 25–35.
  'ops.clayWaterAdd': 1.0,
  'ops.prepWaterMult': { trommel: 1.0, shakerDeck: 0.9, grizzly: 0.85, dryWasher: 0 },
  // Fluidisation water.
  'ops.concentratorWaterAdd': 0.1,
  // R2 [V]: recycle needs ~40% more flow.
  'ops.recycleExtraFlow': 0.4,
  'ops.recycleMax': 0.9,
  // R2 10–25%; arid 0.20 → 0.15 (D-7.37). (delta: shape) keyed by §3 climate band, not north / temperate / arid.
  'ops.makeupFrac': { subarctic: 0.12, temperateMontane: 0.15, arid: 0.15 },
  // Spray bars 40–80 psi; §9 pumps are rated at 100 ft.
  'ops.plantTdhFt': 100,
  'ops.pumpStageHeadFt': 100,
  // R2: ponds 25–40% of pay; build and cleanout hours.
  'ops.pondSludgeFrac': 0.3,
  'ops.pondDepthFt': 8,
  'ops.pondBuildDozerHrPerKBcy': 4,
  'ops.pondDesignFreeboardFrac': 0.25,
  'ops.leanWaterFloor': 0.5,
  // R2 2024–25.
  'ops.waterTruckGal': 4000,
  'ops.waterTruckFillHr': 0.5,
  'ops.waterTruckMph': 25,
  'ops.waterTruckDayRateUsd': 1400,
  // Casing, pump and genset hook-up.
  'ops.wellBaseUsd': 15000,
  'ops.wellUsdPerFt': 60,
  'ops.wellWeeks': 2,
  // Shared aquifer.
  'ops.secondWellYieldMult': 0.7,
  'ops.wellPumpGalPerHr': 1.5,

  // ---- Recovery (7.9)
  // Anchors (R3); dry washer R2 (−35%).
  'ops.baseCapture': {
    sluice: { coarse: 0.95, medium: 0.88, fine: 0.62, ultrafine: 0.25 },
    jig: { coarse: 0.96, medium: 0.92, fine: 0.85, ultrafine: 0.55 },
    centrifuge: { coarse: 0.96, medium: 0.92, fine: 0.9, ultrafine: 0.7 },
    dryWasher: { coarse: 0.85, medium: 0.65, fine: 0.35, ultrafine: 0.1 },
  },
  // R3: +25% feed → 1.5× losses, +50% → 2×.
  'ops.overfeedExp': { coarse: 0.5, medium: 1.5, fine: 2.6, ultrafine: 2.6 },
  'ops.underfeedBenefitFactor': 0.3,
  'ops.underfeedPhiFloor': 0.6,
  // R3: penalise both sides of the water ratio.
  'ops.leanWaterExp': { coarse: 0.3, medium: 1.0, fine: 1.6, ultrafine: 1.6 },
  'ops.excessWaterExp': { coarse: 0, medium: 0.2, fine: 0.6, ultrafine: 0.8 },
  // Viscosity, on fine and ultrafine losses. (delta: deepCold) as cold; a P1 freeze-up week can be deepCold.
  'ops.coldWaterExp': { deepCold: 1.12, cold: 1.12, cool: 1.05, mild: 1.0, hot: 1.0 },
  // R3: classified feed; on fine and ultrafine losses.
  'ops.prepFineLossExp': { trommel: 1.0, shakerDeck: 1.0, grizzly: 1.25, dryWasher: 1.0 },
  // R3: up to −20%.
  'ops.clayLossMax': 0.2,
  // (delta: dryWasher) 7.21 names no dry-washer factor; 1.0 = no scrubbing.
  'ops.clayScrubFactor': { trommel: 0.3, shakerDeck: 0.7, grizzly: 1.0, dryWasher: 1.0, scrubber: 0.1 },
  // R3: cleanup every 50–150 h.
  'ops.riffleLoadHoursRef': 100,
  'ops.riffleLoadGradeRef': 0.02,
  'ops.riffleLoadExpPer25h': 0.1,
  'ops.riffleLoadExpMax': 1.6,
  // Wear from P3.
  'ops.riffleWearExp': 0.6,
  'ops.oversizeCoarseLoss': 0.01,
  'ops.oversizeCoarseLossTrap': 0.002,
  'ops.untrainedPlantSkill': 20,
  'ops.rerunHardnessExp': 1.5,

  // ---- Cleanup and the gold room (7.10)
  // R3: half to one shift.
  'ops.cleanupHoursBase': 4,
  'ops.cleanupHoursPerRatedBcyHr': 0.04,
  'ops.cleanupCrewSize': 2,
  // Forced cleanup.
  'ops.maxBoxWeeks': 8,
  'ops.goldRoomLoss': {
    noTable: { coarse: 0.002, medium: 0.005, fine: 0.03, ultrafine: 0.1 },
    table: { coarse: 0.001, medium: 0.002, fine: 0.01, ultrafine: 0.04 },
  },
  // R3 melt loss 1–5%; `.noTable` also prices §4 sample lots (read by §4 and §10).
  'ops.goldRoomDirtFrac.noTable': 0.04,
  'ops.goldRoomDirtFrac.table': 0.02,
  // P5 high-grading skim (7.10, D-7.36; R5 1–10% where controls are weak).
  'ops.skimBase': 0.25,
  'ops.skimFrac': 0.04,
  // Added to §9 campSummary.security when the owner is on the claim; cap as §12 (D-7.43).
  'ops.ownerPresentSecurity': 0.15,
  'ops.siteSecurityCap': 0.9,

  // ---- Operating costs (7.11)
  // Screens, mats, nozzles.
  'ops.consumablesUsdPerBcyWashed': 0.4,
  'ops.getUsdPerBcyDug': 0.05,
  'ops.getUsdPerBcyStripped': 0.03,
  'ops.getFrozenMult': 2.0,
  // Anchor (D-7.21); tiers basic / standard / good / premium.
  'ops.campUsdPerPersonDay': 55,
  'ops.campTierMult': { basic: 0.8, standard: 1.0, good: 1.25, premium: 1.5 },
  // Camp genset, heat, pickups (R4).
  'ops.campFuelGalPerPersonDay': 3.5,
  'ops.winterCampMult': 1.4,
  'ops.siteFixedUsdPerWeek': 750,
  'ops.revegUsdPerAcre': 600,
  // §6 reveg 2 h/ac.
  'ops.reseedHoursPerAcre': 2,
  // P3 fuel stock.
  'ops.siteDayTankGal': 1000,

  // ---- Site tasks (7.12)
  // × §3 mobMult (incl. distance).
  'ops.siteMobBaseUsd': 12000,
  'ops.siteDemobShare': 0.6,
  'ops.siteMobWeeks': { highway: 1, seasonalRoad: 1, winterTrail: 2, flyIn: 2 },
  // §6 campPad 1.0 (byFeature.site) + road 0.5 (byFeature.road).
  'ops.siteFootprintAcres': 1.5,
  'ops.siteRoadAcres': 0.5,
  'ops.startupCrewHours': 120,
  'ops.winterizeCrewHours': 80,
  'ops.winterizeUsd': 3000,

  // ---- Earthworks and reclamation (7.13)
  // Anchors.
  'ops.swellOverburden': 1.3,
  'ops.swellGravel': 1.2,
  'ops.wasteDumpHeightFt': 20,
  'ops.backfillUsableFrac': 0.85,
  'ops.reclaimBackfillThreshold': 0.8,
  // ~16 D8-hours per backfilled acre.
  'ops.reclaimRegradeBcyPerAcre': 2400,
  'ops.topsoilRespreadBcyPerAcre': 800,
  'ops.pondCloseBcyPerAcre': 3000,
  'ops.siteReclaimBcyPerAcre': 1600,
  'ops.reclaimPushMult': 0.8,

  // ---- Bottlenecks, alerts and the tailings audit (7.8, 7.14, 7.16, 7.18)
  'ops.bottleneckMinShare': 0.05,
  'ops.coverageAlertWeeks': 2,
  'ops.alertPlantIdlePct': 0.25,
  // R3: $500–2,000.
  'ops.tailingsAuditUsd': 1200,
  'ops.tailingsAuditPlantOpHours': 6,
  'ops.tailingsAuditCvMax': 0.5,
  'ops.tailingsAuditCvMin': 0.15,
} as const satisfies TuningTable;
