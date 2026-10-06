// §13 collation (DESIGN §13 13.10, D-13.33; S12-3; P1 contract §4.13). `collateAlerts(draft, signals, turn, mode)`
// turns signals into inbox messages and returns the stop candidates:
//   - 'week' (step 16, part 16.14): grouping, sort, dedupe, level update or reopen, edge create and id assignment, the
//     auto-resolve sweep, retention, defaulted marks and the stop candidates;
//   - 'action' (applyAction, for a result's `alert` effects): the same message work without the auto-resolve sweep,
//     retention or stop candidates.
// The full rule ships with §13's inbox package. The P0 form creates no messages (the week's signals stay in
// WeekReport.alerts), and the week's stop candidates are the blocking decisions created this turn (13.10:
// "stopCandidates += PendingDecisions created this turn with blocking").
import type { GameState } from '../../state/types';
import type { StopCandidate } from '../../turn/types';
import type { AlertSignal } from './types';

export type CollationMode = 'week' | 'action';

/** Collates `signals` into the inbox of a draft at `turn`; returns the stop candidates ('week' mode only). */
export function collateAlerts(
  draft: GameState,
  _signals: readonly AlertSignal[],
  turn: number,
  mode: CollationMode,
): StopCandidate[] {
  const out: StopCandidate[] = [];
  if (mode === 'action') return out;
  for (const id of draft.inbox.decisionIds) {
    const d = draft.inbox.decisions[id];
    if (d !== undefined && d.blocking && d.createdTurn === turn) {
      out.push({ ref: id, kind: 'decision', severity: 'blocking' });
    }
  }
  return out;
}
