// Week results and the pipeline's step contract (DESIGN §2.2 `WeekReport`, §2.6). A step is a pure function
// (state, ctx) → state that may append to the week's report. The report lives beside the state, never in it, so the
// explain flag (calc trees and §7 hints, written to the report only) cannot change GameState (D-13.36).
import type { CalcNode, ExplainCtx } from '../core/calc';
import type { ClaimId, DecId, LineId, MsgId } from '../core/ids';
import type { Month } from '../core/calendar';
import type { AlertKind, AlertSignal, Severity } from '../systems/inbox/types';
import type { GameState } from '../state/types';

/** §7's per-line cleanup result; P0 carries the line id that §13's every-cleanup stop names (§7 fills the rest, P1). */
export interface CleanupResult {
  lineId: LineId;
}

/** §7's `WeekOpsResult` (placeholder until §7 ships its shape in P1). */
export type WeekOpsResult = Readonly<Record<string, unknown>>;

/** §7's what-if hint (placeholder until P1). */
export type OpsHint = Readonly<Record<string, unknown>>;

export type StopCandidate =
  { ref: MsgId; kind: AlertKind; severity: Severity } | { ref: DecId; kind: 'decision'; severity: 'blocking' };

export interface WeekReport {
  turn: number;
  /** Every signal emitted in steps 1–16, before collation (§13 13.10). */
  alerts: AlertSignal[];
  /** Written by §13's collation in step 16. */
  stopCandidates: StopCandidate[];
  /** §7: one entry per claim that operated; cleanups ascending lineId (empty if none). */
  ops: Record<ClaimId, { result: WeekOpsResult; cleanups: CleanupResult[] }>;
  /** Only when advanceWeek ran with explain (§2.8). */
  calc?: Record<string, CalcNode>;
  /** §7 what-if hints, only with explain. */
  hints?: Record<ClaimId, OpsHint[]>;
}

export interface WeekResult {
  state: GameState;
  report: WeekReport;
}

/** The week's calendar facts, derived once in step 1 for every later step (§1 1.3). */
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
  /** Week 52: year close and the annual rollup. */
  isYearEnd: boolean;
}

/** The mutable part of a week in progress: the report under construction. */
export interface WeekReportBuilder {
  turn: number;
  alerts: AlertSignal[];
  stopCandidates: StopCandidate[];
  ops: Record<ClaimId, { result: WeekOpsResult; cleanups: CleanupResult[] }>;
  calc: Record<string, CalcNode>;
  hints: Record<ClaimId, OpsHint[]>;
}

export interface StepContext {
  readonly explain: ExplainCtx;
  readonly report: WeekReportBuilder;
  /** Set by step 1; steps 2–16 read it. */
  calendar: WeekCalendar | null;
}

export interface PipelineStep {
  /** 0–16 (§2.6). */
  readonly index: number;
  readonly name: string;
  /** Acting sections in their §2.6 order. */
  readonly sections: readonly number[];
  run(state: GameState, ctx: StepContext): GameState;
}

/** The week's calendar, which step 1 must have set. */
export function weekCalendar(ctx: StepContext): WeekCalendar {
  if (ctx.calendar === null) throw new Error('pipeline: the week calendar is read before step 1 derived it');
  return ctx.calendar;
}
