// The engine's only public surface (DESIGN §2.2). The UI, the simulator, bots and cross-cutting tests use nothing
// else; everything here is pure and deterministic (same seed + setup + action log ⇒ byte-identical states and reports).

// Lifecycle
export { newGame, type NewGameOptions } from './state/newGame';
export { applyAction, validateAction } from './actions/apply';
export { registeredActionTypes, stubbedActionTypes } from './actions/registry';
export { advanceWeek, type AdvanceOpts } from './turn/advanceWeek';
export { canAdvance, type AdvanceRefusal } from './turn/guard';
export { runToNextDecision, type RunOpts, type RunResult } from './turn/runToNextDecision';
export {
  defaultRunAnchor,
  defaultStopRules,
  evaluateStops,
  STOP_RULE_DEFAULTS,
  type StopRuleParams,
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
export { qBlock, qClaim, qCompany, qDistrict, qEmployee, qMachine } from './systems/events/queries';
export { select, type DateView, type RunOutcome, type Selectors } from './select';
export { explain, type ExplainRef, type ExplainerName, type Explainers } from './explain';
export { CASH_ON_HAND_ACCOUNTS } from './explain/cash';
export {
  CalcKeyError,
  SYSTEM_FOLDERS,
  parseReportCalcKey,
  reportCalcKey,
  type ReportCalcKeyParts,
  type SystemFolder,
} from './turn/calcKeys';

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
export { templatesAvailable } from './state/setup';
export { previewStart, startsAvailable } from './systems/company/start';
export { BUILD_RULES_PHASE, RULES_VERSION, rulesAtLeast } from './state/rules';
export { hashState } from './state/hash';
export { setEngineAutoFreeze } from './state/immutability';
export { ContractStubError } from './core/assert';

// Fixture games (sim/ and tests only; the UI may not import them)
export { newFixtureGame, type FixtureSpec, type ReferenceClaimSpec } from './state/fixture';
export * as fixtures from './state/fixture';

// Saves and replays
export {
  CURRENT_SCHEMA_VERSION,
  MIGRATIONS,
  MIN_SUPPORTED_SCHEMA_VERSION,
  MigrationError,
  migrateSave,
} from './save/migrations';
export {
  BUILD_TUNING_HASH,
  createSaveCodec,
  parseSaveFile,
  saveCodec,
  saveTooOldMessage,
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
  ActionWarning,
  ActionWarningCode,
  ClosedDecision,
  DecisionAnswerAction,
  DecisionOption,
  FrameworkErrorCode,
  LoggedAction,
  PendingDecision,
  ValidationResult,
} from './actions/types';
export { FRAMEWORK_ERROR_CODES } from './actions/types';
export { emptyWeekRecords } from './turn/week';
export type {
  ClaimOpsReport,
  CleanupChainRecord,
  CleanupResult,
  OpsHint,
  StopCandidate,
  WeekOpsResult,
  WeekRecords,
  WeekReport,
  WeekResult,
} from './turn/types';
export type {
  AlertKind,
  AlertSignal,
  InboxMessage,
  InboxSlice,
  Severity,
  SuggestedAction,
} from './systems/inbox/types';
export { ALERT_KINDS } from './systems/inbox/types';
export { ALERT_TAXONOMY, alertKindsInPhase, type AlertTaxonomyRow } from './systems/inbox/taxonomy';
export type { CompanySlice, EndReason, LiquidationPath, RunStatus } from './systems/company/types';
export type { Book, FinanceSlice, LedgerFilter, PostingEntry, PostingLine, Txn } from './systems/finance/types';
export type { NetWorthMode } from './systems/finance/netWorth';
export type {
  ClaimWeekSnapshot,
  CompanySnapshot,
  HistoryMetric,
  HistorySlice,
  MarketSnapshot,
  WeekSnapshot,
  YearRollup,
} from './systems/history/types';
export { HISTORY_METRIC_INFO, type HistoryMetricInfo } from './systems/history/metrics';
export type { ClimateSlice, SeasonPhase } from './systems/climate/types';
export type { EffectModifier, EffectQuery, EffectScope, EventsSlice, HookKey } from './systems/events/types';
export type { CalcNode, Unit } from './core/calc';
export type { Cents, MilliOz } from './core/money';
export type {
  BillId,
  BlockId,
  CandidateId,
  ClaimId,
  ClaimListingId,
  DecId,
  DistrictId,
  EmployeeId,
  EntityKind,
  EntityRef,
  EquipListingId,
  Id,
  IdPrefix,
  LineId,
  LoanId,
  LocalBuyerId,
  LotId,
  MachineId,
  MsgId,
  ObligationId,
  ProgramId,
  TenureId,
} from './core/ids';

// Owners' public types (P1 contract §1.10, §4)
export type {
  EndReport,
  InvestorAgreement,
  Owner,
  OwnerAssignment,
  ReputationKind,
  StartPreview,
} from './systems/company/types';
export type { AccessMode, CalendarMode, Outlook, SeasonView, TempBand, WeatherWeek } from './systems/climate/types';
export type { ClaimAccess, DistrictMap, ListingInfo, SellerTell, SiteVisitQuote } from './systems/world/types';
export type { ClaimEstimate, KnowledgeSlice } from './systems/knowledge/types';
export type { ProspectProgram, ProspectReport, SellerCheck } from './systems/knowledge/programTypes';
export type { Listing, ProductionInterest, Settlement, Tenure } from './systems/land/types';
export type { ListingView, TenureView } from './systems/land/select';
export type { Obligation, ObligationKind } from './systems/permits/types';
export type {
  ClaimOps,
  MinePlan,
  OpsRole,
  PlantLine,
  ProductionForecast,
  SiteStatus,
  WhatIfHint,
} from './systems/ops/types';
export type { Assignment, Candidate, Employee, ForemanInfo, Role, SupervisorKind } from './systems/staff/types';
export type { CandidateView, EmployeeView, RosterRow } from './systems/staff/select';
export type { PayOffer } from './systems/staff/actions';
export type { BrandId, ClassId, EquipmentListing, Grade, Machine, MachineOption, ModelId } from './systems/fleet/types';
export type { EquipmentListingView, MachineView } from './systems/fleet/select';
export type { ChannelQuote, GoldLot, LocalBuyer, StandingSaleOrder } from './systems/gold/types';
export type { GoldLotView, LocalBuyerView } from './systems/gold/select';
export type {
  Bill,
  DistressStatusP1,
  FinancePeriod,
  Forecast13Week,
  Loan,
  PayCategory,
  PayrollLine,
} from './systems/finance/types';
export type { EventInstance } from './systems/events/types';
export { compareIds } from './core/ids';
