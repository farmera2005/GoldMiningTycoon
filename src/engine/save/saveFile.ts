// Saving and loading (DESIGN §2.9, §13 13.16). toSaveFile builds the §2.9 envelope; parseSaveFile reads one back in
// §13's order: format → schemaVersion (older → migrate with a notice; newer → SAVE_TOO_NEW) → envelope and state
// validation → tuning hash (a TUNING_DIFFERS notice only: the save keeps its own tuning). `saveCodec` is the same
// engine side shaped for browser persistence's injected SaveCodec, which the engine cannot import (§2.1).
import { cloneJson, freezeIfEnabled } from '../state/immutability';
import { resolveTuning, tuningHashOf } from '../state/tuning';
import { defaultNewGameSetup, type NewGameSetup } from '../state/setup';
import type { GameState } from '../state/types';
import { cashOnHandCents, netWorthCents } from '../systems/finance/netWorth';
import type { LoggedAction } from '../actions/types';
import { CURRENT_SCHEMA_VERSION, MIGRATIONS, migrateSave } from './migrations';
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

/** The build's tuning hash for its default game (persistence's `currentTuningHash`). */
export const BUILD_TUNING_HASH: string = tuningHashOf(resolveTuning(defaultNewGameSetup({ companyName: 'Build' })));

export interface SaveCodecConfig {
  currentSchemaVersion: number;
  migrations: readonly Migration[];
}

/**
 * The engine side of saving, in the shape src/persistence's `SaveCodec` expects. `tuningHashOf` reports the build's
 * hash when the save's tuning equals what this build resolves for the save's own setup, and the save's hash otherwise,
 * so persistence's single comparison against `currentTuningHash` raises TUNING_DIFFERS exactly when the save's
 * tuning differs from the build's (whatever its difficulty).
 */
export interface EngineSaveCodec {
  readonly currentSchemaVersion: number;
  migrate(save: VersionedSave): MigrationOutcome;
  checkState(state: unknown): string | null;
  readonly currentTuningHash: string;
  tuningHashOf(save: { readonly state: unknown }): string | null;
  runStatusOf(save: { readonly state: unknown }): 'active' | 'ended';
}

function saveTuningHash(state: unknown): string | null {
  if (!isRec(state) || !isRec(state['meta'])) return null;
  const hash = state['meta']['tuningHash'];
  return typeof hash === 'string' ? hash : null;
}

export function createSaveCodec(config: SaveCodecConfig): EngineSaveCodec {
  return {
    currentSchemaVersion: config.currentSchemaVersion,
    migrate: (save) => migrateSave(save, config.migrations, config.currentSchemaVersion),
    checkState: (state) => stateProblem(state, config.currentSchemaVersion),
    currentTuningHash: BUILD_TUNING_HASH,
    tuningHashOf: (save) => {
      const own = saveTuningHash(save.state);
      if (own === null) return null;
      const meta = (save.state as Rec)['meta'] as Rec;
      return own === buildTuningHashFor(meta['setup']) ? BUILD_TUNING_HASH : own;
    },
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
 * for a newer schema, SAVE_CORRUPT for unreadable, unmigratable or invalid data. The input is never modified.
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
  if (codec.tuningHashOf({ state: migrated['state'] }) !== codec.currentTuningHash) {
    const meta = (migrated['state'] as Rec)['meta'] as Rec;
    notices.push({
      code: 'TUNING_DIFFERS',
      saveTuningHash: saveTuningHash(migrated['state']) ?? '',
      buildTuningHash: buildTuningHashFor(meta['setup']) ?? codec.currentTuningHash,
    });
  }
  const save = migrated as unknown as SaveFile;
  save.state = freezeIfEnabled(save.state);
  return { ok: true, save, notices };
}
