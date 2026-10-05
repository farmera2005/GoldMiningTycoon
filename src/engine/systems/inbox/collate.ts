// §13 collation in step 16 (DESIGN §13 13.10, D-13.33). The full rule (obligation grouping, level/edge handling,
// reopening within game.alerts.dedupeWindowWeeks, msg_ ids in sorted order, retention) ships with §13's inbox in P1.
// The P0 stub creates no messages: the week's signals stay in WeekReport.alerts, and the stop candidates are the
// blocking decisions created this turn (13.10: "stopCandidates += PendingDecisions created this turn with blocking").
import type { GameState } from '../../state/types';
import type { StopCandidate } from '../../turn/types';

export function collateAlerts(state: GameState): StopCandidate[] {
  const out: StopCandidate[] = [];
  for (const id of state.inbox.decisionIds) {
    const d = state.inbox.decisions[id];
    if (d !== undefined && d.blocking && d.createdTurn === state.clock.turn) {
      out.push({ ref: id, kind: 'decision', severity: 'blocking' });
    }
  }
  return out;
}
