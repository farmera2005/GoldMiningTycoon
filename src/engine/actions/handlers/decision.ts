// `decision/answer` (DESIGN §2.2, §13 13.21): runs the chosen option's stored action through its owner's handler and
// closes the decision. Validation: DECISION_NOT_FOUND, DECISION_CLOSED, OPTION_INVALID, plus the option action's own
// codes. Answered by the pipeline at a non-blocking decision's deadline, it closes the decision as 'defaulted'.
import { sortedKeysByCodeUnit } from '../../core/iter';
import { cloneJson } from '../../state/immutability';
import type { GameState } from '../../state/types';
import { closeDecision } from '../decisions';
import { hasOwn, ownValue } from '../own';
import { validateWithRegistry } from '../registry';
import type {
  ActionDef,
  ActionError,
  AnyAction,
  DecisionAnswerAction,
  DecisionOption,
  HandlerContext,
  PendingDecision,
} from '../types';

/** Params are intent only: a flat record of strings, finite numbers and booleans that cannot replace `type`. */
function isPlainParams(v: unknown): v is Record<string, string | number | boolean> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const rec = v as Record<string, unknown>;
  if (hasOwn(rec, 'type')) return false;
  return sortedKeysByCodeUnit(rec).every((k) => {
    const x = rec[k];
    return typeof x === 'string' || typeof x === 'boolean' || (typeof x === 'number' && Number.isFinite(x));
  });
}

function shapeError(a: DecisionAnswerAction): ActionError | null {
  if (typeof a.decisionId !== 'string' || typeof a.optionId !== 'string') {
    return { code: 'ACTION_MALFORMED', message: 'decision/answer needs string decisionId and optionId' };
  }
  if (a.params !== undefined && !isPlainParams(a.params)) {
    return { code: 'ACTION_MALFORMED', message: 'params must be a flat record of primitives without `type`' };
  }
  return null;
}

function findOption(d: PendingDecision, optionId: string): DecisionOption | undefined {
  return d.options.find((o) => o.id === optionId);
}

/** The action an answer runs: the option's stored action with the answer's params merged in (never its type). */
export function answeredAction(option: DecisionOption, params: DecisionAnswerAction['params']): AnyAction {
  const base = cloneJson(option.action) as unknown as Record<string, unknown>;
  return (params === undefined ? base : { ...base, ...params, type: option.action.type }) as unknown as AnyAction;
}

function validate(state: GameState, a: DecisionAnswerAction): ActionError | null {
  const bad = shapeError(a);
  if (bad !== null) return bad;
  // Own-property lookups: the id is untrusted input, and an inherited key ('constructor', '__proto__') must read as
  // "no such decision", never as a record (§2.2: validation is total).
  const d = ownValue(state.inbox.decisions, a.decisionId);
  if (d === undefined) {
    return ownValue(state.inbox.closedDecisions, a.decisionId) !== undefined
      ? { code: 'DECISION_CLOSED', message: `${a.decisionId} is already closed` }
      : { code: 'DECISION_NOT_FOUND', message: `no decision ${a.decisionId}` };
  }
  const option = findOption(d, a.optionId);
  if (option === undefined) return { code: 'OPTION_INVALID', message: `${a.decisionId} has no option ${a.optionId}` };
  const nested = answeredAction(option, a.params);
  if (nested.type === 'decision/answer') {
    return { code: 'OPTION_INVALID', message: 'an option cannot answer another decision' };
  }
  return validateWithRegistry(state, nested);
}

function handle(draft: GameState, a: DecisionAnswerAction, ctx: HandlerContext): void {
  const d = ownValue(draft.inbox.decisions, a.decisionId) as PendingDecision;
  const option = findOption(d, a.optionId) as DecisionOption;
  ctx.applyNested(answeredAction(option, a.params));
  closeDecision(draft, a.decisionId, ctx.origin === 'pipeline' ? 'defaulted' : 'answered', a.optionId);
  ctx.effect({ kind: 'decision', decId: a.decisionId });
}

export const decisionAnswerDef: ActionDef<DecisionAnswerAction> = {
  type: 'decision/answer',
  ownerSection: 13,
  // The answer itself reveals and commits nothing; the option's action carries its own flags through applyNested.
  reveals: false,
  commits: false,
  validate,
  handle,
};
