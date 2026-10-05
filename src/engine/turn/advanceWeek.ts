// advanceWeek (DESIGN §2.2, §2.6): runs steps 0–16 in order on an immutable state and returns the new state with the
// week's report. Throws EngineGuardError when canAdvance refuses. The explain flag only adds calc trees and hints to
// the report; it never changes GameState (state hashes with explain on and off are identical, D-13.36, T18).
import { EXPLAIN_OFF, EXPLAIN_ON } from '../core/calc';
import type { GameState } from '../state/types';
import { assertCanAdvance } from './guard';
import { PIPELINE } from './pipeline';
import type { StepContext, WeekReport, WeekReportBuilder, WeekResult } from './types';

export interface AdvanceOpts {
  explain?: boolean;
}

function openReport(state: GameState): WeekReportBuilder {
  return { turn: state.clock.turn + 1, alerts: [], stopCandidates: [], ops: {}, calc: {}, hints: {} };
}

function finalizeReport(builder: WeekReportBuilder, explain: boolean): WeekReport {
  const report: WeekReport = {
    turn: builder.turn,
    alerts: builder.alerts,
    stopCandidates: builder.stopCandidates,
    ops: builder.ops,
  };
  if (explain) {
    report.calc = builder.calc;
    report.hints = builder.hints;
  }
  return report;
}

export function advanceWeek(state: GameState, opts: AdvanceOpts = {}): WeekResult {
  assertCanAdvance(state);
  const explain = opts.explain === true;
  const ctx: StepContext = { explain: explain ? EXPLAIN_ON : EXPLAIN_OFF, report: openReport(state), calendar: null };
  let s = state;
  for (const step of PIPELINE) s = step.run(s, ctx);
  return { state: s, report: finalizeReport(ctx.report, explain) };
}
