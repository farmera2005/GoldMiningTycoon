// PLACEHOLDER game for the P0 shell. It stands in for the engine client (ui/engine/engineClient.ts, DESIGN §13.18)
// until that is wired in: it only counts weeks and carries the wizard's name and seed, so the shell, the Advance
// button, autosave and the Saves screen can be exercised end to end. It has no economics; cash stays at zero.
import { useState } from 'react';
import type { LoadedSave, SaveCodec, SaveEnvelope, SaveStore } from '../../persistence';
import type { UiStore } from '../store/store';
import { App } from './App';
import { placeholderFormat } from './placeholderFormat';
import type { NewGameInput, SavesController, ShellStatus } from './shellModel';

export interface StubGameState {
  readonly kind: 'p0-stub';
  readonly companyName: string;
  readonly seed: number;
  readonly turn: number;
  readonly cashCents: number;
}

export const STUB_RULES_VERSION = 'p0-shell';
const WEEKS_PER_YEAR = 52;

function isStubState(v: unknown): v is StubGameState {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return (
    s['kind'] === 'p0-stub' &&
    typeof s['companyName'] === 'string' &&
    Number.isSafeInteger(s['seed']) &&
    Number.isSafeInteger(s['turn']) &&
    Number.isSafeInteger(s['cashCents'])
  );
}

/** Codec for placeholder saves: schema 1, nothing older to migrate. */
export const stubCodec: SaveCodec = {
  currentSchemaVersion: 1,
  migrate(save) {
    throw new Error(`no migration path from schema ${save.schemaVersion}`);
  },
  checkState: (state) => (isStubState(state) ? null : 'not a recognised game state'),
};

/** Turn 0 is year 1 week 1; 52-week years (§1 calendar; the real labels come from §1 `weekRange`). */
function yearWeek(turn: number): { year: number; week: number } {
  return { year: Math.floor(turn / WEEKS_PER_YEAR) + 1, week: (turn % WEEKS_PER_YEAR) + 1 };
}

export function stubEnvelope(game: StubGameState): SaveEnvelope<StubGameState> {
  const { year, week } = yearWeek(game.turn);
  return {
    format: 'gmt-save',
    schemaVersion: stubCodec.currentSchemaVersion,
    rulesVersion: STUB_RULES_VERSION,
    savedAt: '',
    slotName: game.companyName,
    summary: { company: game.companyName, year, week, cash: game.cashCents, netWorth: game.cashCents },
    state: game,
  };
}

export function stubStatus(game: StubGameState, lastSavedTurn: number | null): ShellStatus {
  const { year, week } = yearWeek(game.turn);
  const next = yearWeek(game.turn + 1);
  const saved = lastSavedTurn === null ? null : yearWeek(lastSavedTurn);
  return {
    company: { name: game.companyName, entityBadge: null },
    date: { turn: game.turn, label: placeholderFormat.gameWeek(year, week) },
    cash: { cents: game.cashCents, label: placeholderFormat.usdFromCents(game.cashCents) },
    save:
      saved === null
        ? { kind: 'never' }
        : lastSavedTurn === game.turn
          ? { kind: 'saved', label: `Saved Wk ${saved.week}` }
          : { kind: 'unsaved' },
    advance: { enabled: true, tooltip: `Advance to ${placeholderFormat.gameWeek(next.year, next.week)}` },
  };
}

export function StubGameApp({ uiStore, saveStore }: { uiStore: UiStore; saveStore: SaveStore }) {
  const [game, setGame] = useState<StubGameState | null>(null);
  const [lastSavedTurn, setLastSavedTurn] = useState<number | null>(null);

  const onNewGame = (input: NewGameInput): void => {
    setGame({ kind: 'p0-stub', companyName: input.companyName, seed: input.seed, turn: 0, cashCents: 0 });
    setLastSavedTurn(null);
  };

  // `ui/advanceWeek` (13.21): advance, then autosave (13.16).
  const onAdvanceWeek = (): void => {
    if (!game) return;
    const next: StubGameState = { ...game, turn: game.turn + 1 };
    setGame(next);
    void saveStore.autosave(stubEnvelope(next)).then((result) => {
      if (result.ok) setLastSavedTurn(next.turn);
    });
  };

  const saves: SavesController = {
    store: saveStore,
    ironman: false,
    currentSave: () => (game ? stubEnvelope(game) : null),
    onLoaded: (loaded: LoadedSave) => {
      if (!isStubState(loaded.save.state)) return;
      setGame(loaded.save.state);
      setLastSavedTurn(loaded.save.state.turn);
    },
  };

  return (
    <App
      store={uiStore}
      status={game ? stubStatus(game, lastSavedTurn) : null}
      onAdvanceWeek={onAdvanceWeek}
      onNewGame={onNewGame}
      saves={saves}
    />
  );
}
