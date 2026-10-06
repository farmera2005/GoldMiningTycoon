// §13.18 `UiPersisted`: presentation state saved in `SaveFile.ui`, outside GameState, so it never changes a replay or
// a state hash (D-13.3). The engine treats it as opaque; this module owns its shape, its defaults, reading it back
// from a save (field by field, so a damaged or older block never blocks a load) and the save-time pruning rules.
import { uiConfig } from '../../data/tuning/ui';
import {
  defaultStopRules,
  type GameState,
  type ListingFilter,
  type MsgId,
  type StopRule,
  type WeekReport,
} from '../../engine';
import { GAME_ID_PATTERN } from './gameId';

/**
 * Bumps when this shape changes; `readUiPersisted` migrates older blocks forward. v2 added `gameId` (13.16 per-game
 * autosaves): a v1 block, or a save with none, takes the id the caller derives from the save.
 */
export const UI_PERSISTED_VERSION = 2;

export interface InboxFlags {
  readonly read: boolean;
  readonly archived: boolean;
  readonly snoozedUntilTurn?: number;
}

export interface SavedSearch {
  readonly id: string;
  readonly screen: 'claims' | 'equipment';
  readonly filter: ListingFilter;
  readonly alert: boolean;
}

export interface SearchNotice {
  readonly searchId: string;
  readonly listingIds: readonly string[];
  readonly turn: number;
}

export interface TableLayout {
  readonly columns: readonly string[];
  readonly sort: readonly { readonly id: string; readonly desc: boolean }[];
  readonly filters: readonly { readonly id: string; readonly value: unknown }[];
}

export interface TutorialProgress {
  readonly enabled: boolean;
  readonly completed: readonly string[];
  readonly dismissed: readonly string[];
}

// A type alias (not an interface) so it is assignable to the engine's opaque `Readonly<Record<string, unknown>>`.
export type UiPersisted = {
  /** Pruned at save to message ids still in state (T22). */
  readonly inbox: Readonly<Record<MsgId, InboxFlags>>;
  readonly stopRules: readonly StopRule[];
  readonly savedSearches: readonly SavedSearch[];
  readonly searchNotices: readonly SearchNotice[];
  /** §13 `SeasonBaseline` per claim and year (P1). */
  readonly baselines: Readonly<Record<string, Readonly<Record<string, unknown>>>>;
  readonly tableLayouts: Readonly<Record<string, TableLayout>>;
  readonly tutorial: TutorialProgress;
  /** ≤ ui.calcPersistWeeks full calc reports; omitted above ui.persistReportMaxKb (D-13.10, D-13.54). */
  readonly recentReports: readonly WeekReport[];
  /** UI-only: one slot plus autosave, no undo (13.14, 13.16). */
  readonly ironman: boolean;
  /**
   * The game's identity (ui/store/gameId.ts): minted at `ui/newGame`, kept through every save, load, export and
   * import, so autosave rotation and year-start snapshots stay per game (13.16). '' only while no game is loaded.
   */
  readonly gameId: string;
  readonly uiVersion: number;
};

/** §13.9 default stop rules with §13.25's ui.* parameters (the engine cannot read ui.*, D-13.32). */
export function uiDefaultStopRules(): StopRule[] {
  return defaultStopRules({
    deadlineNoticeWeeks: uiConfig['ui.runDeadlineNoticeWeeks'],
    goldMoveStopPct: uiConfig['ui.runGoldMoveStopPct'],
  });
}

export function defaultUiPersisted(
  options: { readonly ironman?: boolean; readonly tutorial?: boolean; readonly gameId?: string } = {},
): UiPersisted {
  return {
    inbox: {},
    stopRules: uiDefaultStopRules(),
    savedSearches: [],
    searchNotices: [],
    baselines: {},
    tableLayouts: {},
    tutorial: { enabled: options.tutorial ?? false, completed: [], dismissed: [] },
    recentReports: [],
    ironman: options.ironman ?? false,
    gameId: options.gameId ?? '',
    uiVersion: UI_PERSISTED_VERSION,
  };
}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const strings = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);

function readInbox(v: unknown): Record<MsgId, InboxFlags> {
  const out: Record<string, InboxFlags> = {};
  if (!isRec(v)) return out;
  for (const [id, flags] of Object.entries(v)) {
    if (!isRec(flags)) continue;
    const entry: InboxFlags = { read: flags['read'] === true, archived: flags['archived'] === true };
    const snooze = flags['snoozedUntilTurn'];
    out[id] = Number.isSafeInteger(snooze) ? { ...entry, snoozedUntilTurn: snooze as number } : entry;
  }
  return out as Record<MsgId, InboxFlags>;
}

const STOP_RULE_KINDS: readonly StopRule['kind'][] = [
  'warningKinds',
  'seasonPhase',
  'deadlineWithin',
  'everyCleanup',
  'goldMove',
  'cashBelow',
  'machineFailure',
  'listingMatch',
  'monthStart',
  'atTurn',
];

/** Stop rules are kept when every entry names a known kind; otherwise the defaults apply (editing is P2). */
function readStopRules(v: unknown): StopRule[] {
  if (!Array.isArray(v) || v.length === 0) return uiDefaultStopRules();
  const known = v.every((r) => isRec(r) && STOP_RULE_KINDS.includes(r['kind'] as StopRule['kind']));
  return known ? (v as StopRule[]) : uiDefaultStopRules();
}

function readTutorial(v: unknown): TutorialProgress {
  if (!isRec(v)) return defaultUiPersisted().tutorial;
  return { enabled: v['enabled'] === true, completed: strings(v['completed']), dismissed: strings(v['dismissed']) };
}

function readReports(v: unknown): WeekReport[] {
  if (!Array.isArray(v)) return [];
  return v.filter((r): r is WeekReport => isRec(r) && Number.isSafeInteger(r['turn']) && Array.isArray(r['alerts']));
}

function readGameId(v: unknown, fallback: string): string {
  return typeof v === 'string' && GAME_ID_PATTERN.test(v) ? v : fallback;
}

/**
 * Reads `SaveFile.ui` from any build: a missing block gives the defaults, and each field is read on its own so one
 * damaged field keeps the others. A block without a usable `gameId` (v1, or none) takes `fallbackGameId`, which the
 * caller derives from the save (legacyGameId), so the same old save always loads as the same game.
 */
export function readUiPersisted(raw: unknown, fallbackGameId: string): UiPersisted {
  if (!isRec(raw)) return defaultUiPersisted({ gameId: fallbackGameId });
  return {
    inbox: readInbox(raw['inbox']),
    stopRules: readStopRules(raw['stopRules']),
    savedSearches: Array.isArray(raw['savedSearches']) ? (raw['savedSearches'] as SavedSearch[]) : [],
    searchNotices: Array.isArray(raw['searchNotices']) ? (raw['searchNotices'] as SearchNotice[]) : [],
    baselines: isRec(raw['baselines']) ? (raw['baselines'] as UiPersisted['baselines']) : {},
    tableLayouts: isRec(raw['tableLayouts']) ? (raw['tableLayouts'] as UiPersisted['tableLayouts']) : {},
    tutorial: readTutorial(raw['tutorial']),
    recentReports: readReports(raw['recentReports']),
    ironman: raw['ironman'] === true,
    gameId: readGameId(raw['gameId'], fallbackGameId),
    uiVersion: UI_PERSISTED_VERSION,
  };
}

/** UTF-8 size of a value's JSON in kB (1 kB = 1,000 bytes, as the 13.25 budgets count). */
export function jsonKb(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length / 1000;
}

/**
 * The persisted calc reports for a save: the newest ≤ ui.calcPersistWeeks full reports, skipping any that serializes
 * above ui.persistReportMaxKb (D-13.10, D-13.54; older numbers then explain from history and the ledger).
 */
export function reportsToPersist(newestFirst: readonly WeekReport[]): WeekReport[] {
  return newestFirst
    .slice(0, uiConfig['ui.calcPersistWeeks'])
    .filter((r) => jsonKb(r) <= uiConfig['ui.persistReportMaxKb']);
}

/** Save-time form: inbox flags pruned to messages still in state (T22) and the recent reports capped. */
export function persistedForSave(
  persisted: UiPersisted,
  state: GameState,
  calcReportsNewestFirst: readonly WeekReport[],
): UiPersisted {
  const inbox: Record<string, InboxFlags> = {};
  for (const [id, flags] of Object.entries(persisted.inbox)) {
    if (Object.hasOwn(state.inbox.messages, id)) inbox[id] = flags;
  }
  return {
    ...persisted,
    inbox: inbox as Record<MsgId, InboxFlags>,
    recentReports: reportsToPersist(calcReportsNewestFirst),
  };
}
