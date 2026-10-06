// Step 16 · Wrap-up (DESIGN §2.6, §1 1.17, §13 13.22): §1 16a reputation (16.1) → 16b investors (16.2) → 16c scenario
// (16.3) → 16d run-end check (16.4) → the section wrap-ups in ascending section number (16.5–16.12) → §2's fallback
// decision defaults and closed-decision retention (16.13) → §13 collation (16.14) → §2 history snapshot and the
// completed year's rollup (16.15) → the report's explain trees (16.16). Collation and the snapshot follow 16d, so a
// game over in 16d reaches evaluateStops as `gameOver`. This file holds §2's framework parts; the owners' parts live in
// their folders.
import { produceState } from '../../state/immutability';
import { applyDueDecisionDefaults } from '../../actions/defaults';
import { pruneClosedDecisions } from '../../actions/decisions';
import { explainCash } from '../../explain/cash';
import type { GameState } from '../../state/types';
import { tuningNumber } from '../../state/tuning';
import { writeHistory } from '../../systems/history/week';
import type { PipelinePart, StepContext, StepDef } from '../types';

/**
 * Non-blocking decisions whose deadline arrived and that no earlier owner step defaulted (§2.2; P0: every due default),
 * then the closed-decision retention that §13's inbox rule covers (D-2.39).
 */
function decisionDefaults(state: GameState, _ctx: StepContext): GameState {
  const defaulted = applyDueDecisionDefaults(state);
  const retention = tuningNumber(defaulted.meta.tuning, 'game.alerts.inboxRetentionWeeks');
  const cutoff = defaulted.clock.turn - retention;
  const { closedDecisionIds, closedDecisions } = defaulted.inbox;
  if (!closedDecisionIds.some((id) => (closedDecisions[id]?.closedTurn ?? cutoff) < cutoff)) return defaulted;
  return produceState(defaulted, (draft) => pruneClosedDecisions(draft, retention));
}

/** The week's explain trees (only with explain; never changes state, D-13.36). */
function reportCalc(state: GameState, ctx: StepContext): GameState {
  if (ctx.explain.on) ctx.report.calc['finance.cashOnHand'] = explainCash(state);
  return state;
}

export const step16WrapUp: StepDef = {
  index: 16,
  name: 'Wrap-up',
  sections: [1, 3, 4, 5, 7, 8, 9, 10, 12, 13, 2],
};

export const STEP16_PARTS: readonly PipelinePart[] = [
  { id: 'framework.decisionDefaults', step: 16, order: 13, section: 2, fromPhase: 0, run: decisionDefaults },
  { id: 'framework.history', step: 16, order: 15, section: 2, fromPhase: 0, run: writeHistory },
  { id: 'framework.reportCalc', step: 16, order: 16, section: 2, fromPhase: 0, run: reportCalc },
];
