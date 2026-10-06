// The engine client (DESIGN §13.18): the one place the UI calls the engine and writes the game slice. Single calls run
// synchronously on the main thread (D-13.2); P0 has no Run, so there is no worker yet. It also owns the save side of
// a game: the SaveFile it builds carries the store's `persisted` block as `SaveFile.ui` (never hashed, D-13.3), and
// every week schedules an autosave when the browser is idle (13.16, D-13.25).
import { uiConfig } from '../../data/tuning/ui';
import {
  advanceWeek,
  applyAction,
  defaultNewGameSetup,
  newGame,
  parseSaveFile,
  select,
  toSaveFile,
  validateAction,
  validateSetup,
  type Action,
  type ActionError,
  type GameState,
  type LoggedAction,
  type SaveFile,
  type SetupIssue,
  type ValidationResult,
  type WeekReport,
} from '../../engine';
import {
  exportSave,
  type ExportedFile,
  type Result,
  type SaveEnvelope,
  type SaveNotice,
  type SaveStore,
  type SlotMeta,
} from '../../persistence';
import { EMPTY_GAME, pushNewest, pushUndo, type GameSlice } from '../store/gameSlice';
import { defaultUiPersisted, persistedForSave, readUiPersisted, type UiPersisted } from '../store/persisted';
import type { RunSlice, UiStore } from '../store/store';
import { t } from '../text';
import { summarizeWeek, weekAnnouncement } from './summarize';

/** `ui/advanceWeek` refusals (13.21) plus the client's own "nothing loaded". */
export type AdvanceBlock = 'BLOCKING_DECISION_OPEN' | 'RUN_IN_PROGRESS' | 'GAME_OVER' | 'NO_GAME';
/** `ui/undo` refusals (13.21). */
export type UndoRefusal = 'NOTHING_TO_UNDO' | 'UNDO_NOT_ALLOWED' | 'UNDO_IRONMAN';

export type ClientActionError =
  ActionError | { readonly code: 'NO_GAME' | 'RUN_IN_PROGRESS'; readonly message: string };

export type ApplyOutcome =
  { readonly ok: true; readonly undoable: boolean } | { readonly ok: false; readonly error: ClientActionError };
export type AdvanceOutcome =
  { readonly ok: true; readonly report: WeekReport } | { readonly ok: false; readonly code: AdvanceBlock };
export type NewGameOutcome = { readonly ok: true } | { readonly ok: false; readonly issues: readonly SetupIssue[] };
export type LoadOutcome =
  { readonly ok: true; readonly notices: readonly SaveNotice[] } | { readonly ok: false; readonly message: string };

export interface NewGameInput {
  readonly companyName: string;
  /** The world seed as typed: the engine receives the string only (D-13.28). */
  readonly seed: string;
}

export interface EngineClient {
  /** `ui/newGame` from the wizard: builds the P0 setup, starts the game and writes its first autosave. */
  newGame(input: NewGameInput): NewGameOutcome;
  /** Replaces the game with a loaded save (`ui/load`). `slotId` is the manual slot it came from, if any. */
  load(save: SaveFile, options?: { readonly slotId?: string | null }): void;
  apply(action: Action): ApplyOutcome;
  validate(action: Action): ValidationResult | { readonly ok: false; readonly error: ClientActionError };
  /** Why Advance is unavailable, or null (13.21 `ui/advanceWeek` codes). */
  advanceBlock(): AdvanceBlock | null;
  advance(): AdvanceOutcome;
  undo(): { readonly ok: true } | { readonly ok: false; readonly code: UndoRefusal };
  /** The current game as a §2.9 SaveFile with `ui` = the persisted slice, or null with no game. */
  currentSave(options?: { readonly slotName?: string; readonly includeLog?: boolean }): SaveFile | null;
  /** `ui/save` to a new slot or (`slotId`) over a manual slot. */
  saveToSlot(target?: { readonly slotId?: string; readonly slotName?: string }): Promise<Result<SlotMeta>>;
  /** Ctrl+S (13.15): saves over the current manual slot; false when there is none (or in Ironman). */
  quickSave(): Promise<boolean>;
  /** Reads a slot and loads it (`ui/load`). */
  loadSlot(slot: Pick<SlotMeta, 'slotId' | 'kind'>): Promise<LoadOutcome>;
  /** The current game as an export file (the critical toast's `Export now`). */
  exportCurrent(options?: { readonly gzip?: boolean }): ExportedFile | null;
  /** Resolves once every write that has started (autosaves whose idle moment came, saves) has finished. */
  settled(): Promise<void>;
}

export interface EngineClientOptions {
  readonly store: UiStore;
  readonly saves: SaveStore;
  /** Wall clock for `savedAt` (ISO); the engine never reads a clock. */
  readonly now?: () => string;
  /** Runs a task when the browser is idle; injectable so tests control when autosaves happen. */
  readonly scheduleIdle?: (task: () => void) => void;
}

/** requestIdleCallback where the browser has it, otherwise a zero-delay timeout (13.18). */
export function scheduleWhenIdle(task: () => void): void {
  if (typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(() => task(), { timeout: 2_000 });
  } else {
    setTimeout(task, 0);
  }
}

const NO_GAME_ERROR = { code: 'NO_GAME', message: 'No game is loaded.' } as const;

/** `ui/advanceWeek` validation (13.21) as a pure function of the store, so the top bar can render the reason. */
export function advanceBlockOf(state: GameState | null, runStatus: RunSlice['status']): AdvanceBlock | null {
  if (state === null) return 'NO_GAME';
  if (runStatus !== 'idle') return 'RUN_IN_PROGRESS';
  return select.canAdvance(state);
}

export function createEngineClient(options: EngineClientOptions): EngineClient {
  const { store, saves } = options;
  const now = options.now ?? ((): string => new Date().toISOString());
  const scheduleIdle = options.scheduleIdle ?? scheduleWhenIdle;
  /** Every write runs after the previous one, so autosaves land in week order. */
  let writes: Promise<void> = Promise.resolve();

  const game = (): GameSlice => store.getState().game;
  const persisted = (): UiPersisted => store.getState().persisted;

  function buildSave(state: GameState, slotName: string, includeLog: boolean): SaveFile {
    const g = game();
    const ui = persistedForSave(persisted(), state, g.calcReports);
    const log: LoggedAction[] | undefined = includeLog ? [...g.actionLog] : undefined;
    return toSaveFile(state, { slotName, savedAt: now(), ui, ...(log === undefined ? {} : { actionLog: log }) });
  }

  /** After a successful write: `Saved Wk N`, and clean unless the game moved on while the write was queued. */
  function markSaved(epoch: number, saved: GameState, slotId?: string): void {
    const g = game();
    if (g.epoch !== epoch) return;
    store.getState().setGame({
      savedTurn: saved.clock.turn,
      dirty: g.state !== saved,
      ...(slotId === undefined ? {} : { slotId }),
    });
  }

  function writeAutosave(save: SaveFile, epoch: number): Promise<void> {
    const run = writes.then(async () => {
      const result = await saves.autosave(save as SaveEnvelope);
      if (result.ok) {
        markSaved(epoch, save.state);
      } else {
        store.getState().pushToast({
          severity: 'critical',
          message: t('autosave.failed', { message: result.error.message }),
          action: 'exportNow',
        });
      }
    });
    writes = run.catch(() => undefined);
    return run;
  }

  function scheduleAutosave(): void {
    const g = game();
    if (g.state === null) return;
    // The SaveFile is captured now (states are immutable), so a later week cannot change what this write stores.
    const save = buildSave(g.state, g.state.company.name, false);
    const epoch = g.epoch;
    scheduleIdle(() => void writeAutosave(save, epoch));
  }

  function startGame(state: GameState, ui: UiPersisted, extra: Partial<GameSlice>): void {
    const s = store.getState();
    s.closeDrawer();
    s.setPersisted(ui);
    s.setGame({ ...EMPTY_GAME, state, epoch: game().epoch + 1, ...extra });
  }

  function advanceBlock(): AdvanceBlock | null {
    return advanceBlockOf(game().state, store.getState().run.status);
  }

  const client: EngineClient = {
    newGame(input) {
      const setup = defaultNewGameSetup({ companyName: input.companyName.trim() });
      const issues = validateSetup(setup);
      if (issues.length > 0) return { ok: false, issues };
      const state = newGame(setup, input.seed);
      startGame(state, defaultUiPersisted(), { dirty: true });
      const save = buildSave(state, state.company.name, false);
      void writeAutosave(save, game().epoch);
      return { ok: true };
    },

    load(save, loadOptions = {}) {
      const ui = readUiPersisted(save.ui);
      startGame(save.state, ui, {
        actionLog: save.actionLog ?? [],
        calcReports: [...ui.recentReports],
        slotId: loadOptions.slotId ?? null,
        savedTurn: save.state.clock.turn,
        dirty: false,
      });
    },

    apply(action) {
      const g = game();
      if (g.state === null) return { ok: false, error: NO_GAME_ERROR };
      if (store.getState().run.status !== 'idle') {
        return { ok: false, error: { code: 'RUN_IN_PROGRESS', message: 'Wait for the run to stop.' } };
      }
      const r = applyAction(g.state, action);
      if (!r.ok) return { ok: false, error: r.error };
      const logged: LoggedAction = { turn: g.state.clock.turn, actionSeq: r.state.clock.actionSeq, action };
      // D-13.11: undo only for undoable actions and never in Ironman; a non-undoable action also seals the stack,
      // because undoing an earlier action would roll it back too (a re-roll or an un-seen reveal).
      const canUndo = r.undoable && !persisted().ironman;
      store.getState().setGame({
        state: r.state,
        actionLog: [...g.actionLog, logged],
        undo: canUndo ? pushUndo(g.undo, { prev: g.state, action }) : [],
        undoBlock: canUndo || persisted().ironman ? null : 'UNDO_NOT_ALLOWED',
        dirty: true,
      });
      return { ok: true, undoable: r.undoable };
    },

    validate(action) {
      const state = game().state;
      return state === null ? { ok: false, error: NO_GAME_ERROR } : validateAction(state, action);
    },

    advanceBlock,

    advance() {
      const block = advanceBlock();
      const prev = game().state;
      if (block !== null || prev === null) return { ok: false, code: block ?? 'NO_GAME' };
      const week = advanceWeek(prev, { explain: true });
      const g = game();
      store.getState().setGame({
        state: week.state,
        reports: pushNewest(g.reports, summarizeWeek(week), uiConfig['ui.reportsInMemory']),
        calcReports: pushNewest(g.calcReports, week.report, uiConfig['ui.calcRetentionWeeks']),
        undo: [],
        undoBlock: null,
        dirty: true,
      });
      // §7 season baselines (captureBaselines) join here in P1.
      store.getState().announce(weekAnnouncement(prev, week));
      scheduleAutosave();
      return { ok: true, report: week.report };
    },

    undo() {
      const g = game();
      if (persisted().ironman) return { ok: false, code: 'UNDO_IRONMAN' };
      const last = g.undo[g.undo.length - 1];
      if (last === undefined) return { ok: false, code: g.undoBlock ?? 'NOTHING_TO_UNDO' };
      store.getState().setGame({
        state: last.prev,
        undo: g.undo.slice(0, -1),
        actionLog: g.actionLog.slice(0, -1),
        dirty: true,
      });
      return { ok: true };
    },

    currentSave(saveOptions = {}) {
      const state = game().state;
      if (state === null) return null;
      return buildSave(state, saveOptions.slotName ?? state.company.name, saveOptions.includeLog ?? true);
    },

    async saveToSlot(target = {}) {
      const g = game();
      const state = g.state;
      if (state === null) return { ok: false, error: { code: 'SAVE_WRITE_FAILED', message: 'No game is loaded.' } };
      const save = buildSave(state, target.slotName ?? state.company.name, true);
      const result = await saves.save(save as SaveEnvelope, {
        ...(target.slotId === undefined ? {} : { slotId: target.slotId }),
        ...(target.slotName === undefined ? {} : { slotName: target.slotName }),
        ironman: persisted().ironman,
      });
      if (result.ok) markSaved(g.epoch, state, result.value.slotId);
      return result;
    },

    async quickSave() {
      const slotId = game().slotId;
      if (slotId === null || game().state === null || persisted().ironman) return false;
      return (await client.saveToSlot({ slotId })).ok;
    },

    async loadSlot(slot) {
      const loaded = await saves.load(slot.slotId);
      if (!loaded.ok) return { ok: false, message: loaded.error.message };
      // The engine's own reader on the stored text: its validation, and a frozen state (§2.9).
      const parsed = parseSaveFile(loaded.value.text);
      if (!parsed.ok) return { ok: false, message: parsed.error.message };
      client.load(parsed.save, { slotId: slot.kind === 'manual' ? slot.slotId : null });
      return { ok: true, notices: loaded.value.notices };
    },

    exportCurrent(exportOptions = {}) {
      const save = client.currentSave();
      return save === null ? null : exportSave(save as SaveEnvelope, { gzip: exportOptions.gzip ?? true });
    },

    settled: () => writes,
  };
  return client;
}
