// The engine's only public surface (DESIGN §2.2). The UI, the simulator, bots and cross-cutting tests use nothing
// else; everything here is pure and deterministic (same seed + setup + action log ⇒ byte-identical states and reports).

// Lifecycle
export { newGame, type NewGameOptions } from './state/newGame';
export { applyAction, validateAction } from './actions/apply';
export { advanceWeek, type AdvanceOpts } from './turn/advanceWeek';
export { canAdvance, type AdvanceRefusal } from './turn/guard';
export { runToNextDecision, type RunOpts, type RunResult } from './turn/runToNextDecision';
export {
  defaultRunAnchor,
  defaultStopRules,
  evaluateStops,
  upcomingDeadlines,
  type DeadlineItem,
  type ListingFilter,
  type RunAnchor,
  type StopReason,
  type StopReasonKind,
  type StopRule,
} from './turn/stops';
export { EngineGuardError } from './core/assert';

// Derived values
export { effective, EffectiveError } from './systems/events/effective';
export { select, type DateView, type Selectors } from './select';
export { explain, type ExplainRef, type ExplainerName, type Explainers } from './explain';

// Setup and tuning
export {
  DEFAULT_DISTRICT_TEMPLATES,
  NAME_MAX_LENGTH,
  SetupError,
  defaultNewGameSetup,
  validateSetup,
  type BackedTerms,
  type Difficulty,
  type EntityType,
  type GameMode,
  type NewGameSetup,
  type OwnerBackground,
  type RegionTemplateId,
  type ScenarioId,
  type SetupErrorCode,
  type SetupIssue,
  type StartType,
} from './state/setup';
export { TuningError, resolveTuning, tuningHashOf, type TuningOverrides } from './state/tuning';
export { BUILD_RULES_PHASE, RULES_VERSION, rulesAtLeast } from './state/rules';
export { hashState } from './state/hash';
export { setEngineAutoFreeze } from './state/immutability';

// Saves and replays
export { CURRENT_SCHEMA_VERSION, MIGRATIONS, MigrationError, migrateSave } from './save/migrations';
export {
  BUILD_TUNING_HASH,
  createSaveCodec,
  parseSaveFile,
  saveCodec,
  serializeSaveFile,
  toSaveFile,
  type EngineSaveCodec,
  type SaveCodecConfig,
  type ToSaveFileOptions,
} from './save/saveFile';
export {
  SAVE_FORMAT,
  type Migration,
  type MigrationOutcome,
  type ParseSaveResult,
  type SaveError,
  type SaveErrorCode,
  type SaveFile,
  type SaveNotice,
  type SaveSummary,
  type UiPersisted,
  type VersionedSave,
} from './save/types';
export {
  REPLAY_FORMAT,
  ReplayError,
  replayLog,
  type ReplayLog,
  type ReplayOptions,
  type ReplayResult,
  type TurnHash,
} from './save/replay';

// Types
export type { GameMeta, GameState, Clock, IdCounters, RulesPhase } from './state/types';
export type {
  Action,
  ActionEffect,
  ActionError,
  ActionErrorCode,
  ActionResult,
  ClosedDecision,
  DecisionAnswerAction,
  DecisionOption,
  LoggedAction,
  PendingDecision,
  ValidationResult,
} from './actions/types';
export type { CleanupResult, OpsHint, StopCandidate, WeekOpsResult, WeekReport, WeekResult } from './turn/types';
export type {
  AlertKind,
  AlertSignal,
  InboxMessage,
  InboxSlice,
  Severity,
  SuggestedAction,
} from './systems/inbox/types';
export { ALERT_KINDS } from './systems/inbox/types';
export type { CompanySlice, EndReason, LiquidationPath, RunStatus } from './systems/company/types';
export type { Book, FinanceSlice, LedgerFilter, PostingEntry, PostingLine, Txn } from './systems/finance/types';
export type { NetWorthMode } from './systems/finance/netWorth';
export type { HistoryMetric, HistorySlice, MarketSnapshot, WeekSnapshot, YearRollup } from './systems/history/types';
export type { ClimateSlice, SeasonPhase } from './systems/climate/types';
export type { EffectModifier, EffectQuery, EffectScope, EventsSlice, HookKey } from './systems/events/types';
export type { CalcNode, Unit } from './core/calc';
export type { Cents, MilliOz } from './core/money';
export type { DecId, EntityKind, EntityRef, Id, IdPrefix, MsgId } from './core/ids';
export { compareIds } from './core/ids';
