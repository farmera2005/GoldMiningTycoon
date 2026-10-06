// Per-week summaries the UI keeps after a week (DESIGN §13.22 "store the report summary"; 13.9 live-region text).
// Pure functions of two engine selector values and the week's report; no game rule is computed here.
import { select, type GameState, type WeekResult } from '../../engine';
import { formatValue, yearWeek } from '../format';
import type { WeekReportSummary } from '../store/gameSlice';

export function summarizeWeek(week: WeekResult): WeekReportSummary {
  return {
    turn: week.report.turn,
    cashEndCents: select.cashOnHand(week.state),
    alerts: week.report.alerts.length,
    stopCandidates: week.report.stopCandidates.length,
  };
}

/**
 * The polite live-region announcement after a week (13.9): `Y1 Wk 2 complete: cash +$1,250.00; 1 new alert`. P0 has
 * no cleanups; §7's cleanup and weighed-gold clause joins in P1.
 */
export function weekAnnouncement(prev: GameState, week: WeekResult): string {
  const next = week.state;
  const delta = select.cashOnHand(next) - select.cashOnHand(prev);
  const alerts = week.report.alerts.length;
  const view = select.dateView(next);
  const alertText = alerts === 1 ? '1 new alert' : `${alerts} new alerts`;
  return `${yearWeek(view.year, view.week)} complete: cash ${formatValue(delta, 'cents', { delta: true })}; ${alertText}`;
}
