// Default-at-deadline (DESIGN §2.2): a non-blocking decision reaching deadlineTurn has its defaultOptionId applied by
// its owner in the owner's own step that week, or in the step-16 wrap-up if it has no earlier step. Both paths use
// applyDecisionDefault; §13's collation then marks the message `defaulted`.
import { produceState } from '../state/immutability';
import type { DecId } from '../core/ids';
import type { GameState } from '../state/types';
import { applyValidated } from './apply';
import { closeDecision, dueDefaultDecisions } from './decisions';
import { ownValue } from './own';
import { validateWithRegistry } from './registry';
import type { DecisionAnswerAction } from './types';

/**
 * Applies one open decision's default option through `decision/answer` (origin 'pipeline', so it closes as
 * 'defaulted'). If the option's action no longer validates, the decision still closes as 'defaulted', recording the
 * validator's code, and nothing else changes.
 */
export function applyDecisionDefault(state: GameState, decId: DecId): GameState {
  const d = ownValue(state.inbox.decisions, decId);
  if (d === undefined || d.defaultOptionId === undefined) return state;
  const answer: DecisionAnswerAction = { type: 'decision/answer', decisionId: decId, optionId: d.defaultOptionId };
  const error = validateWithRegistry(state, answer);
  if (error === null) return applyValidated(state, answer, 'pipeline').state;
  const optionId = d.defaultOptionId;
  return produceState(state, (draft) => {
    closeDecision(draft, decId, 'defaulted', optionId, error.cause?.code ?? error.code);
  });
}

/** Applies every due default not yet applied by an owner step, in ascending decision id. */
export function applyDueDecisionDefaults(state: GameState): GameState {
  let s = state;
  for (const d of dueDefaultDecisions(state)) s = applyDecisionDefault(s, d.id);
  return s;
}
