// Saving and loading (DESIGN §2.9, §13 13.16). toSaveFile builds the §2.9 envelope; parseSaveFile reads one back in
// §13's order: format → schemaVersion (newer → SAVE_TOO_NEW; older than the oldest supported → SAVE_TOO_OLD (s02 #7);
// older → migrate with a notice) → envelope and state validation → tuning hash (a TUNING_DIFFERS notice only: the save
// keeps its own tuning). `saveCodec` is the same engine side shaped for browser persistence's injected SaveCodec, which
// the engine cannot import (§2.1).
import { cloneJson, freezeIfEnabled } from '../state/immutability';
import { resolveTuning, tuningHashOf } from '../state/tuning';
import { defaultNewGameSetup, type NewGameSetup } from '../state/setup';
import type { GameState } from '../state/types';
import { cashOnHandCents, netWorthCents } from '../systems/finance/netWorth';
import type { LoggedAction } from '../actions/types';
import {
  CURRENT_SCHEMA_VERSION,
  MIGRATIONS,
  MIN_SUPPORTED_SCHEMA_VERSION,
  MigrationError,
  migrateSave,
} from './migrations';
import { stateProblem } from './validate';
import {
  SAVE_FORMAT,
  type Migration,
  type MigrationOutcome,
  type ParseSaveResult,
  type SaveError,
  type SaveErrorCode,
  type SaveFile,
  type SaveNotice,
  type UiPersisted,
  type VersionedSave,
} from './types';

export interface ToSaveFileOptions {
  slotName: string;
  /** Wall-clock ISO string from the UI; the engine never reads a clock. */
  savedAt: string;
  ui?: UiPersisted;
  actionLog?: LoggedAction[];
}

/** Builds the §2.9 envelope for a state. The state is shared, not copied (it is immutable). */
export function toSaveFile(state: GameState, opts: ToSaveFileOptions): SaveFile {
  const save: SaveFile = {
    format: SAVE_FORMAT,
    schemaVersion: state.schemaVersion,
    rulesVersion: state.meta.rulesVersion,
    savedAt: opts.savedAt,
    slotName: opts.slotName,
    summary: {
      company: state.company.name,
      year: state.clock.year,
      week: state.clock.week,
      cash: cashOnHandCents(state.finance),
      netWorth: netWorthCents(state.finance, state.meta.tuning, 'scoring'),
    },
    state,
  };
  if (opts.ui !== undefined) save.ui = opts.ui;
  if (opts.actionLog !== undefined) save.actionLog = cloneJson(opts.actionLog);
  return save;
}

/** The save as JSON text (persistence writes this text unchanged; canonical hashing is separate). */
export function serializeSaveFile(save: SaveFile): string {
  return JSON.stringify(save);
}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v);

function fail(code: SaveErrorCode, message: string): { ok: false; error: SaveError } {
  return { ok: false, error: { code, message } };
}

function envelopeProblem(v: Rec): string | null {
  if (typeof v['rulesVersion'] !== 'string') return 'rulesVersion';
  if (typeof v['savedAt'] !== 'string') return 'savedAt';
  if (typeof v['slotName'] !== 'string') return 'slotName';
  const s = v['summary'];
  if (!isRec(s) || typeof s['company'] !== 'string') return 'summary';
  if (!isInt(s['year']) || !isInt(s['week']) || !isInt(s['cash']) || !isInt(s['netWorth'])) return 'summary';
  if (!isRec(v['state'])) return 'state';
  if (v['ui'] !== undefined && !isRec(v['ui'])) return 'ui';
  if (v['actionLog'] !== undefined && !Array.isArray(v['actionLog'])) return 'actionLog';
  return null;
}

/** The hash this build resolves for a setup with no simulator overrides (null when the setup no longer resolves). */
function buildTuningHashFor(setup: unknown): string | null {
  try {
    return tuningHashOf(resolveTuning(setup as NewGameSetup));
  } catch {
    return null;
  }
}

/** The build's tuning hash for its default game (shown as the build's tuning; not what a save is compared with). */
export const BUILD_TUNING_HASH: string = tuningHashOf(resolveTuning(defaultNewGameSetup({ companyName: 'Build' })));

/**
 * Persistence's `currentTuningHash` (D-2.35): a token, not a hash. The codec's `tuningHashOf` reports it for a save
 * whose tuning is exactly what this build resolves for that save's own setup, and the save's own hash otherwise.
 * Tuning hashes are 16 hex digits, so no save's hash can ever equal the token: persistence's single comparison
 * `tuningHashOf(save) !== currentTuningHash` is then exactly "the save's tuning differs from what this build resolves
 * for it". (Comparing against BUILD_TUNING_HASH instead missed a save whose own hash happened to equal the default
 * game's while its setup resolves to something else.)
 */
export const TUNING_MATCHES_BUILD = 'tuning-matches-build';

export interface SaveCodecConfig {
  currentSchemaVersion: number;
  migrations: readonly Migration[];
  /** The oldest schema the codec loads (default 1: every version a migration chain can reach). */
  minSupportedSchemaVersion?: number;
}

/** §13 13.16's message for a save older than the build supports (s02 #7). */
export function saveTooOldMessage(version: number, minSupported: number): string {
  return (
    `This save was made by an earlier version of the game (schema ${version}); ` +
    `this build reads schema ${minSupported} and later.`
  );
}

/** Both hashes of a TUNING_DIFFERS notice (§13 13.16). */
export interface TuningDifference {
  readonly saveTuningHash: string;
  readonly buildTuningHash: string;
}

/** The engine side of saving, in the shape src/persistence's `SaveCodec` expects, plus the engine's own reads. */
export interface EngineSaveCodec {
  readonly currentSchemaVersion: number;
  /** Older schemas are refused (SAVE_TOO_OLD), never migrated. */
  readonly minSupportedSchemaVersion: number;
  /** Throws MigrationError for a save older than `minSupportedSchemaVersion`, with the SAVE_TOO_OLD message. */
  migrate(save: VersionedSave): MigrationOutcome;
  checkState(state: unknown): string | null;
  /** = TUNING_MATCHES_BUILD (see there). */
  readonly currentTuningHash: string;
  /** TUNING_MATCHES_BUILD when `tuningDiffers` is null, else the save's own hash; null when the state has none. */
  tuningHashOf(save: { readonly state: unknown }): string | null;
  /**
   * §2.9 / D-2.35: null when the save's `meta.tuningHash` equals what this build resolves for the save's own setup
   * (any difficulty); otherwise both hashes. A setup this build can no longer resolve differs by definition, and its
   * notice names the build's default-game hash. Null too when the state carries no readable hash (checkState's case).
   */
  tuningDiffers(save: { readonly state: unknown }): TuningDifference | null;
  runStatusOf(save: { readonly state: unknown }): 'active' | 'ended';
}

function saveTuningHash(state: unknown): string | null {
  if (!isRec(state) || !isRec(state['meta'])) return null;
  const hash = state['meta']['tuningHash'];
  return typeof hash === 'string' ? hash : null;
}

/** D-2.35: compares the save's own hash directly with this build's resolution of the save's own setup. */
function tuningDifference(state: unknown): TuningDifference | null {
  const own = saveTuningHash(state);
  if (own === null) return null;
  const build = buildTuningHashFor(((state as Rec)['meta'] as Rec)['setup']);
  if (own === build) return null;
  return { saveTuningHash: own, buildTuningHash: build ?? BUILD_TUNING_HASH };
}

export function createSaveCodec(config: SaveCodecConfig): EngineSaveCodec {
  const minSupported = config.minSupportedSchemaVersion ?? 1;
  return {
    currentSchemaVersion: config.currentSchemaVersion,
    minSupportedSchemaVersion: minSupported,
    migrate: (save) => {
      // Persistence calls migrate for any older save; a too-old one must fail here rather than half-migrate.
      if (save.schemaVersion < minSupported) {
        throw new MigrationError(saveTooOldMessage(save.schemaVersion, minSupported));
      }
      return migrateSave(save, config.migrations, config.currentSchemaVersion);
    },
    checkState: (state) => stateProblem(state, config.currentSchemaVersion),
    currentTuningHash: TUNING_MATCHES_BUILD,
    tuningHashOf: (save) => {
      const own = saveTuningHash(save.state);
      if (own === null) return null;
      return tuningDifference(save.state) === null ? TUNING_MATCHES_BUILD : own;
    },
    tuningDiffers: (save) => tuningDifference(save.state),
    runStatusOf: (save) => {
      const company = isRec(save.state) ? save.state['company'] : undefined;
      return isRec(company) && company['runStatus'] !== 'active' ? 'ended' : 'active';
    },
  };
}

/** The build's codec: current schema and the migration registry. */
export const saveCodec: EngineSaveCodec = createSaveCodec({
  currentSchemaVersion: CURRENT_SCHEMA_VERSION,
  migrations: MIGRATIONS,
  minSupportedSchemaVersion: MIN_SUPPORTED_SCHEMA_VERSION,
});

function readJson(input: unknown): { ok: true; value: unknown } | { ok: false; error: SaveError } {
  if (typeof input !== 'string') return { ok: true, value: input };
  const text = input.startsWith('﻿') ? input.slice(1) : input;
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return fail('SAVE_CORRUPT', 'The file is not valid save data (unreadable JSON).');
  }
}

/**
 * Reads a save from JSON text or an already-parsed object: SAVE_FORMAT for anything that is not a save, SAVE_TOO_NEW
 * for a newer schema, SAVE_TOO_OLD for one older than the build supports, SAVE_CORRUPT for unreadable, unmigratable
 * or invalid data. The input is never modified.
 */
export function parseSaveFile(input: unknown, codec: EngineSaveCodec = saveCodec): ParseSaveResult {
  const json = readJson(input);
  if (!json.ok) return json;
  const raw = json.value;
  if (!isRec(raw) || raw['format'] !== SAVE_FORMAT)
    return fail('SAVE_FORMAT', 'This is not a Gold Mining Tycoon save file.');
  const version = raw['schemaVersion'];
  if (!isInt(version) || version < 1) return fail('SAVE_FORMAT', 'The save file has no valid schema version.');
  if (version > codec.currentSchemaVersion) {
    return fail(
      'SAVE_TOO_NEW',
      `This save was made by a newer version of the game (schema ${version}; this build reads up to ${codec.currentSchemaVersion}).`,
    );
  }
  if (version < codec.minSupportedSchemaVersion) {
    return fail('SAVE_TOO_OLD', saveTooOldMessage(version, codec.minSupportedSchemaVersion));
  }
  let outcome: MigrationOutcome;
  try {
    outcome = codec.migrate(cloneJson(raw) as VersionedSave);
  } catch (e) {
    return fail('SAVE_CORRUPT', `The save could not be migrated: ${e instanceof Error ? e.message : String(e)}`);
  }
  const migrated = outcome.save as unknown as Rec;
  const envelope = envelopeProblem(migrated);
  if (envelope !== null) return fail('SAVE_CORRUPT', `The save file is damaged (${envelope}).`);
  const problem = codec.checkState(migrated['state']);
  if (problem !== null) return fail('SAVE_CORRUPT', `The saved game is damaged: ${problem}`);

  const notices: SaveNotice[] = [];
  if (version !== codec.currentSchemaVersion) {
    notices.push({
      code: 'SAVE_MIGRATED',
      fromVersion: version,
      toVersion: codec.currentSchemaVersion,
      migrations: outcome.applied,
    });
  }
  const tuning = codec.tuningDiffers({ state: migrated['state'] });
  if (tuning !== null) notices.push({ code: 'TUNING_DIFFERS', ...tuning });
  const save = migrated as unknown as SaveFile;
  save.state = freezeIfEnabled(save.state);
  return { ok: true, save, notices };
}
