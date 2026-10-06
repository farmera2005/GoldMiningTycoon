// §13.18 `game` slice: the loaded game, its recent week reports, the within-week undo stack and the action log. The
// engine client is the only writer; components read it through selectors. Retention follows §13.25's ui.* keys.
import { uiConfig } from '../../data/tuning/ui';
import type { Action, Cents, GameState, LoggedAction, WeekReport } from '../../engine';

/** The small per-week record kept for ui.reportsInMemory weeks (13.22 "store the report summary (13 kept)"). */
export interface WeekReportSummary {
  readonly turn: number;
  readonly cashEndCents: Cents;
  readonly alerts: number;
  readonly stopCandidates: number;
}

export interface UndoEntry {
  readonly prev: GameState;
  readonly action: Action;
}

/** Why `ui/undo` would refuse right now, beyond an empty stack (13.21 codes). */
export type UndoBlock = 'UNDO_NOT_ALLOWED' | null;

export interface GameSlice {
  readonly state: GameState | null;
  /** Newest first, ≤ ui.reportsInMemory. */
  readonly reports: readonly WeekReportSummary[];
  /** Full reports with calc trees, newest first, ≤ ui.calcRetentionWeeks. */
  readonly calcReports: readonly WeekReport[];
  /** This week only, newest last, ≤ ui.undoMaxEntries (D-13.11). */
  readonly undo: readonly UndoEntry[];
  /**
   * Set by a non-undoable action since the last advance (D-13.77): undoing past it would re-roll or un-see (13.26),
   * so once the stack is empty again `ui/undo` refuses with this code. Only Advance, a new game or a load clear it.
   */
  readonly undoBlock: UndoBlock;
  readonly actionLog: readonly LoggedAction[];
  /** The manual slot this game was last saved to or loaded from (Ctrl+S target), or null. */
  readonly slotId: string | null;
  /** Any action or week since the last successful write (the top bar's dot, 13.16). */
  readonly dirty: boolean;
  /** The turn of the last successful write of this game, for `Saved Wk N`. */
  readonly savedTurn: number | null;
  /** Bumps on every new game or load, so a late autosave of an earlier game cannot mark this one saved. */
  readonly epoch: number;
}

export const EMPTY_GAME: GameSlice = {
  state: null,
  reports: [],
  calcReports: [],
  undo: [],
  undoBlock: null,
  actionLog: [],
  slotId: null,
  dirty: false,
  savedTurn: null,
  epoch: 0,
};

/** Prepends `item` and keeps at most `max` (newest-first lists). */
export function pushNewest<T>(list: readonly T[], item: T, max: number): T[] {
  return [item, ...list].slice(0, Math.max(0, max));
}

/** Appends an undo entry, dropping the oldest beyond ui.undoMaxEntries. */
export function pushUndo(stack: readonly UndoEntry[], entry: UndoEntry): UndoEntry[] {
  const max = uiConfig['ui.undoMaxEntries'];
  return [...stack, entry].slice(Math.max(0, stack.length + 1 - max));
}
