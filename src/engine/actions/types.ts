// Actions and decisions (DESIGN §2.2; P1 contract §1.2). Every player decision is a JSON-serializable Action with a
// `type` discriminant (`family/verb`) that goes through applyAction; actions carry intent, never derived numbers. Each
// action type has a registry row (ActionDef) with a pure validator, optional non-blocking warnings, an Immer handler,
// its declared `reveals` / `commits` flags and the first rules phase it exists in. The unions below fold in every
// folder's actions.ts (s02 #11), so an owner adds its actions and codes without editing this file.
import type { DecId, EntityRef, Id } from '../core/ids';
import type { rng } from '../core/rng';
import type { AlertSignal } from '../systems/inbox/types';
import type { GameState, RulesPhase } from '../state/types';
import type { ClimateAction, CLIMATE_ERROR_CODES, CLIMATE_WARNING_CODES } from '../systems/climate/actions';
import type { CompanyAction, COMPANY_ERROR_CODES, COMPANY_WARNING_CODES } from '../systems/company/actions';
import type {
  CompetitorsAction,
  COMPETITORS_ERROR_CODES,
  COMPETITORS_WARNING_CODES,
} from '../systems/competitors/actions';
import type { EventsAction, EVENTS_ERROR_CODES, EVENTS_WARNING_CODES } from '../systems/events/actions';
import type { FinanceAction, FINANCE_ERROR_CODES, FINANCE_WARNING_CODES } from '../systems/finance/actions';
import type { FleetAction, FLEET_ERROR_CODES, FLEET_WARNING_CODES } from '../systems/fleet/actions';
import type { GoldAction, GOLD_ERROR_CODES, GOLD_WARNING_CODES } from '../systems/gold/actions';
import type { HistoryAction, HISTORY_ERROR_CODES, HISTORY_WARNING_CODES } from '../systems/history/actions';
import type { InboxAction, INBOX_ERROR_CODES, INBOX_WARNING_CODES } from '../systems/inbox/actions';
import type { InvestorsAction, INVESTORS_ERROR_CODES, INVESTORS_WARNING_CODES } from '../systems/investors/actions';
import type { KnowledgeAction, KNOWLEDGE_ERROR_CODES, KNOWLEDGE_WARNING_CODES } from '../systems/knowledge/actions';
import type { LandAction, LAND_ERROR_CODES, LAND_WARNING_CODES } from '../systems/land/actions';
import type { OpsAction, OPS_ERROR_CODES, OPS_WARNING_CODES } from '../systems/ops/actions';
import type { PermitsAction, PERMITS_ERROR_CODES, PERMITS_WARNING_CODES } from '../systems/permits/actions';
import type { StaffAction, STAFF_ERROR_CODES, STAFF_WARNING_CODES } from '../systems/staff/actions';
import type { WorldAction, WORLD_ERROR_CODES, WORLD_WARNING_CODES } from '../systems/world/actions';

/** §13 13.21 `decision/answer`: applies the chosen option's stored action (if any) and closes the decision. */
export interface DecisionAnswerAction {
  type: 'decision/answer';
  decisionId: DecId;
  optionId: string;
  /** Extra intent fields merged into the option's action (never `type`). */
  params?: Record<string, string | number | boolean>;
}

/** Every engine action: §2's `decision/answer` and every folder's family. */
export type Action =
  | DecisionAnswerAction
  | ClimateAction
  | CompanyAction
  | InvestorsAction
  | HistoryAction
  | WorldAction
  | KnowledgeAction
  | LandAction
  | PermitsAction
  | OpsAction
  | StaffAction
  | FleetAction
  | GoldAction
  | FinanceAction
  | EventsAction
  | CompetitorsAction
  | InboxAction;

/** Any action-shaped object (the registry's view; test-only actions use it too). */
export interface AnyAction {
  readonly type: string;
}

/** §2's own validation codes; they apply to every action type. */
export const FRAMEWORK_ERROR_CODES = [
  'ACTION_UNKNOWN',
  'ACTION_MALFORMED',
  'GAME_OVER',
  'DECISION_NOT_FOUND',
  'DECISION_CLOSED',
  'OPTION_INVALID',
  'INSUFFICIENT_FUNDS',
  /** A registered action whose owner has not implemented it yet (a Wave-0 stub row, P1 contract §0.2). */
  'NOT_IMPLEMENTED',
  /** The action exists only from a later rules phase than the game's (`ActionDef.fromPhase`). */
  'ACTION_NOT_IN_PHASE',
] as const;

export type FrameworkErrorCode = (typeof FRAMEWORK_ERROR_CODES)[number];

type CodesOf<T extends readonly string[]> = T[number];

/** Typed validation codes (§2.2 "Validation is total"): a closed union, one list per folder. */
export type ActionErrorCode =
  | FrameworkErrorCode
  | CodesOf<typeof CLIMATE_ERROR_CODES>
  | CodesOf<typeof COMPANY_ERROR_CODES>
  | CodesOf<typeof INVESTORS_ERROR_CODES>
  | CodesOf<typeof HISTORY_ERROR_CODES>
  | CodesOf<typeof WORLD_ERROR_CODES>
  | CodesOf<typeof KNOWLEDGE_ERROR_CODES>
  | CodesOf<typeof LAND_ERROR_CODES>
  | CodesOf<typeof PERMITS_ERROR_CODES>
  | CodesOf<typeof OPS_ERROR_CODES>
  | CodesOf<typeof STAFF_ERROR_CODES>
  | CodesOf<typeof FLEET_ERROR_CODES>
  | CodesOf<typeof GOLD_ERROR_CODES>
  | CodesOf<typeof FINANCE_ERROR_CODES>
  | CodesOf<typeof EVENTS_ERROR_CODES>
  | CodesOf<typeof COMPETITORS_ERROR_CODES>
  | CodesOf<typeof INBOX_ERROR_CODES>;

/** Non-blocking warning codes (s07 #3, S13-3), registered like error codes; §2 has none of its own. */
export type ActionWarningCode =
  | CodesOf<typeof CLIMATE_WARNING_CODES>
  | CodesOf<typeof COMPANY_WARNING_CODES>
  | CodesOf<typeof INVESTORS_WARNING_CODES>
  | CodesOf<typeof HISTORY_WARNING_CODES>
  | CodesOf<typeof WORLD_WARNING_CODES>
  | CodesOf<typeof KNOWLEDGE_WARNING_CODES>
  | CodesOf<typeof LAND_WARNING_CODES>
  | CodesOf<typeof PERMITS_WARNING_CODES>
  | CodesOf<typeof OPS_WARNING_CODES>
  | CodesOf<typeof STAFF_WARNING_CODES>
  | CodesOf<typeof FLEET_WARNING_CODES>
  | CodesOf<typeof GOLD_WARNING_CODES>
  | CodesOf<typeof FINANCE_WARNING_CODES>
  | CodesOf<typeof EVENTS_WARNING_CODES>
  | CodesOf<typeof COMPETITORS_WARNING_CODES>
  | CodesOf<typeof INBOX_WARNING_CODES>;

export interface ActionError {
  code: ActionErrorCode;
  message: string;
  /** For a `decision/answer` whose option's action failed: that action's error. */
  cause?: ActionError;
}

/** A non-blocking note on a valid action (the action still applies): plan warnings, `SMALL_CREW_ENDS`, … */
export interface ActionWarning {
  code: ActionWarningCode;
  message: string;
  subject?: EntityRef[];
}

export type ValidationResult = { ok: true; warnings: ActionWarning[] } | { ok: false; error: ActionError };

export type ActionEffect =
  | { kind: 'alert'; signal: AlertSignal }
  | { kind: 'ledger'; txnId: Id }
  | { kind: 'entity'; ref: EntityRef; change: 'created' | 'updated' | 'ended' }
  | { kind: 'decision'; decId: DecId };

export type ActionResult =
  | { ok: true; state: GameState; effects: ActionEffect[]; undoable: boolean; warnings: ActionWarning[] }
  | { ok: false; error: ActionError };

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
  /** The first rules phase the action exists in; a game on an earlier phase gets ACTION_NOT_IN_PHASE. */
  readonly fromPhase: RulesPhase;
  /** Set only by `stubActionDef` (P1 contract §0.2): the row validates to NOT_IMPLEMENTED until its owner lands. */
  readonly stub?: true;
  /** Pure: a typed error, or null when the action may be applied to `state`. Must check the action's shape too. */
  validate(state: GameState, action: A): ActionError | null;
  /** Pure, called only when `validate` passed: non-blocking warnings about a valid action (s07 #3, S13-3). */
  warnings?(state: GameState, action: A): ActionWarning[];
  /** Applies a validated action to an Immer draft of the state. */
  handle(draft: GameState, action: A, ctx: HandlerContext): void;
}

/** §2.2 `PendingDecision` option; an option without `action` closes the decision with no other effect (S08-14). */
export interface DecisionOption {
  id: string;
  labelKey: string;
  action?: Action;
  consequenceKey: string;
}

/** §2.2 `PendingDecision`, stored in `inbox.decisions` (sorted ids). */
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
