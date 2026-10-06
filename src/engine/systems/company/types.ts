// §1 company and owner slice of GameState (DESIGN §1 1.8.1, 1.9, 1.12, 1.14, 1.18 `CompanySlice`; P1 contract §4.2).
// Every field of 1.18 ships from P1 with an inert initial value (§2 D-2.60), so P2–P4 add behaviour, not fields:
// `pendingEntity` stays null and `scenario` null (sandbox) in P1; guarantees are inert until P4. The owner-book balances
// (personal cash, personal debt, guarantees due, tax due, the loan to the company) are not stored here: §11 publishes
// them over the owner book (D-1.73).
import type { Cents } from '../../core/money';
import type {
  ClaimId,
  DistrictId,
  EntityRef,
  Id,
  InvestorAgreementId,
  LoanId,
  MachineId,
  ObligationId,
  ProductionInterestId,
  ProgramId,
  ReorgCaseId,
} from '../../core/ids';
import type { Rng } from '../../core/rng';
import type { Difficulty, EntityType, GameMode, OwnerBackground, ScenarioId, StartType } from '../../state/setup';
import type { EvidenceClass } from '../land/types';
import type { SafetyRecord } from '../staff/types';

/** §1 1.14: an open reorganization case stays 'active'. */
export type RunStatus = 'active' | 'won' | 'lost' | 'retired';
export type EndReason = 'liquidated' | 'ousted' | 'deadline' | 'forfeited' | 'goal' | 'retired';
/** = §11 `distress.liquidation.cause`, set together with endReason 'liquidated'. */
export type LiquidationPath = 'filed' | 'involuntary' | 'converted' | 'p1Counter';

/** §1 1.9: the owner's one assignment per week; a change takes effect at the next step 7. */
export type OwnerAssignment =
  | { kind: 'office' }
  /** The owner runs this claim (counts as its foreman, §8). */
  | { kind: 'foreman'; claimId: ClaimId }
  /** Runs a machine and is the claim's foreman at skill −15 for foreman tasks. */
  | { kind: 'operator'; claimId: ClaimId; machineId: MachineId }
  /** Mechanic background only: that claim's site shop (§8 shop modes, D-8.50). */
  | { kind: 'shop'; mode: 'site'; claimId: ClaimId }
  /** Mechanic background only: the district pool (P3; §9 9.8.6). */
  | { kind: 'shop'; mode: 'pool'; districtId: DistrictId }
  /** Geologist background only. */
  | { kind: 'fieldGeologist'; programId: ProgramId };

/** §1 1.9: a personal guarantee (§11 and §6 surety indemnity create them; inert until P4). */
export interface Guarantee {
  loanId: LoanId;
  kind: 'full' | 'limited' | 'indemnity';
  capCents: Cents | null;
  releasedTurn: number | null;
}

/** §1 1.9 desk tasks (D-1.68); 'permitPrep' joins in P2. */
export type DeskTaskKind = 'siteVisit' | 'recordsReview' | 'sellerAudit' | 'closing';

export interface DeskTask {
  kind: DeskTaskKind;
  ownerSection: 3 | 4 | 5 | 6;
  ref: EntityRef;
  daysTotal: number;
  daysRemaining: number;
  queuedTurn: number;
}

/** §1 1.9 `Owner`, less the ledger mirrors (s01 #6), plus the desk queue (s01 #1). Money names end in Cents (§0.6). */
export interface Owner {
  name: string;
  /** 300–850; the start table's score (760 / 720 / 680), scored by §11 from P4. */
  personalCreditScore: number;
  guarantees: Guarantee[];
  /** Corp: W-2 wage via payroll; sole prop / LLC: scheduled draw. 0 at start. */
  salaryPerWeekCents: Cents;
  assignment: OwnerAssignment;
  /** Applied in the next step 7. */
  pendingAssignment: OwnerAssignment | null;
  /** Reset in step 7. */
  deskDaysUsedThisWeek: number;
  /** Days taken from field time with ownerTime 'now'; reset in step 7. */
  deskDaysForcedThisWeek: number;
  /** FIFO; array order = insertion order (D-1.68). */
  deskQueue: DeskTask[];
  /** null in P1 (injuries from P2). */
  injuredUntilTurn: number | null;
}

/**
 * §1 1.12 reputation inputs: the keys of the `game.reputation.delta` table (tuning data, contract §9.1). §12's event
 * outcomes add `event.<id>.<outcome>` kinds. P1 inputs (s01 #23): missedPayroll, partialPayroll, seasonProduction,
 * recordYear, royaltyPaidInFull, missedAdvanceRoyalty, leaseTerminatedDefault, dealClosed, firings3InWeek,
 * sponsorship.
 */
export const REPUTATION_KINDS = [
  'missedPayroll',
  'partialPayroll',
  'vendorLate',
  'vendorStopSupply',
  'loanDefaultNotice',
  'repossession',
  'reorgFiled',
  'reorgCompleted',
  'seasonProduction',
  'recordYear',
  'royaltyPaidInFull',
  'missedAdvanceRoyalty',
  'leaseTerminatedDefault',
  'dealClosed',
  'acceptedThenFailed',
  'lowballWalk',
  'acreReclaimed',
  'claimAbandonedUnreclaimed',
  'bondForfeited',
  'seriousInjury',
  'fatality',
  'violation',
  'bonusesPaidInFull',
  'firings3InWeek',
  'bonusCutMidSeason',
  'layoffWithoutProRata',
  'sponsorship',
] as const;

/** The kinds reported in P1 (s01 #23, D-1.85). */
export const P1_REPUTATION_KINDS = [
  'missedPayroll',
  'partialPayroll',
  'seasonProduction',
  'recordYear',
  'royaltyPaidInFull',
  'missedAdvanceRoyalty',
  'leaseTerminatedDefault',
  'dealClosed',
  'firings3InWeek',
  'sponsorship',
] as const satisfies readonly (typeof REPUTATION_KINDS)[number][];

export type ReputationKind = (typeof REPUTATION_KINDS)[number] | `event.${string}`;

export interface ReputationEntry {
  turn: number;
  kind: ReputationKind;
  delta: number;
  ref: Id | null;
}

export interface ReputationState {
  /** 0–100, visible. */
  value: number;
  /** Recorded this week; applied in step 16a. */
  pending: ReputationEntry[];
  /** Last 52 weeks. */
  log: ReputationEntry[];
  capsUsedThisYear: Record<string, number>;
}

/** §1 1.14 end-report timeline entry (D-1.84): decisions above `game.endReport.timelineMinUsd` and distress events. */
export interface TimelineEntry {
  turn: number;
  kind: 'purchase' | 'lease' | 'loan' | 'hire' | 'sale' | 'distress' | 'liquidation';
  ref: EntityRef | null;
  amountCents: Cents;
  note: string;
  /** Land deals: the evidence class at commit (the 'bought on seller data only' lesson). */
  evidenceClass?: EvidenceClass;
}

/** §1 1.8.1 `InvestorAgreement` (minus `deliveredValueCents`, derived from §5's interest; s01 #25). */
export interface InvestorAgreement {
  id: InvestorAgreementId;
  name: string;
  kind: 'equity' | 'royalty';
  source: 'backed' | 'angel' | 'familyOffice' | 'miningFund' | 'rescue';
  contributedCents: Cents;
  startTurn: number;
  /** = startTurn (later money is senior). */
  seniority: number;
  // equity terms (null for royalty)
  equityPct: number | null;
  prefRate: number | null;
  /** Stays 0 under P1–P3 rules (s01 #5, D-1.72). */
  prefUnpaidCents: Cents;
  liquidationPrefMult: number | null;
  approvalThresholdCents: Cents | null;
  ownerSalaryCapCents: Cents | null;
  drawsBlockedUntilReturnedCents: Cents | null;
  distributionExpectation: number | null;
  hedgeShareRequired: number | null;
  /** Cumulative pref and distributions paid to this holder. */
  returnedCents: Cents;
  // royalty terms (Backed royalty only)
  productionInterestId: ProductionInterestId | null;
  minimumAnnualCents: Cents | null;
  // relationship
  satisfaction: number;
  stance: 'content' | 'concerned' | 'unhappy' | 'hostile';
  hostileStreak: number;
  annualPlan: {
    year: number;
    fineOz: number;
    capexBudgetCents: Cents;
    capexUsedCents: Cents;
    approved: boolean;
  } | null;
  approvalTokens: { subject: 'capex' | 'debt'; amountCents: Cents; expiresTurn: number }[];
  approvalCooldownUntil: { capex: number; debt: number };
  /** requestIndex of the next approval draw (keys the investor stream). */
  approvalRequestCount: { capex: number; debt: number };
  redemptionDeadlineTurn: number | null;
  /** Royalty only (P4+). */
  minimumCure: { obligationId: ObligationId; shortfallCents: Cents; deadlineTurn: number } | null;
  // reorganization (P4+)
  reorgCaseSeen: ReorgCaseId | null;
  redemptionStayedTurn: number | null;
}

/** §1 1.10 scenario progress (null in sandbox). */
export interface ScenarioProgress {
  id: ScenarioId;
  medal: 'gold' | 'silver' | 'bronze' | null;
  metTurn: number | null;
  /** First turn a §11 reorganization case was seen; caps the medal at silver. */
  reorgFiledTurn: number | null;
}

/** §1 1.18 `CompanySlice`. */
export interface CompanySlice {
  name: string;
  entity: EntityType;
  /** null in P1. */
  pendingEntity: { to: EntityType; effectiveTurn: number } | null;
  background: OwnerBackground;
  start: StartType;
  difficulty: Difficulty;
  mode: GameMode;
  owner: Owner;
  /** Sorted; at most 2 equity + 1 Backed royalty. */
  investors: Record<InvestorAgreementId, InvestorAgreement>;
  investorIds: InvestorAgreementId[];
  reputation: ReputationState;
  /** 0–100, mechanics §6 (game.start.regulatorStandingStart 60; Inheritor 55). */
  regulatorStanding: number;
  /** §8. */
  safetyRecord: SafetyRecord;
  scenario: ScenarioProgress | null;
  runStatus: RunStatus;
  endReason: EndReason | null;
  liquidationPath: LiquidationPath | null;
  /** Ring of game.endReport.timelineMaxEntries (200), D-1.84. */
  timeline: TimelineEntry[];
}

export function isRunActive(company: Pick<CompanySlice, 'runStatus'>): boolean {
  return company.runStatus === 'active';
}

/** §1 1.8.2 setup streams (D-1.65): built by `inheritorStreams(seed)`, handed to their users, never stored. */
export interface InheritorStreams {
  ground: Rng;
  pits: Rng;
  fleet: (i: number) => Rng;
  hand: Rng;
}

/** The visible terms of an investor agreement (§13 setup cards, the Company screen). */
export type InvestorTermsView = Omit<
  InvestorAgreement,
  'satisfaction' | 'hostileStreak' | 'approvalRequestCount' | 'reorgCaseSeen'
>;

/** `previewStart` (S13-4, D-1.90): the start position before a game exists; must equal the scored new game. */
export interface StartPreview {
  companyCashCents: Cents;
  personalCashCents: Cents;
  inheritedFleetResaleCents: Cents;
  appraisalCents: Cents;
  debtCents: Cents;
  investorTerms: InvestorTermsView[];
  companyNwCents: Cents;
  ownerNwCents: Cents;
}

/** §11 14c owner items (contract): the scheduled draw, the turn-1 formation fee and the week-13 entity fee. */
export interface OwnerItem {
  kind: 'draw' | 'formationFee' | 'entityAnnualFee';
  amountCents: Cents;
  memo: string;
}

/** A rule-based lesson of the end report (1.14), rendered from its template. */
export interface LessonRef {
  key: string;
  params: Record<string, string | number>;
  subject: EntityRef[];
}

/** One row of the end report's claims table (1.14 P1 data). */
export interface EndReportClaimRow {
  claimId: ClaimId;
  acquiredBy: 'purchase' | 'lease' | 'staked' | 'auction' | 'inherited' | 'jv' | 'optionExercise';
  costCents: Cents;
  weighedRawOz: number;
  fineOzRecovered: number;
  pnlCents: Cents;
}

/** §1 1.14 end-of-run report (`endReport(state)`, once `runStatus ≠ 'active'`). P1: the reveal is geology only. */
export interface EndReport {
  outcome: { runStatus: RunStatus; endReason: EndReason | null; liquidationPath: LiquidationPath | null };
  startTurn: number;
  endTurn: number;
  seed: string;
  /** ownerNWReal × game.scoreMult. */
  scoreCents: Cents;
  medal: ScenarioProgress['medal'];
  medalCappedAtSilver: boolean;
  claims: EndReportClaimRow[];
  /** Claims whose true block grades the reveal shows next to the final estimate and the seller's claims. */
  reveal: { claimIds: ClaimId[] };
  timeline: TimelineEntry[];
  lessons: LessonRef[];
}
