// Step 16 · Wrap-up (DESIGN §2.6, §1 1.17, §13 13.22): §1 16a reputation → 16b investors → 16c scenario → 16d run-end
// check → the section wrap-ups in ascending section number (non-blocking decision defaults with no earlier owner step,
// retention pruning) → §13 collation → §2 history snapshot (and the year's rollup at week 52) → the report's explain
// trees. Collation and the snapshot follow 16d, so a game over in 16d reaches evaluateStops as `gameOver`.
import { produceState } from '../../state/immutability';
import { applyDueDecisionDefaults } from '../../actions/defaults';
import { pruneClosedDecisions } from '../../actions/decisions';
import { explainCash } from '../../explain/cash';
import type { GameState } from '../../state/types';
import { tuningNumber } from '../../state/tuning';
import { runEndCheck } from '../../systems/company/runEnd';
import { appendWeekly, companySnapshot, marketSnapshot, yearRollup } from '../../systems/history/snapshot';
import { collateAlerts } from '../../systems/inbox/collate';
import { weekCalendar, type PipelineStep, type StepContext } from '../types';

/** Section wrap-ups (P0: §2's decision defaults and the closed-decision retention that §13's inbox rule covers). */
function sectionWrapUps(state: GameState): GameState {
  const defaulted = applyDueDecisionDefaults(state);
  const retention = tuningNumber(defaulted.meta.tuning, 'game.alerts.inboxRetentionWeeks');
  const cutoff = defaulted.clock.turn - retention;
  const { closedDecisionIds, closedDecisions } = defaulted.inbox;
  if (!closedDecisionIds.some((id) => (closedDecisions[id]?.closedTurn ?? cutoff) < cutoff)) return defaulted;
  return produceState(defaulted, (draft) => pruneClosedDecisions(draft, retention));
}

/** §2 history: the week's snapshot, then the completed year's rollup at week 52. */
function writeHistory(state: GameState, ctx: StepContext): GameState {
  const calendar = weekCalendar(ctx);
  const keep = tuningNumber(state.meta.tuning, 'game.history.weeklyKeep');
  const snap = { turn: state.clock.turn, market: marketSnapshot(state), company: companySnapshot(state) };
  const withSnap = produceState(state, (draft) => appendWeekly(draft.history, snap, keep));
  if (!calendar.isYearEnd) return withSnap;
  const rollup = yearRollup(withSnap, calendar.year);
  return produceState(withSnap, (draft) => {
    draft.history.annual.push(rollup);
  });
}

function run(state: GameState, ctx: StepContext): GameState {
  // §1 16a reputation, 16b investors, 16c scenario: P1, P4, P6.
  let s = runEndCheck(state); // 16d
  s = sectionWrapUps(s);
  ctx.report.stopCandidates.push(...collateAlerts(s));
  s = writeHistory(s, ctx);
  if (ctx.explain.on) ctx.report.calc['finance.cashOnHand'] = explainCash(s);
  return s;
}

export const step16WrapUp: PipelineStep = { index: 16, name: 'Wrap-up', sections: [1, 13, 2], run };
