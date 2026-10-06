// Save files (DESIGN §2.9 `SaveFile`, §13.16 import and export). The game state is opaque here: persistence checks
// the envelope, delegates versions to an injected SaveCodec (the engine's migrations), and moves JSON text around
// without re-encoding it, so an export → import round trip gives byte-identical text.
import { gunzipSync, gzipSync, strFromU8, strToU8 } from 'fflate';

export const SAVE_FORMAT = 'gmt-save';

export interface SaveSummary {
  readonly company: string;
  readonly year: number;
  readonly week: number;
  /** Cents. */
  readonly cash: number;
  /** Cents. */
  readonly netWorth: number;
}

/** §2.9 `SaveFile`, generic over the engine's `GameState`, §13's `UiPersisted` and the replay log entry. */
export interface SaveEnvelope<TState = unknown, TUi = unknown, TLogEntry = unknown> {
  readonly format: typeof SAVE_FORMAT;
  readonly schemaVersion: number;
  readonly rulesVersion: string;
  /** UI-supplied wall-clock ISO string; never read by the engine. */
  readonly savedAt: string;
  readonly slotName: string;
  readonly summary: SaveSummary;
  readonly state: TState;
  readonly ui?: TUi;
  readonly actionLog?: readonly TLogEntry[];
}

/** A save as read from a file, before migration: only the envelope's identity is known. */
export interface VersionedSave {
  readonly format: typeof SAVE_FORMAT;
  readonly schemaVersion: number;
  readonly [field: string]: unknown;
}

export interface MigrationOutcome {
  readonly save: VersionedSave;
  /** Names of the migrations applied, oldest first, for the import notice. */
  readonly applied: readonly string[];
}

/** The engine side of saving, injected so persistence never imports the engine (engine/save/ provides it). */
export interface SaveCodec {
  readonly currentSchemaVersion: number;
  /** Pure forward migration of an older save to `currentSchemaVersion`; throws on a save it cannot migrate. */
  migrate(save: VersionedSave): MigrationOutcome;
  /** Optional shape check of the migrated state: an error message, or null when the state is well formed. */
  checkState?(state: unknown): string | null;
  /** The build's resolved tuning hash and a save's, for the `TUNING_DIFFERS` notice. */
  readonly currentTuningHash?: string;
  tuningHashOf?(save: SaveEnvelope): string | null;
  /** Whether a save's run has ended (its slot is then read-only, 13.16). */
  runStatusOf?(save: SaveEnvelope): 'active' | 'ended';
}

/**
 * §13.21's `ui/save`, `ui/load` and `ui/import` codes, plus the storage failures: `SAVE_WRITE_FAILED` (a write, or a
 * read a write depends on, failed) and `SAVE_READ_FAILED` (browser storage could not be read: blocked, evicted or
 * closed), so every store operation reports a typed failure instead of rejecting (13.16).
 */
export type SaveErrorCode =
  | 'SAVE_CORRUPT'
  | 'SAVE_FORMAT'
  | 'SAVE_TOO_NEW'
  | 'SLOT_NOT_FOUND'
  | 'IRONMAN_MANUAL_SAVE'
  | 'SAVE_WRITE_FAILED'
  | 'SAVE_READ_FAILED';

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
  | { readonly code: 'TUNING_DIFFERS' };

export type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: SaveError };

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function fail<T = never>(code: SaveErrorCode, message: string): Result<T> {
  return { ok: false, error: { code, message } };
}

export interface LoadedSave {
  readonly save: SaveEnvelope;
  /** The save's JSON text: the input text unchanged, or the re-serialized save when a migration ran. */
  readonly text: string;
  readonly notices: readonly SaveNotice[];
}

export interface ExportedFile {
  readonly fileName: string;
  readonly mimeType: string;
  readonly bytes: Uint8Array;
}

const GZIP_MAGIC_0 = 0x1f;
const GZIP_MAGIC_1 = 0x8b;
const BOM = '\uFEFF';

export function isGzip(bytes: Uint8Array): boolean {
  return bytes.length >= 2 && bytes[0] === GZIP_MAGIC_0 && bytes[1] === GZIP_MAGIC_1;
}

export function serializeSave(save: SaveEnvelope): string {
  return JSON.stringify(save);
}

export function utf8ByteLength(text: string): number {
  return strToU8(text).length;
}

/** Gzipped or plain UTF-8 bytes (or already-decoded text) → JSON text. */
export function decodeSaveText(input: Uint8Array | string): Result<string> {
  let text: string;
  if (typeof input === 'string') {
    text = input;
  } else if (isGzip(input)) {
    try {
      text = strFromU8(gunzipSync(input));
    } catch {
      return fail('SAVE_CORRUPT', 'The file looks compressed but could not be decompressed.');
    }
  } else {
    text = strFromU8(input);
  }
  return ok(text.startsWith(BOM) ? text.slice(BOM.length) : text);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isSafeInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isSafeInteger(v);
}

function parseJson(text: string): Result<unknown> {
  try {
    return ok(JSON.parse(text) as unknown);
  } catch {
    return fail('SAVE_CORRUPT', 'The file is not valid save data (unreadable JSON).');
  }
}

function checkFormat(value: unknown): Result<Record<string, unknown>> {
  if (!isRecord(value) || value['format'] !== SAVE_FORMAT) {
    return fail('SAVE_FORMAT', 'This is not a Gold Mining Tycoon save file.');
  }
  return ok(value);
}

function checkVersion(value: Record<string, unknown>, codec: SaveCodec): Result<VersionedSave> {
  const version = value['schemaVersion'];
  if (!isSafeInt(version) || version < 1) {
    return fail('SAVE_FORMAT', 'The save file has no valid schema version.');
  }
  if (version > codec.currentSchemaVersion) {
    return fail(
      'SAVE_TOO_NEW',
      `This save was made by a newer version of the game (schema ${version}; this build reads up to ${codec.currentSchemaVersion}).`,
    );
  }
  return ok(value as VersionedSave);
}

function migrateIfOlder(save: VersionedSave, codec: SaveCodec): Result<MigrationOutcome> {
  if (save.schemaVersion === codec.currentSchemaVersion) return ok({ save, applied: [] });
  let outcome: MigrationOutcome;
  try {
    outcome = codec.migrate(save);
  } catch (e) {
    return fail('SAVE_CORRUPT', `The save could not be migrated: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (outcome.save.schemaVersion !== codec.currentSchemaVersion) {
    return fail('SAVE_CORRUPT', `Migration stopped at schema ${outcome.save.schemaVersion}.`);
  }
  return ok(outcome);
}

function envelopeProblem(v: Record<string, unknown>): string | null {
  if (typeof v['rulesVersion'] !== 'string') return 'rulesVersion';
  if (typeof v['savedAt'] !== 'string') return 'savedAt';
  if (typeof v['slotName'] !== 'string') return 'slotName';
  const s = v['summary'];
  if (!isRecord(s) || typeof s['company'] !== 'string') return 'summary';
  if (!isSafeInt(s['year']) || !isSafeInt(s['week']) || !isSafeInt(s['cash']) || !isSafeInt(s['netWorth'])) {
    return 'summary';
  }
  if (!isRecord(v['state'])) return 'state';
  if (v['ui'] !== undefined && !isRecord(v['ui'])) return 'ui';
  if (v['actionLog'] !== undefined && !Array.isArray(v['actionLog'])) return 'actionLog';
  return null;
}

function checkEnvelope(save: VersionedSave, codec: SaveCodec): Result<SaveEnvelope> {
  const problem = envelopeProblem(save);
  if (problem) return fail('SAVE_CORRUPT', `The save file is damaged (${problem}).`);
  const envelope = save as unknown as SaveEnvelope;
  const stateProblem = codec.checkState?.(envelope.state) ?? null;
  if (stateProblem) return fail('SAVE_CORRUPT', `The saved game is damaged: ${stateProblem}`);
  return ok(envelope);
}

function tuningNotice(save: SaveEnvelope, codec: SaveCodec): SaveNotice[] {
  if (codec.currentTuningHash === undefined || !codec.tuningHashOf) return [];
  const hash = codec.tuningHashOf(save);
  return hash !== null && hash !== codec.currentTuningHash ? [{ code: 'TUNING_DIFFERS' }] : [];
}

/**
 * Reads a save from a file or from storage. Validation order (13.16): format → schemaVersion (older → migrate with a
 * notice listing the migrations; newer → `SAVE_TOO_NEW`) → parse (envelope and state) → tuningHash (notice only).
 * Unreadable bytes or JSON are `SAVE_CORRUPT`. Nothing is written: callers store the result only on success.
 */
export function readSave(input: Uint8Array | string, codec: SaveCodec): Result<LoadedSave> {
  const text = decodeSaveText(input);
  if (!text.ok) return text;
  const json = parseJson(text.value);
  if (!json.ok) return json;
  const formatted = checkFormat(json.value);
  if (!formatted.ok) return formatted;
  const versioned = checkVersion(formatted.value, codec);
  if (!versioned.ok) return versioned;
  const migrated = migrateIfOlder(versioned.value, codec);
  if (!migrated.ok) return migrated;
  const envelope = checkEnvelope(migrated.value.save, codec);
  if (!envelope.ok) return envelope;

  const notices: SaveNotice[] = [];
  const fromVersion = versioned.value.schemaVersion;
  if (fromVersion !== codec.currentSchemaVersion) {
    notices.push({
      code: 'SAVE_MIGRATED',
      fromVersion,
      toVersion: codec.currentSchemaVersion,
      migrations: migrated.value.applied,
    });
  }
  notices.push(...tuningNotice(envelope.value, codec));
  const outText = fromVersion === codec.currentSchemaVersion ? text.value : serializeSave(envelope.value);
  return ok({ save: envelope.value, text: outText, notices });
}

/** A file-name stem from a slot or company name: lower case, ASCII letters and digits joined by dashes. */
export function fileStem(name: string): string {
  const stem = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/, '');
  return stem === '' ? 'save' : stem;
}

export interface ExportOptions {
  /** DESIGN §2.9 `save.exportGzip` (default true): `.gmt.json.gz`; false writes plain `.gmt.json`. */
  readonly gzip?: boolean;
}

/** Builds the export file for a save. */
export function exportSave(save: SaveEnvelope, options: ExportOptions = {}): ExportedFile {
  return exportSaveText(serializeSave(save), save.slotName, options);
}

/**
 * Builds the export file from stored JSON text, which goes into the file exactly as stored. The gzip header's
 * timestamp is fixed at zero so the same save always exports to the same bytes.
 */
export function exportSaveText(text: string, name: string, options: ExportOptions = {}): ExportedFile {
  const raw = strToU8(text);
  return (options.gzip ?? true)
    ? { fileName: `${fileStem(name)}.gmt.json.gz`, mimeType: 'application/gzip', bytes: gzipSync(raw, { mtime: 0 }) }
    : { fileName: `${fileStem(name)}.gmt.json`, mimeType: 'application/json', bytes: raw };
}
