// Save files (DESIGN §2.9). The engine owns the envelope's state part, the schema version, migrations and validation;
// browser persistence (src/persistence) owns slots, autosaves and gzip, and receives the engine through `saveCodec`.
import type { Cents } from '../core/money';
import type { LoggedAction } from '../actions/types';
import type { GameState } from '../state/types';

export const SAVE_FORMAT = 'gmt-save';

/** §13 13.18 `UiPersisted`: presentation state outside GameState. Opaque to the engine, never hashed. */
export type UiPersisted = Readonly<Record<string, unknown>>;

export interface SaveSummary {
  company: string;
  year: number;
  week: number;
  cash: Cents;
  netWorth: Cents;
}

export interface SaveFile {
  format: typeof SAVE_FORMAT;
  /** Bumps on any breaking state shape change. */
  schemaVersion: number;
  rulesVersion: string;
  /** UI-supplied wall-clock ISO string; never read by the engine. */
  savedAt: string;
  slotName: string;
  summary: SaveSummary;
  state: GameState;
  ui?: UiPersisted;
  /** Optional replay history; never in autosaves. */
  actionLog?: LoggedAction[];
}

/** A save as read from a file, before migration: only its identity is known (persistence's `VersionedSave`). */
export interface VersionedSave {
  readonly format: typeof SAVE_FORMAT;
  readonly schemaVersion: number;
  readonly [field: string]: unknown;
}

/** A pure `vN → vN+1` migration of the whole save (state and envelope). */
export interface Migration {
  readonly from: number;
  readonly name: string;
  migrate(save: VersionedSave): VersionedSave;
}

export interface MigrationOutcome {
  readonly save: VersionedSave;
  /** Names of the migrations applied, oldest first. */
  readonly applied: readonly string[];
}

/** SAVE_TOO_OLD: a schema older than MIN_SUPPORTED_SCHEMA_VERSION (P0 saves in a P1 build, s02 #7). */
export type SaveErrorCode = 'SAVE_CORRUPT' | 'SAVE_FORMAT' | 'SAVE_TOO_NEW' | 'SAVE_TOO_OLD';

export interface SaveError {
  readonly code: SaveErrorCode;
  readonly message: string;
}

export type SaveNotice =
  | {
      readonly code: 'SAVE_MIGRATED';
      readonly fromVersion: number;
      readonly toVersion: number;
      readonly migrations: readonly string[];
    }
  | { readonly code: 'TUNING_DIFFERS'; readonly saveTuningHash: string; readonly buildTuningHash: string };

export type ParseSaveResult =
  | { readonly ok: true; readonly save: SaveFile; readonly notices: readonly SaveNotice[] }
  | { readonly ok: false; readonly error: SaveError };
