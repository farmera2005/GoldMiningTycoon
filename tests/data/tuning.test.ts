import { describe, expect, it } from 'vitest';
import { difficultyTable } from '../../src/data/difficulty';
import { baseTuning, tuningNamespaces, type TuningValue } from '../../src/data/tuning';
import { TUNING_SCHEMAS_BY_NAMESPACE } from './schemas';

const BASE: Readonly<Record<string, TuningValue>> = baseTuning;
const has = (rec: object, key: string): boolean => Object.prototype.hasOwnProperty.call(rec, key);
const n = (key: string): number => {
  const v = BASE[key];
  if (typeof v !== 'number') throw new Error(`${key} is not a number`);
  return v;
};

// DESIGN §2.10: every key is namespaced and appears in exactly one namespace file.
describe('tuning tables', () => {
  it('prefixes every key with its namespace and never repeats a key', () => {
    const seen = new Set<string>();
    for (const [ns, table] of Object.entries(tuningNamespaces)) {
      for (const key of Object.keys(table)) {
        expect(key.startsWith(`${ns}.`), `${key} must start with ${ns}.`).toBe(true);
        expect(seen.has(key), `${key} appears twice`).toBe(false);
        seen.add(key);
      }
    }
  });

  it('keeps each namespace’s shapes in that namespace’s schema file (P1 contract §0.3)', () => {
    for (const [ns, schemas] of Object.entries(TUNING_SCHEMAS_BY_NAMESPACE)) {
      expect(has(tuningNamespaces, ns), ns).toBe(true);
      for (const key of Object.keys(schemas)) expect(key.startsWith(`${ns}.`), `${key} in ${ns}'s file`).toBe(true);
    }
  });
});

/**
 * P1 contract §9.1: the keys P1 Wave 0 adds (read outside their owner, difficulty-scaled, hook bases, ruling keys and
 * every P1 `game.*` key), with DESIGN's defaults. fleet.* rows are fleet-catalog's (§9 9.15) and are not listed here.
 * After Wave 0 a value changes only through a logged retune (src/data/tuning/CHANGELOG.md) that updates DESIGN's table
 * and this list together.
 */
const CONTRACT_91: Readonly<Record<string, TuningValue>> = {
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
  'game.season.aridDesert.monsoonStartMean': 27,
  'game.season.aridDesert.monsoonStartSd': 1.2,
  'game.season.aridDesert.monsoonStartMin': 24,
  'game.season.aridDesert.monsoonStartMax': 30,
  'game.season.aridDesert.monsoonEndMean': 38,
  'game.season.aridDesert.monsoonEndSd': 1.5,
  'game.season.aridDesert.monsoonEndMin': 35,
  'game.season.aridDesert.monsoonEndMax': 41,
  'game.season.sigmaMult': 1.0,
  'game.season.freezeUpMeanShift': 0,
  'game.season.expectedActiveWeeks.aridDesert': 46,
  'game.weather.tempPersistence': 0.55,
  'game.weather.moistPersistence': 0.5,
  'game.weather.wetnessWeight': 0.4,
  'game.weather.wetnessYearPersistence': 0.4,
  'game.weather.flowPersistence': 0.75,
  'game.weather.flowPrecipGain': 0.25,
  'game.weather.flowAnomSens': 0.3,
  'game.weather.flowWetnessSens': 0.2,
  'game.weather.droughtDecay': 0.8,
  'game.weather.stormSpike': { northernInterior: 1.6, temperateMountain: 1.8, aridDesert: 4.0 },
  'game.weather.fireLevelThresholds': [0.4, 0.6, 0.75, 0.92],
  'game.access.winterTrailOpenWeek': 2,
  'game.access.winterTrailCloseLeadWeeks': 5,
  'game.access.winterTrailFreezeLagWeeks': 8,
  'game.access.aridWashoutWeeks': 1,
  'game.entity.soleProp.formationUsd': 0,
  'game.entity.llc.formationUsd': 1200,
  'game.entity.corp.formationUsd': 2500,
  'game.entity.soleProp.annualUsd': 0,
  'game.entity.llc.annualUsd': 550,
  'game.entity.corp.annualUsd': 850,
  'game.owner.deskDaysOffice': 5,
  'game.owner.deskDaysField': 2.5,
  'game.ownerLoanRate': 0.06,
  'game.ownerReasonableSalaryCapUsd': 150000,
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
  'game.start.regulatorStandingStart': 60,
  'game.inheritor.regulatorStandingStart': 55,
  'game.investor.equityContributionUsd': 1300000,
  'game.investor.equityPct': 0.4,
  'game.investor.prefRate': 0.08,
  'game.investor.royaltyContributionUsd': 900000,
  'game.investor.royaltyRate': 0.1,
  'game.investor.royaltyPaybackMultiple': 2.0,
  'game.investor.royaltyTailRate': 0.03,
  'game.investor.royaltyMinimumUsd': 100000,
  'game.investor.approvalThresholdUsd': 100000,
  'game.inheritorTierWeights': { excellent: 0.07, good: 0.3, marginal: 0.38, uneconomic: 0.25 },
  'game.inheritorDepletionAdd': 0.1,
  'game.inheritorDebtMult': 1.0,
  'game.inheritor.preStrippedBlocks': 2,
  'game.inheritor.noteSchedule': 'seasonal',
  'game.inheritor.notePrincipalUsd': 320000,
  'game.inheritor.noteRate': 0.085,
  'game.inheritor.noteTermMonths': 84,
  'game.inheritor.notePayMonths': [6, 7, 8, 9, 10, 11],
  'game.inheritor.fuelApUsd': 12000,
  'game.inheritor.fuelApDueWeek': 4,
  'game.inheritor.estateAppraisalUsd': 120000,
  'game.inheritor.formerHandAskUsdPerHr': 34,
  'game.inheritor.planHeadroomAcres': 5,
  'game.reputation.decayPerWeek': 0.005,
  'game.reputation.sponsorUsdPerPoint': 5000,
  'game.reputation.sponsorCapPerYear': 2,
  'game.reputation.sponsorMinUsd': 2500,
  'game.scoreMult': 1.0,
  'game.endReport.timelineMinUsd': 50000,
  'game.endReport.timelineMaxEntries': 200,
  'game.alerts.dedupeWindowWeeks': 4,
  'game.alerts.obligationInfoWeeks': 8,
  'game.alerts.obligationWarnWeeks': 4,
  'game.alerts.obligationCriticalWeeks': 1,
  'game.alerts.moraleWarnAvg': 40,
  'game.alerts.moraleWarnKey': 30,
  'ops.goldRoomDirtFrac.noTable': 0.04,
  'ops.goldRoomDirtFrac.table': 0.02,
  'ops.noForemanEfficiency': 0.92,
  'ops.p1MechAvailability': 0.92,
  'ops.heat.thresholdF': 80,
  'ops.heat.slopePerF': 0.03,
  'ops.heat.floor': 0.55,
  'ops.heat.nightMult': 0.95,
  'ops.fireLevelHoursMult': { 1: 0.97, 2: 0.97, 4: 0 },
  'ops.fireLevel3DayShiftMaxHours': 8,
  'staff.ownerOpsSkillByBackground': { operator: 85, default: 40 },
  'staff.ownerMechanicSkill': 85,
  'staff.ownerShopHoursPerWeek': 50,
  'staff.ownerInspectionsPerWeek': 2,
  'staff.ownerLandSpecialistSkill': 80,
  'staff.ownerSafety': 60,
  'staff.foremanMaxLines': 2,
  'staff.smallCrewMaxNoForeman': 3,
  'staff.noForemanIncidentMult': 1.15,
  'staff.crewPerCook': 12,
  'staff.poolSizeMult': 1.0,
  'staff.wageAskMult': 1.0,
  'staff.quitHazardMult': 1.0,
  'staff.resumeBiasMult': 1.0,
  'staff.safetyRecord.start': 50,
  'staff.absence.base': 0.02,
  'land.askMarkup': 0.3,
  'land.leaseCureWeeks': 4,
  'land.quickSaleFrac': 0.6,
  'land.valCapitalChargePerBcy': 4.0,
  'land.p1LandmanPriceMult': 0.925,
  'land.p1LandmanRoyaltyPointsOff': 0.01,
  'permits.fed.processingFeeUsd': 25,
  'permits.fed.locationFeeUsd': 49,
  'permits.fed.maintenanceFeePerUnitUsd': 200,
  'permits.fed.countyRecordingFeePerClaimUsd': 12,
  'permits.fed.transferFeePerClaimUsd': 15,
  'permits.fed.affidavitFeePerClaimUsd': 15,
  'permits.fed.recordingWindowWeeks': 13,
  'permits.fed.unitAcres': 20,
  'finance.p1InsolvencyGraceWeeks': 6,
  'finance.distress.watchWeeks': 4,
  'finance.p1PayrollTaxRate': 0.14,
  'finance.p1WcRate': 0.08,
  'finance.primeSpread': 0.03,
  'finance.defaultOperatingTargetUsd': 25000,
  'finance.p1BankerLoanUsd': 150000,
  'finance.p1BankerLoanSpread': 0.02,
  'finance.p1BankerLoanTermMonths': 60,
  'events.frequencyMult': 1.0,
  'events.severityMult': 1.0,
  'events.budgetPerHalf': 24,
  'events.catastropheEarliestTurn': 26,
  'events.distressMercyMult': 0.6,
};

/** Keys the P1 rulings introduced (P1 plan §4 W0-3; DESIGN's tuning tables carry them since docs-rulings). */
const RULING_KEYS: readonly string[] = [
  // s03 #7 (D-3.67)
  'geology.siteVisit.driftDetectP',
  'geology.siteVisit.snowFindMult',
  'geology.siteVisit.permafrostIndicatorP',
  'geology.siteVisit.flowNoiseFrac',
  'geology.siteVisit.boulderNoiseSd',
  // s03 #16 (D-3.73)
  'geology.inheritor.seasonBcy',
  'geology.inheritor.seasons',
  'geology.inheritor.tierCdvUsd',
  'geology.inheritor.kBounds',
  'geology.inheritor.bisectionSteps',
  'geology.inheritor.ledgerMult',
  'geology.inheritor.filedSeasonP',
  'geology.inheritor.pitLogCount',
  'geology.inheritor.preStripThawFt',
  'geology.inheritor.bondUsd',
  'geology.seller.plan',
  'geology.seller.oldReport',
  'geology.seller.beliefBlocksMult',
  'geology.seller.optTransforms',
  'geology.seller.cherryScrapes',
  'geology.seller.fraudSamples',
  'geology.seller.fraudFineNoteP',
  'geology.seller.fraudHistoryMult',
  'geology.seller.fraudInventedSeasons',
  'geology.seller.permitStatement',
  // s04 #3 (D-4.61)
  'geology.pilePrior.logSd',
  'geology.pilePrior.volumeFrac',
  // s07 #18 (D-7.66), s07 #19 (D-7.67)
  'ops.freezeupPlantMult',
  'ops.freezeupPlantMultByBand',
  'ops.nightLightFreeWeeksNorth',
  'ops.cementationStripSlope',
  // S10-11 (D-10.54)
  'market.localBuyer.repHighMin',
  'market.localBuyer.repLowMax',
  // s01 #4 (D-1.71)
  'game.weather.fireSeasonFactor',
  // s05 #27: the federal fee keys are in CONTRACT_91; the notice cap is the base of permits.noticeMaxAcresSet
  'permits.noticeMaxAcres',
];

describe('P1 Wave 0 keys (P1 contract §9.1, §9.2; the rulings)', () => {
  it('holds every §9.1 key with its DESIGN default', () => {
    for (const [key, value] of Object.entries(CONTRACT_91)) {
      expect(has(BASE, key), `${key} is missing`).toBe(true);
      expect(BASE[key], key).toEqual(value);
    }
  });

  it('holds every key a P1 ruling introduced, and none that one removed', () => {
    for (const key of RULING_KEYS) expect(has(BASE, key), key).toBe(true);
    // s01 #4: one F_m table per template replaces the arid factor.
    expect(has(BASE, 'game.weather.aridFireFactor')).toBe(false);
    const fm = BASE['game.weather.fireSeasonFactor'] as Readonly<Record<string, readonly number[]>>;
    expect(fm['aridDesert']?.slice(4, 7)).toEqual([0.46, 0.5, 0.47]); // May / Jun / Jul (D-1.30)
  });

  it('has a difficulty row for every §9.2 key', () => {
    const rows9_2 = [
      'game.season.sigmaMult',
      'game.season.freezeUpMeanShift',
      'game.inheritorDebtMult',
      'game.scoreMult',
      'land.askMarkup',
      'land.leaseCureWeeks',
      'staff.poolSizeMult',
      'staff.wageAskMult',
      'staff.quitHazardMult',
      'staff.resumeBiasMult',
      'finance.p1InsolvencyGraceWeeks',
      'finance.distress.watchWeeks',
      'events.frequencyMult',
      'events.severityMult',
      'events.budgetPerHalf',
      'events.catastropheEarliestTurn',
      'events.distressMercyMult',
    ];
    for (const key of rows9_2) expect(has(difficultyTable, key), key).toBe(true);
  });
});

describe('cross-key consistency of the P1 Wave 0 keys', () => {
  it('season roll: min ≤ mean ≤ max, and the operating-week clamps hold the template mean (§1 1.4.3)', () => {
    for (const [tpl, names] of [
      ['northernInterior', ['breakup', 'freeze']],
      ['aridDesert', ['monsoonStart', 'monsoonEnd']],
    ] as const) {
      for (const p of names) {
        const k = (f: string): number => n(`game.season.${tpl}.${p}${f}`);
        expect(k('Min'), `${tpl}.${p}`).toBeLessThanOrEqual(k('Mean'));
        expect(k('Mean'), `${tpl}.${p}`).toBeLessThanOrEqual(k('Max'));
      }
    }
    const north = (f: string): number => n(`game.season.northernInterior.${f}`);
    const meanLength = north('freezeMean') - north('breakupMean') - north('breakupDurMean');
    expect(north('minOperatingWeeks')).toBeLessThanOrEqual(meanLength);
    expect(meanLength).toBeLessThanOrEqual(north('maxOperatingWeeks'));
    expect(n('game.season.aridDesert.monsoonStartMax')).toBeLessThan(n('game.season.aridDesert.monsoonEndMin'));
  });

  it('owner, Inheritor note and investor terms are coherent (§1 1.8, 1.9)', () => {
    expect(n('game.owner.deskDaysField')).toBeLessThanOrEqual(n('game.owner.deskDaysOffice'));
    const payMonths = BASE['game.inheritor.notePayMonths'] as readonly number[];
    expect(payMonths).toHaveLength(6); // Jun–Nov: $10,281.75 in each (1.22)
    expect(n('game.investor.royaltyTailRate')).toBeLessThan(n('game.investor.royaltyRate'));
    // §6 allows the Inheritor's start standing 50–65.
    expect(n('game.inheritor.regulatorStandingStart')).toBeGreaterThanOrEqual(50);
    expect(n('game.inheritor.regulatorStandingStart')).toBeLessThanOrEqual(65);
  });

  it('the obligation alert ladder narrows toward the due week (§13 13.25)', () => {
    expect(n('game.alerts.obligationCriticalWeeks')).toBeLessThan(n('game.alerts.obligationWarnWeeks'));
    expect(n('game.alerts.obligationWarnWeeks')).toBeLessThan(n('game.alerts.obligationInfoWeeks'));
    expect(n('game.alerts.moraleWarnKey')).toBeLessThan(n('game.alerts.moraleWarnAvg'));
  });

  it('the local buyer’s reputation thresholds leave a neutral band (§10 10.10, S10-11)', () => {
    expect(n('market.localBuyer.repLowMax')).toBeLessThan(n('market.localBuyer.repHighMin'));
  });

  it('the reputation table carries every P1 input with 1.12’s delta and cap (D-1.85)', () => {
    type Rep = { delta: number; cap?: { amount: number; period: string } };
    const rep = BASE['game.reputation.delta'] as unknown as Readonly<Record<string, Rep>>;
    const p1: Readonly<Record<string, Rep>> = {
      missedPayroll: { delta: -8, cap: { amount: 8, period: 'week' } },
      partialPayroll: { delta: -4, cap: { amount: 4, period: 'week' } },
      royaltyPaidInFull: { delta: 0.5, cap: { amount: 3, period: 'year' } },
      missedAdvanceRoyalty: { delta: -5 },
      leaseTerminatedDefault: { delta: -8 },
      dealClosed: { delta: 1, cap: { amount: 3, period: 'year' } },
      firings3InWeek: { delta: -2 },
      seasonProduction: { delta: 3, cap: { amount: 3, period: 'year' } },
      recordYear: { delta: 2, cap: { amount: 2, period: 'year' } },
      sponsorship: { delta: 1, cap: { amount: 2, period: 'year' } },
    };
    for (const [kind, row] of Object.entries(p1)) expect(rep[kind], kind).toEqual(row);
    // The kinds 1.12 names explicitly keep their DESIGN spelling (§1 D-1.61, §8 8.18's checklist, §12).
    for (const kind of ['reorgFiled', 'reorgCompleted', 'lowballWalk', 'staff.bonusCutMidSeason', 'event.mediaStory'])
      expect(rep[kind], kind).toBeDefined();
  });
});
