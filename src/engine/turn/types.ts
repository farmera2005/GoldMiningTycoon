// Week results, the step context and the part table's contract (DESIGN §2.2 `WeekReport`, §2.6; P1 contract §1.3–1.4).
// A pipeline part is a pure function (state, ctx) → state that may append to the week's report and write its owner's
// member of the week scratch. The report and the scratch live beside the state, never in it, so neither the explain
// flag (calc trees and §7 hints go to the report only) nor the intra-week handoffs can change GameState (D-13.36,
// s02 #10).
import type { CalcNode, ExplainCtx } from '../core/calc';
import type { ClaimId, DecId, MsgId } from '../core/ids';
import type { Month } from '../core/calendar';
import type { Cents } from '../core/money';
import type { ClimateWeekRecord } from '../systems/climate/report';
import type { DeskWeekScratch } from '../systems/company/report';
import type { FinanceWeekRecord, FinanceWeekScratch } from '../systems/finance/report';
import type { FleetWeekRecord, FleetWeekScratch } from '../systems/fleet/report';
import type { GoldWeekRecord, GoldWeekScratch } from '../systems/gold/report';
import type { AlertKind, AlertSignal, Severity } from '../systems/inbox/types';
import type { KnowledgeWeekRecord, KnowledgeWeekScratch } from '../systems/knowledge/report';
import type { LandWeekRecord, LandWeekScratch } from '../systems/land/report';
import type { CleanupResult, OpsHint, OpsWeekScratch, WeekOpsResult } from '../systems/ops/report';
import type { StaffWeekRecord, StaffWeekScratch } from '../systems/staff/report';
import type { GameState, RulesPhase } from '../state/types';

export type { CleanupResult, OpsHint, WeekOpsResult } from '../systems/ops/report';

export type StopCandidate =
  { ref: MsgId; kind: AlertKind; severity: Severity } | { ref: DecId; kind: 'decision'; severity: 'blocking' };

/** One claim's §7 entry in the report: its week result and its cleanups, ascending lineId (empty if none). */
export interface ClaimOpsReport {
  result: WeekOpsResult;
  cleanups: CleanupResult[];
}

/**
 * The owners' visible week records (P1 contract §1.3). Each member has one writer, its owner, and carries no hidden
 * value (a hidden quantity reaches the report only as a calc node tagged `hidden`).
 */
export interface WeekRecords {
  climate: ClimateWeekRecord;
  knowledge: KnowledgeWeekRecord;
  land: LandWeekRecord;
  staff: StaffWeekRecord;
  fleet: FleetWeekRecord;
  gold: GoldWeekRecord;
  finance: FinanceWeekRecord;
}

export interface WeekReport {
  turn: number;
  /** Every signal emitted in steps 1–16, before collation (§13 13.10). */
  alerts: AlertSignal[];
  /** Written by §13's collation in step 16. */
  stopCandidates: StopCandidate[];
  /** §7: one entry per claim that operated; cleanups ascending lineId (empty if none). */
  ops: Record<ClaimId, ClaimOpsReport>;
  /** The owners' week records. */
  records: WeekRecords;
  /** Only when advanceWeek ran with explain (§2.8). Keys follow `reportCalcKey` (S13-6). */
  calc?: Record<string, CalcNode>;
  /** §7 what-if hints, only with explain. */
  hints?: Record<ClaimId, OpsHint[]>;
}

export interface WeekResult {
  state: GameState;
  report: WeekReport;
}

/** The week's calendar facts, derived once in step 1 for every later step (§1 1.3, D-2.42). */
export interface WeekCalendar {
  turn: number;
  year: number;
  week: number;
  displayYear: number;
  reportingMonth: Month;
  quarter: 1 | 2 | 3 | 4;
  isMonthEnd: boolean;
  isQuarterEnd: boolean;
  /** Week 1: the annual rolls (§1 1.4.3) and the §11 annual items. */
  isYearStart: boolean;
  /** Week 52: year close. */
  isYearEnd: boolean;
}

/** The mutable part of a week in progress: the report under construction. */
export interface WeekReportBuilder {
  turn: number;
  alerts: AlertSignal[];
  stopCandidates: StopCandidate[];
  ops: Record<ClaimId, ClaimOpsReport>;
  records: WeekRecords;
  calc: Record<string, CalcNode>;
  hints: Record<ClaimId, OpsHint[]>;
}

/** One weighing of the step-12 cleanup chain (D-2.10), in chain order (claims ascending, then lines ascending). */
export interface CleanupChainRecord {
  claimId: ClaimId;
  /** §7's record of the cleanup (`finishCleanup`). */
  result: CleanupResult;
  /** Gross weighed raw oz × the lot's estimated fineness at weighing (s01 #21, S10-13). */
  fineOzRecovered: number;
  /** In-kind interests taken off the top, at the lot's estimated fineness (S11-15). */
  inKindFineOz: number;
  /** Their value as §5's settlement priced it (S11-15). */
  inKindValueCents: Cents;
}

/** §2's own member of the week scratch: the cleanup chain's weighings. */
export interface CleanupWeekScratch {
  results: CleanupChainRecord[];
}

/**
 * The week's intra-week handoffs (s02 #10, S09-16; P1 contract §1.3), built empty by every advanceWeek and dropped when
 * it returns: never in GameState, never saved or hashed. Each member has exactly one writer, its owner; later steps
 * read it. Owners keep in their slices only what must outlive the week (e.g. §7's last-week results for display).
 */
export interface WeekScratch {
  /** §1: desk tasks completed (step 7). */
  desk: DeskWeekScratch;
  /** §5: listing events (steps 3, 6). */
  land: LandWeekScratch;
  /** §9: machine availability per claim (step 8). */
  fleet: FleetWeekScratch;
  /** §7: claim week results, hours and cost lines (step 9). */
  ops: OpsWeekScratch;
  /** §4: program resource use and costs (step 9 j), sample lots (step 12). */
  knowledge: KnowledgeWeekScratch;
  /** §8: hours per employee (step 10). */
  staff: StaffWeekScratch;
  /** §2: the step-12 cleanup chain, in chain order. */
  cleanup: CleanupWeekScratch;
  /** §10: lots created and sales (step 12). */
  gold: GoldWeekScratch;
  /** §11: payment events and the payroll run (step 14). */
  finance: FinanceWeekScratch;
}

/**
 * Test seams (§2.14 "declared sub-order independence"; used by the cross-cutting tests through turn/seams.ts). A
 * production week always runs with NO_SEAMS.
 */
export interface PipelineSeams {
  /** Reorders one step's parts before they run; must return a permutation of `parts`. */
  readonly orderParts: ((step: number, parts: readonly PipelinePart[]) => readonly PipelinePart[]) | null;
  /** The step-12 cleanup chain runs §4 recordProduction before §11's deferred-revenue drawdowns (D-2.10). */
  readonly swapDrawdownAndRecordProduction: boolean;
}

export const NO_SEAMS: PipelineSeams = { orderParts: null, swapDrawdownAndRecordProduction: false };

export interface StepContext {
  readonly explain: ExplainCtx;
  readonly report: WeekReportBuilder;
  /** Set by step 1; steps 2–16 read it through `weekCalendar(ctx)`. */
  calendar: WeekCalendar | null;
  /** This week's handoffs between owners (never in state). */
  readonly week: WeekScratch;
  readonly seams: PipelineSeams;
}

/**
 * One entry of the part table (P1 contract §1.4, s02 #8, #11). Steps run their parts in ascending `order`, which is the
 * step's §2.6 sub-order; a part runs only when the game's rules phase is at least `fromPhase`, so `--rules p0` runs
 * only the P0 parts and reproduces P0 (D-2.18).
 */
export interface PipelinePart {
  /** '<folder>.<name>' ('framework.<name>' for §2's own), unique in the table. */
  readonly id: string;
  /** 0–16 (§2.6). */
  readonly step: number;
  /** Position within the step (1, 2, …): the §2.6 sub-order. */
  readonly order: number;
  /** The owning DESIGN section. */
  readonly section: number;
  readonly fromPhase: RulesPhase;
  /** Wraps its own work in one produceState (or returns the state unchanged). */
  run(state: GameState, ctx: StepContext): GameState;
}

/** A step of §2.6: its number, its name and its acting sections in order (the parts carry the work). */
export interface StepDef {
  /** 0–16 (§2.6). */
  readonly index: number;
  readonly name: string;
  /** Acting sections in their §2.6 order. */
  readonly sections: readonly number[];
}

export interface PipelineStep extends StepDef {
  run(state: GameState, ctx: StepContext): GameState;
}

/** The week's calendar, which step 1 must have set. */
export function weekCalendar(ctx: StepContext): WeekCalendar {
  if (ctx.calendar === null) throw new Error('pipeline: the week calendar is read before step 1 derived it');
  return ctx.calendar;
}
