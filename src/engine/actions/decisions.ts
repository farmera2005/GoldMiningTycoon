// Pending decisions (DESIGN §2.2 "Decisions"). Owners create them at action time or in any pipeline step. A blocking
// decision created mid-week does not interrupt the pipeline: the week completes, then canAdvance refuses the next week
// until it is answered. A non-blocking decision carries a defaultOptionId, applied at its deadline by its owner's step
// or, failing that, by the step-16 wrap-up. The record functions here mutate Immer drafts.
import { nextId, type DecId } from '../core/ids';
import { insertSortedId, removeSortedId } from '../core/iter';
import { cloneJson } from '../state/immutability';
import type { GameState } from '../state/types';
import { ownValue } from './own';
import type { ActionErrorCode, ClosedDecision, PendingDecision } from './types';

/** What an owner supplies; the id and createdTurn are assigned here. */
export type DecisionSpec = Omit<PendingDecision, 'id' | 'createdTurn'>;

export class DecisionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DecisionError';
  }
}

function checkSpec(spec: DecisionSpec, turn: number): void {
  if (spec.options.length === 0) throw new DecisionError(`decision ${spec.kind}: needs at least one option`);
  const ids = spec.options.map((o) => o.id);
  if (ids.some((id, i) => ids.indexOf(id) !== i)) {
    throw new DecisionError(`decision ${spec.kind}: option ids must be unique`);
  }
  if (spec.options.some((o) => o.action?.type === 'decision/answer')) {
    throw new DecisionError(`decision ${spec.kind}: an option cannot answer another decision`);
  }
  if (!Number.isSafeInteger(spec.deadlineTurn) || spec.deadlineTurn < turn) {
    throw new DecisionError(`decision ${spec.kind}: deadlineTurn ${spec.deadlineTurn} is before turn ${turn}`);
  }
  if (spec.defaultOptionId !== undefined && !ids.includes(spec.defaultOptionId)) {
    throw new DecisionError(`decision ${spec.kind}: defaultOptionId ${spec.defaultOptionId} is not an option`);
  }
  if (!spec.blocking && spec.defaultOptionId === undefined) {
    throw new DecisionError(`decision ${spec.kind}: a non-blocking decision needs a defaultOptionId`);
  }
}

/** Creates a decision at the draft's current turn and returns its id. */
export function createDecision(draft: GameState, spec: DecisionSpec): DecId {
  checkSpec(spec, draft.clock.turn);
  const id = nextId(draft.ids, 'dec');
  draft.inbox.decisions[id] = { ...cloneJson(spec), id, createdTurn: draft.clock.turn };
  insertSortedId(draft.inbox.decisionIds, id);
  return id;
}

/** Open decisions in ascending id order. */
export function openDecisions(state: GameState): PendingDecision[] {
  const out: PendingDecision[] = [];
  for (const id of state.inbox.decisionIds) {
    const d = ownValue(state.inbox.decisions, id);
    if (d !== undefined) out.push(d);
  }
  return out;
}

export function hasOpenBlockingDecision(state: GameState): boolean {
  return openDecisions(state).some((d) => d.blocking);
}

/** Moves an open decision to the closed records. */
export function closeDecision(
  draft: GameState,
  id: DecId,
  outcome: ClosedDecision['outcome'],
  optionId: string,
  errorCode?: ActionErrorCode,
): void {
  const d = ownValue(draft.inbox.decisions, id);
  if (d === undefined) throw new DecisionError(`closeDecision: ${id} is not open`);
  delete draft.inbox.decisions[id];
  removeSortedId(draft.inbox.decisionIds, id);
  const closed: ClosedDecision = { id, kind: d.kind, closedTurn: draft.clock.turn, outcome, optionId };
  if (errorCode !== undefined) closed.errorCode = errorCode;
  draft.inbox.closedDecisions[id] = closed;
  insertSortedId(draft.inbox.closedDecisionIds, id);
}

/** Drops closed decision records older than the inbox retention (§13 13.10: closed records only). */
export function pruneClosedDecisions(draft: GameState, retentionWeeks: number): void {
  const cutoff = draft.clock.turn - retentionWeeks;
  for (const id of [...draft.inbox.closedDecisionIds]) {
    const c = ownValue(draft.inbox.closedDecisions, id);
    if (c !== undefined && c.closedTurn < cutoff) {
      delete draft.inbox.closedDecisions[id];
      removeSortedId(draft.inbox.closedDecisionIds, id);
    }
  }
}

/** Non-blocking decisions whose deadline has arrived (deadlineTurn ≤ turn), ascending id. */
export function dueDefaultDecisions(state: GameState): PendingDecision[] {
  return openDecisions(state).filter(
    (d) => !d.blocking && d.deadlineTurn <= state.clock.turn && d.defaultOptionId !== undefined,
  );
}
