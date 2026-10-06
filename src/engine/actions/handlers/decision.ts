// `decision/answer` (DESIGN §2.2, §13 13.21): runs the chosen option's stored action through its owner's handler and
// closes the decision; an option without an action closes it with no other effect (S08-14). Validation:
// DECISION_NOT_FOUND, DECISION_CLOSED, OPTION_INVALID, plus the option action's own codes; its warnings are the option
// action's. Answered by the player, the decision's inbox message turns 'answered' at once (S12-2); answered by the
// pipeline at a non-blocking decision's deadline, the decision closes as 'defaulted' and §13's collation marks the
// message.
import { sortedKeysByCodeUnit } from '../../core/iter';
import { cloneJson } from '../../state/immutability';
import type { GameState } from '../../state/types';
import { closeDecision } from '../decisions';
import { hasOwn, ownValue } from '../own';
import { validateWithRegistry, warningsWithRegistry } from '../registry';
import type {
  ActionDef,
  ActionError,
  ActionWarning,
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

/**
 * The action an answer runs: the option's stored action with the answer's params merged in (never its type), or null
 * for an option that only closes the decision.
 */
export function answeredAction(option: DecisionOption, params: DecisionAnswerAction['params']): AnyAction | null {
  if (option.action === undefined) return null;
  const base = cloneJson(option.action) as unknown as Record<string, unknown>;
  return (params === undefined ? base : { ...base, ...params, type: option.action.type }) as unknown as AnyAction;
}

/** The open decision and the option an answer names, or the typed error (own-property lookups, D-2.59). */
function resolve(
  state: GameState,
  a: DecisionAnswerAction,
): { ok: true; option: DecisionOption } | { ok: false; error: ActionError } {
  // The id is untrusted input: an inherited key ('constructor', '__proto__') must read as "no such decision", never as
  // a record (§2.2: validation is total).
  const d = ownValue(state.inbox.decisions, a.decisionId);
  if (d === undefined) {
    return {
      ok: false,
      error:
        ownValue(state.inbox.closedDecisions, a.decisionId) !== undefined
          ? { code: 'DECISION_CLOSED', message: `${a.decisionId} is already closed` }
          : { code: 'DECISION_NOT_FOUND', message: `no decision ${a.decisionId}` },
    };
  }
  const option = findOption(d, a.optionId);
  if (option === undefined) {
    return { ok: false, error: { code: 'OPTION_INVALID', message: `${a.decisionId} has no option ${a.optionId}` } };
  }
  return { ok: true, option };
}

function validate(state: GameState, a: DecisionAnswerAction): ActionError | null {
  const bad = shapeError(a);
  if (bad !== null) return bad;
  const r = resolve(state, a);
  if (!r.ok) return r.error;
  const nested = answeredAction(r.option, a.params);
  if (nested === null) {
    return a.params === undefined ? null : { code: 'ACTION_MALFORMED', message: 'this option takes no params' };
  }
  if (nested.type === 'decision/answer') {
    return { code: 'OPTION_INVALID', message: 'an option cannot answer another decision' };
  }
  return validateWithRegistry(state, nested);
}

function warnings(state: GameState, a: DecisionAnswerAction): ActionWarning[] {
  const r = resolve(state, a);
  if (!r.ok) return [];
  const nested = answeredAction(r.option, a.params);
  return nested === null ? [] : warningsWithRegistry(state, nested);
}

/** S12-2: the decision's inbox message is answered at action time (the pipeline's defaults are marked by collation). */
function markMessageAnswered(draft: GameState, decId: DecisionAnswerAction['decisionId']): void {
  for (const id of draft.inbox.messageIds) {
    const m = draft.inbox.messages[id];
    if (m !== undefined && m.decisionId === decId && m.status === 'open') m.status = 'answered';
  }
}

function handle(draft: GameState, a: DecisionAnswerAction, ctx: HandlerContext): void {
  const d = ownValue(draft.inbox.decisions, a.decisionId) as PendingDecision;
  const option = findOption(d, a.optionId) as DecisionOption;
  const nested = answeredAction(option, a.params);
  if (nested !== null) ctx.applyNested(nested);
  closeDecision(draft, a.decisionId, ctx.origin === 'pipeline' ? 'defaulted' : 'answered', a.optionId);
  if (ctx.origin === 'player') markMessageAnswered(draft, a.decisionId);
  ctx.effect({ kind: 'decision', decId: a.decisionId });
}

export const decisionAnswerDef: ActionDef<DecisionAnswerAction> = {
  type: 'decision/answer',
  ownerSection: 13,
  // The answer itself reveals and commits nothing; the option's action carries its own flags through applyNested.
  reveals: false,
  commits: false,
  fromPhase: 0,
  validate,
  warnings,
  handle,
};
