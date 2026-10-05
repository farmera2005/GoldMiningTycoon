// runToNextDecision (DESIGN §2.7): loops advanceWeek and, after each week, evaluateStops; it stops when a reason
// appears, or when turn − anchor.startTurn reaches maxWeeks (adding a `maxWeeks` reason). The UI worker runs the same
// loop with yields, so the two stop identically (§13 T6).
import type { GameState } from '../state/types';
import { advanceWeek } from './advanceWeek';
import { assertCanAdvance, canAdvance } from './guard';
import { defaultRunAnchor, evaluateStops, type RunAnchor, type StopReason, type StopRule } from './stops';
import type { WeekReport } from './types';

export interface RunOpts {
  maxWeeks: number;
  stopRules: StopRule[];
  /** Defaults to the start state. */
  anchor?: RunAnchor;
  explain?: boolean;
}

export interface RunResult {
  state: GameState;
  reports: WeekReport[];
  stoppedBecause: StopReason[];
}

export function runToNextDecision(state: GameState, opts: RunOpts): RunResult {
  if (!Number.isSafeInteger(opts.maxWeeks) || opts.maxWeeks < 1) {
    throw new RangeError(`runToNextDecision: maxWeeks must be a positive integer, got ${opts.maxWeeks}`);
  }
  assertCanAdvance(state);
  const anchor = opts.anchor ?? defaultRunAnchor(state);
  const reports: WeekReport[] = [];
  let s = state;
  for (;;) {
    const week = advanceWeek(s, { explain: opts.explain === true });
    const reasons = evaluateStops(s, week, opts.stopRules, anchor);
    s = week.state;
    reports.push(week.report);
    if (s.clock.turn - anchor.startTurn >= opts.maxWeeks) {
      reasons.push({ kind: 'maxWeeks', label: `Ran ${opts.maxWeeks} weeks` });
    }
    // A state that cannot advance always stops the run. evaluateStops names the cause; the fallback only guards the
    // invariant that a stopped run always says why.
    const refusal = canAdvance(s);
    if (refusal !== null && reasons.length === 0) {
      reasons.push(
        refusal === 'GAME_OVER'
          ? { kind: 'gameOver', label: 'Run ended' }
          : { kind: 'blockingDecision', label: 'Decision needed', severity: 'blocking' },
      );
    }
    if (reasons.length > 0) return { state: s, reports, stoppedBecause: reasons };
  }
}
