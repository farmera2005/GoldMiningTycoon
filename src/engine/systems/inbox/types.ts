// §13 inbox slice of GameState (DESIGN §13 13.10, §2.2). Messages are §13's (collated in step 16 from the week's
// AlertSignals); PendingDecision records are §2's, stored here (`inbox.decisions`, sorted ids). P0 collation is a stub
// (no messages are created), so `messages` stays empty until §13's collation ships in P1.
import type { DecId, EntityRef, MsgId } from '../../core/ids';
import type { ClosedDecision, PendingDecision } from '../../actions/types';
import type { ExplainRef } from '../../explain/types';

export type Severity = 'info' | 'warning' | 'critical' | 'blocking';

/** §13 13.10 default taxonomy (owners emit; `listing.searchMatch` is a UI notice, not a message kind). */
export const ALERT_KINDS = [
  'cash.projectedNegative',
  'payroll.missed',
  'loan.paymentMissed',
  'vendor.stopSupply',
  'insurance.lapsed',
  'insurance.bound',
  'covenant.watch',
  'covenant.breach',
  'distress.stage',
  'reorg.planDue',
  'reorg.hearingSoon',
  'reorg.ruling',
  'reorg.paymentShort',
  'reorg.paymentMissed',
  'reorg.adequateProtectionUnpaid',
  'reorg.saleNotice',
  'reorg.trueUp',
  'reorg.completed',
  'obligation.dueSoon',
  'obligation.missed',
  'permit.decision',
  'permit.infoRequest',
  'inspection.result',
  'permit.conditionExceedance',
  'ops.plantIdleHigh',
  'ops.stripCoverageLow',
  'ops.waterLimited',
  'ops.freezeUpNotWinterized',
  'ops.cleanupOverdue',
  'ops.padFull',
  'ops.permitCapReached',
  'ops.fuelLow',
  'crew.noForeman',
  'ops.cleanupDone',
  'prospect.resultsReady',
  'prospect.classChanged',
  'prospect.programPaused',
  'prospect.sellerContradicted',
  'prospect.rigArriving',
  'listing.new',
  'listing.priceChanged',
  'claims.forfeitureList',
  'siteVisit.report',
  'machine.failure',
  'machine.pmOverdue',
  'shop.backlogHigh',
  'machine.symptom',
  'parts.arrived',
  'delivery.arrived',
  'auction.won',
  'auction.lost',
  'rental.dueSoon',
  'warranty.expiring',
  'lease.hourCapNear',
  'transport.stalled',
  'transport.windowClosing',
  'employee.quit',
  'employee.injury',
  'crew.moraleLow',
  'crew.leadHand',
  'staff.trainingDue',
  'staff.bonusVestSoon',
  'staff.recallDecision',
  'staff.layoffDecision',
  'controller.flag',
  'offer.received',
  'offer.countered',
  'offer.expired',
  'offer.bestAndFinal',
  'auction.closingSoon',
  'land.titleFinding',
  'land.disputeOpened',
  'land.inspectionEnding',
  'land.forcedSale',
  'land.courtSaleHearing',
  'auction.result',
  'land.diligenceReport',
  'lease.anniversarySoon',
  'staking.windowSoon',
  'season.phaseChange',
  'season.forecastUpdate',
  'weather.severe',
  'investor.request',
  'investor.stanceChanged',
  'event.started',
  'event.warning',
  'event.resolved',
  'competitor.offer',
  'gold.bigMove',
  'gold.buyerClosing',
  'gold.marginCall',
  'gold.theft',
  'forward.shortfallRisk',
  'gold.shipmentSettled',
  'scenario.milestone',
  'hr.explosivesLow',
  'hr.tsfFull',
  'hr.ventLimit',
  'hr.tollAllotmentCut',
  'hr.recoveryDrop',
  'hr.capexOverrun',
] as const;

export type AlertKind = (typeof ALERT_KINDS)[number];

/** §13's primary-button target for a message (placeholder shape until §13's inbox ships in P1). */
export interface SuggestedAction {
  labelKey: string;
  route?: string;
}

/** A signal emitted by a system in steps 1–16 (or at action time); §13 collates signals into messages. */
export interface AlertSignal {
  kind: AlertKind;
  severity: Exclude<Severity, 'blocking'>;
  /** level: re-emitted every week the condition holds; edge: a one-off happening. */
  trigger: 'level' | 'edge';
  dedupeKey: string;
  subject: EntityRef[];
  templateKey: string;
  params: Record<string, string | number>;
  dueTurn?: number;
  explain?: ExplainRef;
  action?: SuggestedAction;
  /**
   * The decision this signal announces (S12-2): collation links the message to it and makes the message blocking
   * when the decision blocks. An owner emits exactly one signal with every decision it creates.
   */
  decisionId?: DecId;
}

export interface InboxMessage {
  id: MsgId;
  kind: AlertKind;
  severity: Severity;
  status: 'open' | 'resolved' | 'answered' | 'defaulted';
  trigger: 'level' | 'edge';
  createdTurn: number;
  lastTurn: number;
  resolvedTurn?: number;
  count: number;
  dedupeKey: string;
  subject: EntityRef[];
  templateKey: string;
  params: Record<string, string | number>;
  dueTurn?: number;
  decisionId?: DecId;
  /** Copied from the latest signal on every re-emit, like `subject`, `params` and `dueTurn` (S12-11). */
  action?: SuggestedAction;
  explain?: ExplainRef;
}

export interface InboxSlice {
  messages: Record<MsgId, InboxMessage>;
  messageIds: MsgId[];
  /** Open decisions (§2.2). */
  decisions: Record<DecId, PendingDecision>;
  decisionIds: DecId[];
  /** Answered or defaulted decisions, pruned after game.alerts.inboxRetentionWeeks. */
  closedDecisions: Record<DecId, ClosedDecision>;
  closedDecisionIds: DecId[];
}

export function emptyInboxSlice(): InboxSlice {
  return { messages: {}, messageIds: [], decisions: {}, decisionIds: [], closedDecisions: {}, closedDecisionIds: [] };
}

const SEVERITY_RANK: Readonly<Record<Severity, number>> = { info: 0, warning: 1, critical: 2, blocking: 3 };

export function severityRank(s: Severity): number {
  return SEVERITY_RANK[s];
}
