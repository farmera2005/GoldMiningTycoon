// `game.*` tuning constants (DESIGN §1 1.20, §2 2.16, §13 13.25 `game.alerts.*`). Keys must start with 'game.'.
// game.ts is shared by §1 (season, weather, access, entity, start, investor, Inheritor, reputation, scoring), §2
// (history) and §13 (alerts). P1 Wave 0 (contracts-data) wrote every P1 `game.*` key of P1 contract §9.1 with its
// DESIGN default; values marked §1.20 are in DESIGN's table, the rest cite the subsection that states them.
import type { TuningTable } from './types';

/** A reputation input's delta and its optional cap: at most `amount` points (absolute) per `period` (§1 1.12). */
type RepDelta = { readonly delta: number; readonly cap?: { readonly amount: number; readonly period: string } };

export const gameTuning = {
  // §2 2.16: the weekly history ring holds turns t − weeklyKeep … t (157 entries).
  'game.history.weeklyKeep': 156,
  // §1 1.3: display year = startCalendarYear + year − 1. The setup's world.startCalendarYear overrides it (§1 1.6).
  'game.startCalendarYear': 2027,

  // ---- Season roll (§1 1.4.3; 1.20). One key per template parameter; P6 templates add their own rows.
  'game.season.northernInterior.breakupMean': 18.5,
  'game.season.northernInterior.breakupSd': 1.0,
  'game.season.northernInterior.breakupMin': 16,
  'game.season.northernInterior.breakupMax': 22,
  'game.season.northernInterior.breakupDurMean': 1.4,
  'game.season.northernInterior.breakupDurSd': 0.6,
  'game.season.northernInterior.freezeMean': 42.0,
  'game.season.northernInterior.freezeSd': 1.4,
  'game.season.northernInterior.freezeMin': 38,
  'game.season.northernInterior.freezeMax': 46,
  'game.season.northernInterior.freezeDurMean': 2.0,
  'game.season.northernInterior.freezeDurSd': 0.6,
  'game.season.northernInterior.minOperatingWeeks': 17,
  'game.season.northernInterior.maxOperatingWeeks': 27,
  // Arid monsoon window (1.4.3, D-1.70): clamp(round(27 + 1.2·n3), 24, 30) and clamp(round(38 + 1.5·n4), 35, 41).
  'game.season.aridDesert.monsoonStartMean': 27,
  'game.season.aridDesert.monsoonStartSd': 1.2,
  'game.season.aridDesert.monsoonStartMin': 24,
  'game.season.aridDesert.monsoonStartMax': 30,
  'game.season.aridDesert.monsoonEndMean': 38,
  'game.season.aridDesert.monsoonEndSd': 1.5,
  'game.season.aridDesert.monsoonEndMin': 35,
  'game.season.aridDesert.monsoonEndMax': 41,
  // Difficulty-scaled (§1 1.11 via data/difficulty.ts): multiplies every season-date sd; shifts the freeze-up mean.
  'game.season.sigmaMult': 1.0,
  'game.season.freezeUpMeanShift': 0,
  // 1.5.6: 52 weeks minus the measured ≈ 6 heat/fire/storm weeks; §6 spreads annual inspection rates over it.
  'game.season.expectedActiveWeeks.aridDesert': 46,

  // ---- Weekly weather (§1 1.5.2–1.5.5; 1.20)
  'game.weather.tempPersistence': 0.55,
  'game.weather.moistPersistence': 0.5,
  'game.weather.wetnessWeight': 0.4,
  'game.weather.wetnessYearPersistence': 0.4,
  'game.weather.flowPersistence': 0.75,
  'game.weather.flowPrecipGain': 0.25,
  'game.weather.flowAnomSens': 0.3,
  'game.weather.flowWetnessSens': 0.2,
  'game.weather.droughtDecay': 0.8,
  // 1.5.4: storm-week stream-flow spike by climate template (arid flash floods).
  'game.weather.stormSpike': { northernInterior: 1.6, temperateMountain: 1.8, aridDesert: 4.0 },
  // 1.5.5: fireDanger cut points of restriction levels 1–4 (R2: USFS IFPL I–IV).
  'game.weather.fireLevelThresholds': [0.4, 0.6, 0.75, 0.92],
  // 1.5.1 F_m by month (Jan…Dec), one table per template; northernYukon reads northernInterior's (1.4.1). Replaces
  // the old game.weather.aridFireFactor (D-1.71, s01 #4); arid is calibrated (L ≥ 3 ≈ 1.9 wk/yr, D-1.30).
  'game.weather.fireSeasonFactor': {
    northernInterior: [0, 0, 0, 0.05, 0.4, 0.75, 0.75, 0.45, 0.15, 0, 0, 0],
    aridDesert: [0.15, 0.15, 0.2, 0.3, 0.46, 0.5, 0.47, 0.4, 0.4, 0.3, 0.2, 0.15],
    temperateMountain: [0, 0, 0, 0.05, 0.2, 0.45, 0.8, 0.85, 0.6, 0.3, 0, 0],
  },

  // ---- Access windows (§1 1.4.5; 1.20)
  'game.access.winterTrailOpenWeek': 2,
  'game.access.winterTrailCloseLeadWeeks': 5,
  'game.access.winterTrailFreezeLagWeeks': 8,
  'game.access.aridWashoutWeeks': 1,

  // ---- Entity (§1 1.6; 1.20). Formation billed in 14c of turn 1, annual fee in 14c of every week-13 turn (D-1.69).
  'game.entity.soleProp.formationUsd': 0,
  'game.entity.llc.formationUsd': 1200,
  'game.entity.corp.formationUsd': 2500,
  'game.entity.soleProp.annualUsd': 0,
  'game.entity.llc.annualUsd': 550,
  'game.entity.corp.annualUsd': 850,

  // ---- Owner (§1 1.9; 1.20)
  'game.owner.deskDaysOffice': 5,
  'game.owner.deskDaysField': 2.5,
  'game.ownerLoanRate': 0.06,
  'game.ownerReasonableSalaryCapUsd': 150000,

  // ---- Start table (§1 1.8, D-1.42, D-1.64, D-1.70). Difficulty reaches cash only through the two multipliers.
  'game.start.bootstrapper.companyCashUsd': 400000,
  'game.start.bootstrapper.personalCashUsd': 120000,
  // §1 1.11 difficulty multipliers on starting cash (1.25 / 1.0 / 0.85 and 1.1 / 1.0 / 0.9 via data/difficulty.ts).
  'game.startCompanyCashMult': 1.0,
  'game.startPersonalCashMult': 1.0,
  'game.start.backed.ownerCapitalUsd': 200000,
  'game.start.backed.personalCashUsd': 50000,
  'game.start.inheritor.companyCashUsd': 300000,
  'game.start.inheritor.personalCashUsd': 40000,
  'game.start.bootstrapper.personalCreditScore': 760,
  'game.start.backed.personalCreditScore': 720,
  'game.start.inheritor.personalCreditScore': 680,
  'game.start.bootstrapper.reputation': 45,
  'game.start.backed.reputation': 50,
  'game.start.inheritor.reputation': 55,
  // Consumed from P2 (§6); the Inheritor's own start is game.inheritor.regulatorStandingStart.
  'game.start.regulatorStandingStart': 60,

  // ---- Backed investor terms (§1 1.8.1; 1.20)
  'game.investor.equityContributionUsd': 1300000,
  'game.investor.equityPct': 0.4,
  'game.investor.prefRate': 0.08,
  'game.investor.royaltyContributionUsd': 900000,
  'game.investor.royaltyRate': 0.1,
  'game.investor.royaltyPaybackMultiple': 2.0,
  'game.investor.royaltyTailRate': 0.03,
  'game.investor.royaltyMinimumUsd': 100000,
  'game.investor.approvalThresholdUsd': 100000,

  // ---- Inheritor (§1 1.8.2; 1.20; IR-2 / D-1.70 naming). §3's generation constants are geology.inheritor.*.
  'game.inheritorTierWeights': { excellent: 0.07, good: 0.3, marginal: 0.38, uneconomic: 0.25 },
  'game.inheritorDepletionAdd': 0.1,
  'game.inheritorDebtMult': 1.0,
  'game.inheritor.preStrippedBlocks': 2,
  'game.inheritor.noteSchedule': 'seasonal',
  'game.inheritor.notePrincipalUsd': 320000,
  'game.inheritor.noteRate': 0.085,
  'game.inheritor.noteTermMonths': 84,
  // Reporting months June–November carry the seasonal note's payments.
  'game.inheritor.notePayMonths': [6, 7, 8, 9, 10, 11],
  'game.inheritor.fuelApUsd': 12000,
  'game.inheritor.fuelApDueWeek': 4,
  'game.inheritor.estateAppraisalUsd': 120000,
  'game.inheritor.formerHandAskUsdPerHr': 34,
  'game.inheritor.planHeadroomAcres': 5,
  'game.inheritor.regulatorStandingStart': 55,

  // ---- Reputation (§1 1.12; 1.20)
  'game.reputation.decayPerWeek': 0.005,
  'game.reputation.sponsorUsdPerPoint': 5000,
  'game.reputation.sponsorCapPerYear': 2,
  'game.reputation.sponsorMinUsd': 2500,
  // 1.12 as data (D-1.85): the keys are the ReputationKind union. A cap is the most points (absolute) the kind may
  // move per period; a delta that would exceed it is truncated. Names DESIGN writes are kept as written
  // (`reorgFiled`, `lowballWalk`, `staff.bonusCutMidSeason`, `event.complaintAnswered`, …); §12's per-outcome kinds
  // (`event.<id>.<outcome>`, within ±15) come from §12's catalog, not from this table.
  'game.reputation.delta': {
    // §11 payroll (P1)
    missedPayroll: { delta: -8, cap: { amount: 8, period: 'week' } },
    partialPayroll: { delta: -4, cap: { amount: 4, period: 'week' } },
    // §11 vendors and loans (P4)
    vendorBillLate: { delta: -1, cap: { amount: 4, period: 'month' } },
    vendorStopSupply: { delta: -3 },
    loanDefaultNotice: { delta: -6 },
    repossession: { delta: -8 },
    // §11 reorganization (P4, D-1.61)
    reorgFiled: { delta: -10 },
    reorgCompleted: { delta: 3 },
    // §1 week 52 (P1): a season with ≥ 100 fine oz recovered; a record production year
    seasonProduction: { delta: 3, cap: { amount: 3, period: 'year' } },
    recordYear: { delta: 2, cap: { amount: 2, period: 'year' } },
    // §5 royalties, leases and deals (P1)
    royaltyPaidInFull: { delta: 0.5, cap: { amount: 3, period: 'year' } },
    missedAdvanceRoyalty: { delta: -5 },
    leaseTerminatedDefault: { delta: -8 },
    dealClosed: { delta: 1, cap: { amount: 3, period: 'year' } },
    acceptedThenFailed: { delta: -5 },
    lowballWalk: { delta: -0.5 },
    // §6 reclamation and violations (P2)
    acreReclaimed: { delta: 0.5, cap: { amount: 4, period: 'year' } },
    claimAbandonedUnreclaimed: { delta: -10 },
    bondForfeited: { delta: -8 },
    violation: { delta: -1 },
    violationSignificant: { delta: -2 },
    violationStopWork: { delta: -4 },
    // §8 safety, firings and bonuses (firings P1; injuries P2; bonuses P4)
    seriousInjury: { delta: -3 },
    fatality: { delta: -10 },
    firings3InWeek: { delta: -2 },
    bonusesPaidInFull: { delta: 1 },
    'staff.bonusCutMidSeason': { delta: -1 },
    'staff.layoffWithoutProRata': { delta: -1, cap: { amount: 3, period: 'year' } },
    // §12 community and crew outcomes (P3+)
    'event.complaintAnswered': { delta: 1, cap: { amount: 2, period: 'year' } },
    'event.complaintIgnored': { delta: -1 },
    'event.mediaStory': { delta: -3 },
    'event.concealmentCaught': { delta: -15 },
    'event.crewReplaced': { delta: -3 },
    // §1 community sponsorship (P1): $5k per point, at least game.reputation.sponsorMinUsd
    sponsorship: { delta: 1, cap: { amount: 2, period: 'year' } },
  } satisfies Readonly<Record<string, RepDelta>>,

  // ---- Scoring and the end report (§1 1.13, 1.14; 1.20)
  // §1 1.13: parts inventory counts at 60% of book in scoring net worth.
  'game.nw.partsResaleFactor': 0.6,
  'game.scoreMult': 1.0,
  'game.endReport.timelineMinUsd': 50000,
  'game.endReport.timelineMaxEntries': 200,

  // ---- Alerts (§13 13.25; S12-16: §8 reads the two morale keys)
  'game.alerts.dedupeWindowWeeks': 4,
  // §13 13.10 collation: closed inbox records are dropped this many weeks after they close.
  'game.alerts.inboxRetentionWeeks': 104,
  // The obligation ladder, counted from dueTurn − prepLeadWeeks.
  'game.alerts.obligationInfoWeeks': 8,
  'game.alerts.obligationWarnWeeks': 4,
  'game.alerts.obligationCriticalWeeks': 1,
  'game.alerts.moraleWarnAvg': 40,
  'game.alerts.moraleWarnKey': 30,
} as const satisfies TuningTable;
