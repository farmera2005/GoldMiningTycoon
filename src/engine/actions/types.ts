// Actions and decisions (DESIGN §2.2). Every player decision is a JSON-serializable Action with a `type` discriminant
// (`family/verb`) that goes through applyAction; actions carry intent, never derived numbers. Each action type has a
// registry row (ActionDef) with a pure validator, an Immer handler and its declared `reveals` / `commits` flags.
import type { DecId, EntityRef, Id } from '../core/ids';
import type { rng } from '../core/rng';
import type { AlertSignal } from '../systems/inbox/types';
import type { GameState } from '../state/types';

/** §13 13.21 `decision/answer`: applies the chosen option's stored action and closes the decision. */
export interface DecisionAnswerAction {
  type: 'decision/answer';
  decisionId: DecId;
  optionId: string;
  /** Extra intent fields merged into the option's action (never `type`). */
  params?: Record<string, string | number | boolean>;
}

/** Every engine action. Each owning section adds its family to this union with its phase (P1+). */
export type Action = DecisionAnswerAction;

/** Any action-shaped object (the registry's view; test-only actions use it too). */
export interface AnyAction {
  readonly type: string;
}

/** Typed validation codes (§2.2 "Validation is total"). Sections add theirs with their actions. */
export type ActionErrorCode =
  | 'ACTION_UNKNOWN'
  | 'ACTION_MALFORMED'
  | 'GAME_OVER'
  | 'DECISION_NOT_FOUND'
  | 'DECISION_CLOSED'
  | 'OPTION_INVALID'
  | 'INSUFFICIENT_FUNDS';

export interface ActionError {
  code: ActionErrorCode;
  message: string;
  /** For a `decision/answer` whose option's action failed: that action's error. */
  cause?: ActionError;
}

export type ValidationResult = { ok: true } | { ok: false; error: ActionError };

export type ActionEffect =
  | { kind: 'alert'; signal: AlertSignal }
  | { kind: 'ledger'; txnId: Id }
  | { kind: 'entity'; ref: EntityRef; change: 'created' | 'updated' | 'ended' }
  | { kind: 'decision'; decId: DecId };

export type ActionResult =
  { ok: true; state: GameState; effects: ActionEffect[]; undoable: boolean } | { ok: false; error: ActionError };

/** One entry of a replayable action log (§2.9 `SaveFile.actionLog`, §13 13.18). */
export interface LoggedAction {
  turn: number;
  actionSeq: number;
  action: Action;
}

/** Where a handler runs: at the player's request, or applied by the pipeline (a decision default at its deadline). */
export type ActionOrigin = 'player' | 'pipeline';

/**
 * What a handler may use besides the draft. `rng` has core rng's signature and records that a stream was drawn on, so
 * the engine can set `undoable: false` (D-2.22); handlers must draw only through it. `markReveals` / `markCommits`
 * cover handlers whose reveal or commitment depends on the action's parameters.
 */
export interface HandlerContext {
  readonly origin: ActionOrigin;
  readonly turn: number;
  readonly rng: typeof rng;
  /** Reports an effect (copied, so it may be built from draft values). */
  effect(e: ActionEffect): void;
  markReveals(): void;
  markCommits(): void;
  /**
   * Applies an already-validated nested action to the same draft with this context, so its draws and its row's
   * `reveals` / `commits` count toward the outer action (a decision option's stored action, §2.2).
   */
  applyNested(action: AnyAction): void;
}

/** A registry row (§2.2). Method syntax keeps rows for specific action types assignable to the registry's view. */
export interface ActionDef<A extends AnyAction = AnyAction> {
  readonly type: A['type'];
  readonly ownerSection: number;
  /** Reveals hidden information (inspection reports, records findings, test results). */
  readonly reveals: boolean;
  /** Commits to a counterparty (offer sent, bid placed, order placed, hire). */
  readonly commits: boolean;
  /** Pure: a typed error, or null when the action may be applied to `state`. Must check the action's shape too. */
  validate(state: GameState, action: A): ActionError | null;
  /** Applies a validated action to an Immer draft of the state. */
  handle(draft: GameState, action: A, ctx: HandlerContext): void;
}

/** §2.2 `PendingDecision`, stored in `inbox.decisions` (sorted ids). */
export interface DecisionOption {
  id: string;
  labelKey: string;
  action: Action;
  consequenceKey: string;
}

export interface PendingDecision {
  id: DecId;
  kind: string;
  ownerSection: number;
  blocking: boolean;
  createdTurn: number;
  deadlineTurn: number;
  options: DecisionOption[];
  /** Required when blocking is false. */
  defaultOptionId?: string;
  context: { templateKey: string; params: Record<string, string | number>; subject: EntityRef[] };
}

/** A closed decision, kept for `DECISION_CLOSED` and the inbox until `game.alerts.inboxRetentionWeeks` pass. */
export interface ClosedDecision {
  id: DecId;
  kind: string;
  closedTurn: number;
  outcome: 'answered' | 'defaulted';
  optionId: string;
  /** Set when a default's action could not be applied at the deadline (its validator refused it). */
  errorCode?: ActionErrorCode;
}
