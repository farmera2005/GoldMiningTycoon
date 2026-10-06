// Save slots in browser storage (DESIGN §13.16, D-13.25): named manual slots, rotating autosaves written after every
// week, and a year-start snapshot at week 1 of each year. Each slot stores the save's JSON text and an index entry
// (SlotMeta) so the Saves screen can list slots without parsing whole games. Operations run one at a time, and every
// write of a slot's text and index entry is a single transaction, so a failure leaves the previous slot intact.
//
// Autosaves belong to a game (`gameId`, the UI's stable game identity): each game keeps its own
// `ui.autosaveRotatingSlots` rotating autosaves and its own last `ui.autosaveYearlyKeep` year-start snapshots, and
// writing or pruning one game's autosaves never touches another game's, so starting a second game cannot erase the
// first one's only copies.
//
// Every operation resolves to a Result: a storage failure (IndexedDB blocked, evicted, closed or full) is a typed
// `SAVE_READ_FAILED` / `SAVE_WRITE_FAILED`, never a rejection, so callers always show it (13.16).
import { uiConfig } from '../data/tuning/ui';
import type { KvStore } from './kv';
import {
  exportSaveText,
  fail,
  ok,
  readSave,
  serializeSave,
  utf8ByteLength,
  type ExportOptions,
  type ExportedFile,
  type LoadedSave,
  type Result,
  type SaveCodec,
  type SaveEnvelope,
  type SaveNotice,
  type SaveSummary,
} from './saveFile';

export type SlotKind = 'manual' | 'autosave' | 'yearly';
export type RunStatus = 'active' | 'ended';

export interface SlotMeta {
  readonly slotId: string;
  readonly kind: SlotKind;
  readonly slotName: string;
  readonly savedAt: string;
  /** Store-wide write counter: orders slots by recency and picks the autosave slot to overwrite. */
  readonly seq: number;
  readonly schemaVersion: number;
  readonly rulesVersion: string;
  readonly summary: SaveSummary;
  readonly sizeBytes: number;
  readonly status: RunStatus;
  /** The game this slot belongs to; always set on autosaves, absent on index entries written before it existed. */
  readonly gameId?: string;
}

export interface SaveTarget {
  /** An existing manual slot to overwrite ("Save here"); omitted to create a new slot. */
  readonly slotId?: string;
  readonly slotName?: string;
  /** Ironman games have no manual slots (13.16). */
  readonly ironman?: boolean;
  /** The game being saved, recorded in the slot's index entry. */
  readonly gameId?: string;
}

export interface AutosaveTarget {
  /** The game being autosaved: rotation and year-start retention run within it. */
  readonly gameId: string;
}

export interface ImportedSlot {
  readonly meta: SlotMeta;
  readonly notices: readonly SaveNotice[];
}

export interface SaveStore {
  /** Every slot, most recently written first. */
  list(): Promise<Result<SlotMeta[]>>;
  save(save: SaveEnvelope, target?: SaveTarget): Promise<Result<SlotMeta>>;
  load(slotId: string): Promise<Result<LoadedSave>>;
  rename(slotId: string, slotName: string): Promise<Result<SlotMeta>>;
  remove(slotId: string): Promise<Result<null>>;
  exportSlot(slotId: string, options?: ExportOptions): Promise<Result<ExportedFile>>;
  /** Validates a file and, only if it is valid, stores it as a new manual slot. */
  importFile(input: Uint8Array | string, options?: { readonly slotName?: string }): Promise<Result<ImportedSlot>>;
  /** Writes the game's rotating autosave and, at week 1, its year-start snapshot; returns the slots written. */
  autosave(save: SaveEnvelope, target: AutosaveTarget): Promise<Result<SlotMeta[]>>;
  /** The newest autosave or year-start snapshot of any game (the title screen's Continue), or null. */
  latestAutosave(): Promise<Result<SlotMeta | null>>;
}

export interface SaveStoreOptions {
  readonly kv: KvStore;
  readonly codec: SaveCodec;
  /** Wall clock for `savedAt` (an ISO string); injectable for tests. */
  readonly now?: () => string;
  readonly rotatingSlots?: number;
  readonly yearlyKeep?: number;
}

const SEQ_KEY = 'seq';
const textKey = (slotId: string): string => `slot/${slotId}/text`;
const metaKey = (slotId: string): string => `slot/${slotId}/meta`;
const META_KEY = /^slot\/(.+)\/meta$/;

/** A game's rotating autosave slot `index` (1-based). */
export const autosaveSlotId = (gameId: string, index: number): string => `auto-${gameId}-${index}`;
/** A game's year-start snapshot: one per game and year, so the same game reaching a year again replaces it. */
export const yearlySlotId = (gameId: string, year: number): string => `year-${gameId}-${year}`;

const SLOT_KINDS: readonly SlotKind[] = ['manual', 'autosave', 'yearly'];

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v);

function isSummary(v: unknown): v is SaveSummary {
  if (typeof v !== 'object' || v === null) return false;
  const s = v as Record<string, unknown>;
  return typeof s['company'] === 'string' && [s['year'], s['week'], s['cash'], s['netWorth']].every(isInt);
}

/** Index entries are re-checked on read: storage outlives builds, and the Saves screen renders every field. */
function isSlotMeta(v: unknown): v is SlotMeta {
  if (typeof v !== 'object' || v === null) return false;
  const m = v as Record<string, unknown>;
  return (
    typeof m['slotId'] === 'string' &&
    typeof m['kind'] === 'string' &&
    (SLOT_KINDS as readonly string[]).includes(m['kind']) &&
    typeof m['slotName'] === 'string' &&
    typeof m['savedAt'] === 'string' &&
    isInt(m['seq']) &&
    isInt(m['schemaVersion']) &&
    typeof m['rulesVersion'] === 'string' &&
    isInt(m['sizeBytes']) &&
    (m['status'] === 'active' || m['status'] === 'ended') &&
    (m['gameId'] === undefined || typeof m['gameId'] === 'string') &&
    isSummary(m['summary'])
  );
}

function bySeqDesc(a: SlotMeta, b: SlotMeta): number {
  return b.seq - a.seq;
}

function rotatingIds(gameId: string, rotatingSlots: number): string[] {
  return Array.from({ length: Math.max(0, rotatingSlots) }, (_, i) => autosaveSlotId(gameId, i + 1));
}

/** The game's rotating slot to write next: an unused one first, otherwise its least recently written. */
export function nextAutosaveSlot(existing: readonly SlotMeta[], gameId: string, rotatingSlots: number): string {
  const ids = rotatingIds(gameId, rotatingSlots);
  const autos = existing.filter((m) => m.kind === 'autosave' && m.gameId === gameId && ids.includes(m.slotId));
  const unused = ids.find((id) => !autos.some((m) => m.slotId === id));
  if (unused !== undefined) return unused;
  const oldest = [...autos].sort((a, b) => a.seq - b.seq)[0];
  return oldest ? oldest.slotId : autosaveSlotId(gameId, 1);
}

/**
 * The game's slots to delete so that it keeps at most `yearlyKeep` year-start snapshots (the newest) and only its
 * `rotatingSlots` rotating autosaves. Other games' slots are never candidates.
 */
export function autosavesToPrune(
  existing: readonly SlotMeta[],
  gameId: string,
  rotatingSlots: number,
  yearlyKeep: number,
): string[] {
  const mine = existing.filter((m) => m.gameId === gameId);
  const yearly = mine.filter((m) => m.kind === 'yearly').sort(bySeqDesc);
  const ids = rotatingIds(gameId, rotatingSlots);
  const extraAutos = mine.filter((m) => m.kind === 'autosave' && !ids.includes(m.slotId));
  return [...yearly.slice(Math.max(0, yearlyKeep)), ...extraAutos].map((m) => m.slotId);
}

function reason(e: unknown): string {
  return e instanceof Error ? `${e.name === 'Error' ? '' : `${e.name}: `}${e.message}` : String(e);
}

export function createSaveStore(options: SaveStoreOptions): SaveStore {
  const { kv, codec } = options;
  const now = options.now ?? ((): string => new Date().toISOString());
  const rotatingSlots = options.rotatingSlots ?? uiConfig['ui.autosaveRotatingSlots'];
  const yearlyKeep = options.yearlyKeep ?? uiConfig['ui.autosaveYearlyKeep'];

  // One operation at a time: two writes must never read the same counter and claim the same slot.
  let queue: Promise<unknown> = Promise.resolve();
  function exclusive<T>(op: () => Promise<T>): Promise<T> {
    const run = queue.then(op, op);
    queue = run.catch(() => undefined);
    return run;
  }

  /**
   * Runs `op` exclusively and turns anything it throws (a storage read or write rejecting) into a typed failure, so
   * the operation always resolves to a Result.
   */
  function guarded<T>(
    code: 'SAVE_READ_FAILED' | 'SAVE_WRITE_FAILED',
    what: string,
    op: () => Promise<Result<T>>,
  ): Promise<Result<T>> {
    return exclusive(async () => {
      try {
        return await op();
      } catch (e) {
        return fail<T>(code, `${what} (${reason(e)}).`);
      }
    });
  }

  async function readMetas(): Promise<SlotMeta[]> {
    const keys = (await kv.keys()).filter((k) => META_KEY.test(k));
    const metas = await Promise.all(keys.map((k) => kv.get(k)));
    return metas.filter(isSlotMeta).sort(bySeqDesc);
  }

  async function readMeta(slotId: string): Promise<SlotMeta | null> {
    const meta = await kv.get(metaKey(slotId));
    return isSlotMeta(meta) ? meta : null;
  }

  async function nextSeq(): Promise<number> {
    const seq = await kv.get(SEQ_KEY);
    return (typeof seq === 'number' && Number.isSafeInteger(seq) ? seq : 0) + 1;
  }

  async function readText(slotId: string): Promise<string | null> {
    const text = await kv.get(textKey(slotId));
    return typeof text === 'string' ? text : null;
  }

  interface Entry {
    readonly slotId: string;
    readonly kind: SlotKind;
    readonly save: SaveEnvelope;
    readonly text: string;
    readonly gameId: string | undefined;
  }

  function metaFor(e: Entry, seq: number): SlotMeta {
    return {
      slotId: e.slotId,
      kind: e.kind,
      slotName: e.save.slotName,
      savedAt: e.save.savedAt,
      seq,
      schemaVersion: e.save.schemaVersion,
      rulesVersion: e.save.rulesVersion,
      summary: e.save.summary,
      sizeBytes: utf8ByteLength(e.text),
      status: codec.runStatusOf?.(e.save) ?? 'active',
      ...(e.gameId === undefined ? {} : { gameId: e.gameId }),
    };
  }

  /** Writes the entries in one transaction; a rejected write is SAVE_WRITE_FAILED and changes nothing. */
  async function write(
    entries: readonly Entry[],
    seqStart: number,
    deletions: readonly string[] = [],
  ): Promise<Result<SlotMeta[]>> {
    const metas = entries.map((e, i) => metaFor(e, seqStart + i));
    const kvEntries: [string, unknown][] = entries.flatMap((e, i) => [
      [textKey(e.slotId), e.text] as [string, unknown],
      [metaKey(e.slotId), metas[i]] as [string, unknown],
    ]);
    kvEntries.push([SEQ_KEY, seqStart + entries.length - 1]);
    try {
      await kv.setMany(kvEntries);
    } catch (e) {
      return fail('SAVE_WRITE_FAILED', `The save could not be written (${reason(e)}).`);
    }
    if (deletions.length > 0) {
      // Pruning is best-effort: the new save is already safe, and the next autosave recomputes what to prune.
      try {
        await kv.delMany(deletions.flatMap((id) => [textKey(id), metaKey(id)]));
      } catch {
        // ignored on purpose (see above)
      }
    }
    return ok(metas);
  }

  function first(result: Result<SlotMeta[]>): Result<SlotMeta> {
    if (!result.ok) return result;
    const meta = result.value[0];
    return meta ? ok(meta) : fail('SAVE_WRITE_FAILED', 'Nothing was written.');
  }

  const SLOT_GONE = 'That save slot no longer exists.';

  return {
    list: () => guarded('SAVE_READ_FAILED', 'Saved games could not be read', async () => ok(await readMetas())),

    save: (save, target = {}) =>
      guarded('SAVE_WRITE_FAILED', 'The save could not be written', async () => {
        if (target.ironman)
          return fail('IRONMAN_MANUAL_SAVE', 'Ironman games keep one save and cannot use manual slots.');
        let slotId: string;
        let slotName = target.slotName ?? save.summary.company;
        const seq = await nextSeq();
        if (target.slotId !== undefined) {
          const existing = await readMeta(target.slotId);
          if (!existing || existing.kind !== 'manual') return fail('SLOT_NOT_FOUND', SLOT_GONE);
          slotId = existing.slotId;
          slotName = target.slotName ?? existing.slotName;
        } else {
          slotId = `m${seq}`;
        }
        const stamped: SaveEnvelope = { ...save, savedAt: now(), slotName };
        const entry: Entry = {
          slotId,
          kind: 'manual',
          save: stamped,
          text: serializeSave(stamped),
          gameId: target.gameId,
        };
        return first(await write([entry], seq));
      }),

    load: (slotId) =>
      guarded('SAVE_READ_FAILED', 'The save could not be read', async () => {
        const text = await readText(slotId);
        if (text === null) return fail('SLOT_NOT_FOUND', SLOT_GONE);
        return readSave(text, codec);
      }),

    rename: (slotId, slotName) =>
      guarded('SAVE_WRITE_FAILED', 'The slot could not be renamed', async () => {
        const meta = await readMeta(slotId);
        const text = await readText(slotId);
        if (!meta || text === null) return fail('SLOT_NOT_FOUND', SLOT_GONE);
        const loaded = readSave(text, codec);
        if (!loaded.ok) return loaded;
        const renamed: SaveEnvelope = { ...loaded.value.save, slotName };
        const renamedText = serializeSave(renamed);
        const updated: SlotMeta = { ...meta, slotName, sizeBytes: utf8ByteLength(renamedText) };
        await kv.setMany([
          [textKey(slotId), renamedText],
          [metaKey(slotId), updated],
        ]);
        return ok(updated);
      }),

    remove: (slotId) =>
      guarded('SAVE_WRITE_FAILED', 'The slot could not be deleted', async () => {
        if (!(await readMeta(slotId))) return fail('SLOT_NOT_FOUND', SLOT_GONE);
        await kv.delMany([textKey(slotId), metaKey(slotId)]);
        return ok(null);
      }),

    exportSlot: (slotId, exportOptions = {}) =>
      guarded('SAVE_READ_FAILED', 'The save could not be read for export', async () => {
        const meta = await readMeta(slotId);
        const text = await readText(slotId);
        if (!meta || text === null) return fail('SLOT_NOT_FOUND', SLOT_GONE);
        return ok(exportSaveText(text, meta.slotName, exportOptions));
      }),

    importFile: (input, importOptions = {}) =>
      guarded('SAVE_WRITE_FAILED', 'The file could not be stored', async () => {
        const loaded = readSave(input, codec);
        if (!loaded.ok) return loaded;
        let { save, text } = loaded.value;
        if (importOptions.slotName !== undefined) {
          save = { ...save, slotName: importOptions.slotName };
          text = serializeSave(save);
        }
        const seq = await nextSeq();
        const written = first(await write([{ slotId: `m${seq}`, kind: 'manual', save, text, gameId: undefined }], seq));
        return written.ok ? ok({ meta: written.value, notices: loaded.value.notices }) : written;
      }),

    autosave: (save, target) =>
      guarded('SAVE_WRITE_FAILED', 'The autosave could not be written', async () => {
        const { gameId } = target;
        // The replay log never goes into autosaves (§2.9).
        const { actionLog: _log, ...rest } = save;
        const stamped: SaveEnvelope = { ...rest, savedAt: now() };
        const text = serializeSave(stamped);
        const existing = await readMetas();
        const entries: Entry[] = [
          { slotId: nextAutosaveSlot(existing, gameId, rotatingSlots), kind: 'autosave', save: stamped, text, gameId },
        ];
        if (save.summary.week === 1) {
          entries.push({
            slotId: yearlySlotId(gameId, save.summary.year),
            kind: 'yearly',
            save: stamped,
            text,
            gameId,
          });
        }
        const seq = await nextSeq();
        const written = entries.map((e, i) => metaFor(e, seq + i));
        const after = [...existing.filter((m) => !written.some((w) => w.slotId === m.slotId)), ...written];
        return write(entries, seq, autosavesToPrune(after, gameId, rotatingSlots, yearlyKeep));
      }),

    latestAutosave: () =>
      guarded('SAVE_READ_FAILED', 'Autosaves could not be read', async () =>
        ok((await readMetas()).find((m) => m.kind === 'autosave' || m.kind === 'yearly') ?? null),
      ),
  };
}
