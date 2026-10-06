// Shapes and DESIGN-stated ranges of the `game.*` keys (DESIGN §1 1.20, §2 2.16, §13 13.25). Scalars without an entry
// take the naming rules of tuning/index.ts `scalarRule`. Shared by the §1 package (season … scoring) and the inbox
// package (`game.alerts.*`) after P1 Wave 0.
import { z } from 'zod';
import { increasing, int, keyed, mixOf, nonNeg, nonNegInt, pos, posInt, prob, score } from '../common';
import { ECON_CLASSES } from '../world';

/** §1 1.4.1 climate templates that carry their own weather rows (northernYukon reads northernInterior's). */
export const WEATHER_TEMPLATES = ['northernInterior', 'temperateMountain', 'aridDesert'] as const;
/** §1 1.8 starts. */
export const STARTS = ['bootstrapper', 'backed', 'inheritor'] as const;

const week = z.number().int().min(1).max(52);
const month = z.number().int().min(1).max(12);
const weekPos = z.number().min(1).max(52);

/** One 1.12 input: its delta (§12 outcomes stay within ±15) and an optional cap in points per period. */
const reputationDelta = z
  .strictObject({
    delta: z.number().min(-15).max(15),
    cap: z.strictObject({ amount: pos, period: z.enum(['week', 'month', 'year']) }).optional(),
  })
  .refine((r) => r.cap === undefined || r.cap.amount >= Math.abs(r.delta), {
    message: 'a cap below one delta would truncate every entry',
  });

export const GAME_TUNING_SCHEMAS: Readonly<Record<string, z.ZodType>> = {
  // ---- §2 history, §1 calendar
  'game.history.weeklyKeep': posInt,
  'game.startCalendarYear': int.min(1900).max(2500), // §1 1.6 setup bounds
  // ---- §1 1.4.3 season roll: week numbers within the year
  'game.season.northernInterior.breakupMean': weekPos,
  'game.season.northernInterior.breakupMin': week,
  'game.season.northernInterior.breakupMax': week,
  'game.season.northernInterior.breakupDurMean': pos,
  'game.season.northernInterior.freezeMean': weekPos,
  'game.season.northernInterior.freezeMin': week,
  'game.season.northernInterior.freezeMax': week,
  'game.season.northernInterior.freezeDurMean': pos,
  'game.season.northernInterior.minOperatingWeeks': posInt,
  'game.season.northernInterior.maxOperatingWeeks': posInt,
  'game.season.aridDesert.monsoonStartMean': weekPos,
  'game.season.aridDesert.monsoonStartMin': week,
  'game.season.aridDesert.monsoonStartMax': week,
  'game.season.aridDesert.monsoonEndMean': weekPos,
  'game.season.aridDesert.monsoonEndMin': week,
  'game.season.aridDesert.monsoonEndMax': week,
  'game.season.expectedActiveWeeks.aridDesert': z.number().int().min(1).max(52),
  // ---- §1 1.5 weather
  'game.weather.tempPersistence': prob,
  'game.weather.moistPersistence': prob,
  'game.weather.wetnessWeight': prob,
  'game.weather.wetnessYearPersistence': prob,
  'game.weather.flowPersistence': prob,
  'game.weather.flowPrecipGain': prob,
  'game.weather.flowAnomSens': nonNeg,
  'game.weather.flowWetnessSens': nonNeg,
  'game.weather.droughtDecay': prob,
  'game.weather.stormSpike': keyed(WEATHER_TEMPLATES, pos),
  'game.weather.fireLevelThresholds': increasing(prob, 4),
  'game.weather.fireSeasonFactor': keyed(WEATHER_TEMPLATES, z.array(prob).length(12)),
  // ---- §1 1.4.5 access
  'game.access.winterTrailOpenWeek': week,
  // ---- §1 1.9 owner
  'game.owner.deskDaysOffice': z.number().min(0).max(7),
  'game.owner.deskDaysField': z.number().min(0).max(7),
  'game.ownerLoanRate': prob,
  // ---- §1 1.8 starts
  'game.start.bootstrapper.companyCashUsd': nonNeg,
  'game.start.bootstrapper.personalCashUsd': nonNeg,
  ...Object.fromEntries(STARTS.map((s) => [`game.start.${s}.personalCreditScore`, z.number().int().min(300).max(850)])),
  ...Object.fromEntries(STARTS.map((s) => [`game.start.${s}.reputation`, score])),
  'game.start.regulatorStandingStart': score,
  // ---- §1 1.8.1 investor terms
  'game.investor.equityPct': prob,
  'game.investor.prefRate': prob,
  'game.investor.royaltyRate': prob,
  'game.investor.royaltyPaybackMultiple': pos,
  'game.investor.royaltyTailRate': prob,
  // ---- §1 1.8.2 Inheritor
  'game.inheritorTierWeights': mixOf(ECON_CLASSES),
  'game.inheritorDepletionAdd': prob,
  'game.inheritor.preStrippedBlocks': nonNegInt,
  // §11 PaymentScheduleKind.
  'game.inheritor.noteSchedule': z.enum([
    'level',
    'skip',
    'seasonal',
    'interestOnlyOffSeason',
    'interestOnly',
    'weeklyDebit',
    'revolving',
  ]),
  'game.inheritor.noteRate': prob,
  'game.inheritor.noteTermMonths': posInt,
  'game.inheritor.notePayMonths': increasing(month),
  'game.inheritor.fuelApDueWeek': week,
  'game.inheritor.planHeadroomAcres': nonNeg,
  'game.inheritor.regulatorStandingStart': score,
  // ---- §1 1.12 reputation
  'game.reputation.decayPerWeek': prob,
  'game.reputation.sponsorCapPerYear': nonNegInt,
  'game.reputation.delta': z.record(z.string().regex(/^[a-z][A-Za-z0-9]*(\.[a-z][A-Za-z0-9]*)*$/), reputationDelta),
  // ---- §1 1.13, 1.14 scoring and the end report
  'game.nw.partsResaleFactor': prob, // §1 1.13: parts count at a share of book
  'game.endReport.timelineMaxEntries': posInt,
  // ---- §13 13.25 alerts
  'game.alerts.inboxRetentionWeeks': posInt,
  'game.alerts.dedupeWindowWeeks': posInt,
  'game.alerts.moraleWarnAvg': score,
  'game.alerts.moraleWarnKey': score,
};
