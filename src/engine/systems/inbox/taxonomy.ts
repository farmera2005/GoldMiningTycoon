// The alert taxonomy (DESIGN §13 13.10; S12-12; P1 contract §4.13, §6): one row per `AlertKind` with its owning section,
// default severity (or 'rule' where the owner picks it by a stated rule), whether it re-emits while a condition holds
// ('level') or marks a happening ('edge'), the rules phase whose owner first emits it, and the tuning keys of its
// thresholds. `emitAlert` refuses a signal whose kind has no row, whose trigger differs from the row's, or whose kind
// belongs to a later phase than the game's rules; T21 cross-checks kinds ↔ taxonomy ↔ text templates ↔ emitters.
//
// Threshold keys are tuning keys by name. They are plain strings here because several arrive with the parallel data
// package (contract §9.1); the contract test checks that every P1 row's keys resolve in the base tuning.
import type { RulesPhase } from '../../state/types';
import { ALERT_KINDS, type AlertKind, type Severity } from './types';

export interface AlertTaxonomyRow {
  owner: number;
  severity: Exclude<Severity, 'blocking'> | 'rule';
  trigger: 'level' | 'edge';
  phase: RulesPhase;
  thresholdKeys: readonly string[];
}

const row = (
  owner: number,
  severity: AlertTaxonomyRow['severity'],
  trigger: AlertTaxonomyRow['trigger'],
  phase: RulesPhase,
  thresholdKeys: readonly string[] = [],
): AlertTaxonomyRow => ({ owner, severity, trigger, phase, thresholdKeys });

export const ALERT_TAXONOMY: Readonly<Record<AlertKind, AlertTaxonomyRow>> = {
  // §11 finance
  'cash.projectedNegative': row(11, 'rule', 'level', 1, ['finance.distress.watchWeeks']),
  'payroll.missed': row(11, 'critical', 'edge', 1),
  'loan.paymentMissed': row(11, 'critical', 'edge', 1),
  'vendor.stopSupply': row(11, 'critical', 'edge', 4),
  'insurance.lapsed': row(11, 'critical', 'edge', 4),
  'insurance.bound': row(11, 'info', 'edge', 2),
  'covenant.watch': row(11, 'warning', 'level', 4),
  'covenant.breach': row(11, 'critical', 'edge', 4),
  'distress.stage': row(11, 'critical', 'edge', 1),
  'reorg.planDue': row(11, 'rule', 'level', 4),
  'reorg.hearingSoon': row(11, 'rule', 'edge', 4),
  'reorg.ruling': row(11, 'rule', 'edge', 4),
  'reorg.paymentShort': row(11, 'rule', 'level', 4),
  'reorg.paymentMissed': row(11, 'critical', 'edge', 4),
  'reorg.adequateProtectionUnpaid': row(11, 'critical', 'level', 4),
  'reorg.saleNotice': row(11, 'info', 'edge', 4),
  'reorg.trueUp': row(11, 'info', 'edge', 4),
  'reorg.completed': row(11, 'info', 'edge', 4),
  // §6 permits (P1: the obligation ladder capped at info, S12-9)
  'obligation.dueSoon': row(6, 'rule', 'level', 1, [
    'game.alerts.obligationInfoWeeks',
    'game.alerts.obligationWarnWeeks',
    'game.alerts.obligationCriticalWeeks',
  ]),
  'obligation.missed': row(6, 'critical', 'edge', 1),
  'permit.decision': row(6, 'rule', 'edge', 2),
  'permit.infoRequest': row(6, 'rule', 'edge', 2),
  'inspection.result': row(6, 'rule', 'edge', 2),
  'permit.conditionExceedance': row(6, 'critical', 'level', 2),
  // §7 ops
  'ops.plantIdleHigh': row(7, 'warning', 'level', 1, ['ops.alertPlantIdlePct']),
  'ops.stripCoverageLow': row(7, 'warning', 'level', 1, ['ops.coverageAlertWeeks']),
  'ops.waterLimited': row(7, 'warning', 'level', 1),
  'ops.freezeUpNotWinterized': row(7, 'rule', 'level', 1),
  'ops.cleanupOverdue': row(7, 'warning', 'level', 1),
  'ops.padFull': row(7, 'warning', 'level', 1),
  'ops.permitCapReached': row(7, 'warning', 'level', 2),
  'ops.fuelLow': row(7, 'warning', 'level', 3),
  'crew.noForeman': row(8, 'warning', 'level', 1),
  'ops.cleanupDone': row(7, 'info', 'edge', 1),
  // §4 knowledge
  'prospect.resultsReady': row(4, 'rule', 'edge', 1),
  'prospect.classChanged': row(4, 'rule', 'edge', 1),
  'prospect.programPaused': row(4, 'warning', 'edge', 1),
  'prospect.sellerContradicted': row(4, 'info', 'edge', 1),
  'prospect.rigArriving': row(4, 'info', 'edge', 3),
  // §3 world
  'listing.new': row(3, 'info', 'edge', 1),
  'listing.priceChanged': row(3, 'info', 'edge', 1),
  'claims.forfeitureList': row(3, 'info', 'edge', 2),
  'siteVisit.report': row(3, 'info', 'edge', 1),
  // §9 fleet
  'machine.failure': row(9, 'rule', 'edge', 3),
  'machine.pmOverdue': row(9, 'rule', 'level', 3),
  'shop.backlogHigh': row(9, 'warning', 'level', 3),
  'machine.symptom': row(9, 'warning', 'edge', 3),
  'parts.arrived': row(9, 'info', 'edge', 3),
  'delivery.arrived': row(9, 'info', 'edge', 1),
  'auction.won': row(9, 'info', 'edge', 3),
  'auction.lost': row(9, 'info', 'edge', 3),
  'rental.dueSoon': row(9, 'info', 'level', 3),
  'warranty.expiring': row(9, 'info', 'level', 3),
  'lease.hourCapNear': row(9, 'warning', 'level', 3),
  'transport.stalled': row(9, 'warning', 'level', 1),
  'transport.windowClosing': row(9, 'warning', 'level', 1),
  // §8 staff
  'employee.quit': row(8, 'rule', 'edge', 1),
  'employee.injury': row(8, 'rule', 'edge', 2),
  'crew.moraleLow': row(8, 'warning', 'level', 1, ['game.alerts.moraleWarnAvg', 'game.alerts.moraleWarnKey']),
  'crew.leadHand': row(8, 'info', 'level', 1),
  'staff.trainingDue': row(8, 'warning', 'level', 2),
  'staff.bonusVestSoon': row(8, 'info', 'edge', 4),
  'staff.recallDecision': row(8, 'warning', 'edge', 1),
  'staff.layoffDecision': row(8, 'warning', 'edge', 1),
  'controller.flag': row(8, 'warning', 'edge', 4),
  // §5 land (and §9's equipment offers, P5)
  'offer.received': row(5, 'warning', 'edge', 5),
  'offer.countered': row(5, 'warning', 'edge', 5),
  'offer.expired': row(5, 'warning', 'edge', 5),
  'offer.bestAndFinal': row(5, 'warning', 'edge', 5),
  'auction.closingSoon': row(5, 'warning', 'edge', 5),
  'land.titleFinding': row(5, 'warning', 'edge', 5),
  'land.disputeOpened': row(5, 'warning', 'edge', 5),
  'land.inspectionEnding': row(5, 'info', 'edge', 2),
  'land.forcedSale': row(5, 'warning', 'edge', 4),
  'land.courtSaleHearing': row(5, 'warning', 'edge', 4),
  'auction.result': row(5, 'info', 'edge', 5),
  'land.diligenceReport': row(5, 'info', 'edge', 2),
  'lease.anniversarySoon': row(5, 'info', 'level', 1),
  'staking.windowSoon': row(5, 'warning', 'level', 2),
  'lease.defaultNotice': row(5, 'critical', 'edge', 1),
  'lease.terminated': row(5, 'warning', 'edge', 1),
  'lease.ended': row(5, 'info', 'edge', 1),
  'land.quickSaleClosed': row(5, 'info', 'edge', 1),
  'land.interestChanged': row(5, 'info', 'edge', 1),
  // §1 climate, company and investors
  'season.phaseChange': row(1, 'info', 'edge', 1),
  'season.forecastUpdate': row(1, 'info', 'edge', 1),
  'weather.severe': row(1, 'rule', 'edge', 1),
  'investor.request': row(1, 'warning', 'edge', 4),
  'investor.stanceChanged': row(1, 'warning', 'edge', 4),
  // §12 events and competitors
  'event.started': row(12, 'rule', 'edge', 3),
  'event.warning': row(12, 'info', 'edge', 3),
  'event.resolved': row(12, 'info', 'edge', 3),
  'competitor.offer': row(12, 'warning', 'edge', 5),
  // §10 gold
  'gold.bigMove': row(10, 'rule', 'edge', 5),
  'gold.buyerClosing': row(10, 'info', 'edge', 5),
  'gold.marginCall': row(10, 'critical', 'level', 5),
  'gold.theft': row(10, 'critical', 'edge', 5),
  'forward.shortfallRisk': row(10, 'warning', 'level', 5),
  'gold.shipmentSettled': row(10, 'info', 'edge', 5),
  // §1 scenarios
  'scenario.milestone': row(1, 'info', 'edge', 6),
  // §14 hard rock (P6, optional)
  'hr.explosivesLow': row(14, 'warning', 'level', 6),
  'hr.tsfFull': row(14, 'warning', 'level', 6),
  'hr.ventLimit': row(14, 'warning', 'level', 6),
  'hr.tollAllotmentCut': row(14, 'warning', 'level', 6),
  'hr.recoveryDrop': row(14, 'warning', 'level', 6),
  'hr.capexOverrun': row(14, 'warning', 'level', 6),
};

/** The taxonomy rows in `ALERT_KINDS` order. */
export function alertTaxonomyEntries(): [AlertKind, AlertTaxonomyRow][] {
  return ALERT_KINDS.map((k) => [k, ALERT_TAXONOMY[k]]);
}

/** The kinds a game under `rulesPhase` may emit, in `ALERT_KINDS` order. */
export function alertKindsInPhase(rulesPhase: RulesPhase): AlertKind[] {
  return ALERT_KINDS.filter((k) => ALERT_TAXONOMY[k].phase <= rulesPhase);
}
