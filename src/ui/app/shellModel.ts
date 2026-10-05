// What the shell shows about the game (DESIGN §13.1 top bar). The engine client is being built in parallel, so the
// shell takes this typed model through props; the engine client will build it from `select.*` (cash: §11
// `select.cashOnHand`; date: §1 `weekRange` and `displayYear`) formatted by ui/format. Labels arrive formatted, so
// the shell itself does no game math and no number formatting.
import type { LoadedSave, SaveEnvelope, SaveStore } from '../../persistence';

export type SaveIndicator =
  { readonly kind: 'saved'; readonly label: string } | { readonly kind: 'unsaved' } | { readonly kind: 'never' };

export interface ShellStatus {
  readonly company: { readonly name: string; readonly entityBadge: string | null };
  /** `Y{year} Wk {week} · {Mon d}–{Mon d}, {displayYear}` (13.2 dates). */
  readonly date: { readonly turn: number; readonly label: string };
  /** `select.cashOnHand`, formatted (13.2 USD, general). */
  readonly cash: { readonly cents: number; readonly label: string };
  readonly save: SaveIndicator;
  readonly advance: {
    readonly enabled: boolean;
    /** Tooltip, e.g. `Advance to Wk 22 · May 28–Jun 3`. */
    readonly tooltip: string;
    /** Why the button is disabled (`BLOCKING_DECISION_OPEN`, `RUN_IN_PROGRESS`, `GAME_OVER`), in words. */
    readonly disabledReason?: string;
  };
}

export interface NewGameInput {
  readonly companyName: string;
  /** A non-negative safe integer: RNG key parts are strings or safe integers (§2.3). */
  readonly seed: number;
}

/** What the Saves screen needs from the app: the slot store and the current game as a save. */
export interface SavesController {
  readonly store: SaveStore;
  /** The current game as a save envelope, or null when no game is loaded. */
  currentSave(): SaveEnvelope | null;
  /** Ironman games have no manual slots (13.16). */
  readonly ironman: boolean;
  /** Called after a slot loads successfully; the app replaces its game with it. */
  onLoaded(loaded: LoadedSave): void;
  /** Hands an export to the browser as a download; injectable for tests. */
  download?(file: { readonly fileName: string; readonly mimeType: string; readonly bytes: Uint8Array }): void;
}
