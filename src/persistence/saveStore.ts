// Save slots in browser storage (DESIGN §13.16, D-13.25): named manual slots, rotating autosaves written after every
// week, and a year-start snapshot at week 1 of each year. Each slot stores the save's JSON text and an index entry
// (SlotMeta) so the Saves screen can list slots without parsing whole games. Operations run one at a time, and every
// write of a slot's text and index entry is a single transaction, so a failure leaves the previous slot intact.
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
}

export interface SaveTarget {
  /** An existing manual slot to overwrite ("Save here"); omitted to create a new slot. */
  readonly slotId?: string;
  readonly slotName?: string;
  /** Ironman games have no manual slots (13.16). */
  readonly ironman?: boolean;
}

export interface ImportedSlot {
  readonly meta: SlotMeta;
  readonly notices: readonly SaveNotice[];
}

export interface SaveStore {
  /** Every slot, most recently written first. */
  list(): Promise<SlotMeta[]>;
  save(save: SaveEnvelope, target?: SaveTarget): Promise<Result<SlotMeta>>;
  load(slotId: string): Promise<Result<LoadedSave>>;
  rename(slotId: string, slotName: string): Promise<Result<SlotMeta>>;
  remove(slotId: string): Promise<Result<null>>;
  exportSlot(slotId: string, options?: ExportOptions): Promise<Result<ExportedFile>>;
  /** Validates a file and, only if it is valid, stores it as a new manual slot. */
  importFile(input: Uint8Array | string, options?: { readonly slotName?: string }): Promise<Result<ImportedSlot>>;
  /** Writes the rotating autosave and, at week 1, the year-start snapshot; returns the slots written. */
  autosave(save: SaveEnvelope): Promise<Result<SlotMeta[]>>;
  /** The newest autosave or year-start snapshot (the title screen's Continue). */
  latestAutosave(): Promise<SlotMeta | null>;
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

export const autosaveSlotId = (index: number): string => `auto-${index}`;
export const yearlySlotId = (year: number): string => `year-${year}`;

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
    isSummary(m['summary'])
  );
}

function bySeqDesc(a: SlotMeta, b: SlotMeta): number {
  return b.seq - a.seq;
}

/** The rotating slot to write next: an unused one first, otherwise the least recently written. */
export function nextAutosaveSlot(existing: readonly SlotMeta[], rotatingSlots: number): string {
  const autos = existing.filter((m) => m.kind === 'autosave');
  for (let i = 1; i <= rotatingSlots; i++) {
    const id = autosaveSlotId(i);
    if (!autos.some((m) => m.slotId === id)) return id;
  }
  const inRange = autos.filter((m) => /^auto-(\d+)$/.test(m.slotId) && Number(m.slotId.slice(5)) <= rotatingSlots);
  const oldest = [...inRange].sort((a, b) => a.seq - b.seq)[0];
  return oldest ? oldest.slotId : autosaveSlotId(1);
}

/** Slots to delete so that at most `yearlyKeep` year-start snapshots and `rotatingSlots` autosaves remain. */
export function autosavesToPrune(existing: readonly SlotMeta[], rotatingSlots: number, yearlyKeep: number): string[] {
  const yearly = existing.filter((m) => m.kind === 'yearly').sort(bySeqDesc);
  const extraAutos = existing.filter(
    (m) => m.kind === 'autosave' && !(Number(m.slotId.slice(5)) >= 1 && Number(m.slotId.slice(5)) <= rotatingSlots),
  );
  return [...yearly.slice(yearlyKeep), ...extraAutos].map((m) => m.slotId);
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

  function metaFor(slotId: string, kind: SlotKind, seq: number, save: SaveEnvelope, text: string): SlotMeta {
    return {
      slotId,
      kind,
      slotName: save.slotName,
      savedAt: save.savedAt,
      seq,
      schemaVersion: save.schemaVersion,
      rulesVersion: save.rulesVersion,
      summary: save.summary,
      sizeBytes: utf8ByteLength(text),
      status: codec.runStatusOf?.(save) ?? 'active',
    };
  }

  async function write(
    entries: readonly { slotId: string; kind: SlotKind; save: SaveEnvelope; text: string }[],
    seqStart: number,
    deletions: readonly string[] = [],
  ): Promise<Result<SlotMeta[]>> {
    const metas = entries.map((e, i) => metaFor(e.slotId, e.kind, seqStart + i, e.save, e.text));
    const kvEntries: [string, unknown][] = entries.flatMap((e, i) => [
      [textKey(e.slotId), e.text] as [string, unknown],
      [metaKey(e.slotId), metas[i]] as [string, unknown],
    ]);
    kvEntries.push([SEQ_KEY, seqStart + entries.length - 1]);
    try {
      await kv.setMany(kvEntries);
    } catch (e) {
      return fail('SAVE_WRITE_FAILED', `The save could not be written: ${e instanceof Error ? e.message : String(e)}`);
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

  async function readText(slotId: string): Promise<string | null> {
    const text = await kv.get(textKey(slotId));
    return typeof text === 'string' ? text : null;
  }

  function first(result: Result<SlotMeta[]>): Result<SlotMeta> {
    if (!result.ok) return result;
    const meta = result.value[0];
    return meta ? ok(meta) : fail('SAVE_WRITE_FAILED', 'Nothing was written.');
  }

  return {
    list: () => exclusive(readMetas),

    save: (save, target = {}) =>
      exclusive(async () => {
        if (target.ironman)
          return fail('IRONMAN_MANUAL_SAVE', 'Ironman games keep one save and cannot use manual slots.');
        let slotId: string;
        let slotName = target.slotName ?? save.summary.company;
        const seq = await nextSeq();
        if (target.slotId !== undefined) {
          const existing = await readMeta(target.slotId);
          if (!existing || existing.kind !== 'manual')
            return fail('SLOT_NOT_FOUND', 'That save slot no longer exists.');
          slotId = existing.slotId;
          slotName = target.slotName ?? existing.slotName;
        } else {
          slotId = `m${seq}`;
        }
        const stamped: SaveEnvelope = { ...save, savedAt: now(), slotName };
        return first(await write([{ slotId, kind: 'manual', save: stamped, text: serializeSave(stamped) }], seq));
      }),

    load: (slotId) =>
      exclusive(async () => {
        const text = await readText(slotId);
        if (text === null) return fail('SLOT_NOT_FOUND', 'That save slot no longer exists.');
        return readSave(text, codec);
      }),

    rename: (slotId, slotName) =>
      exclusive(async () => {
        const meta = await readMeta(slotId);
        const text = await readText(slotId);
        if (!meta || text === null) return fail('SLOT_NOT_FOUND', 'That save slot no longer exists.');
        const loaded = readSave(text, codec);
        if (!loaded.ok) return loaded;
        const renamed: SaveEnvelope = { ...loaded.value.save, slotName };
        const renamedText = serializeSave(renamed);
        const updated: SlotMeta = { ...meta, slotName, sizeBytes: utf8ByteLength(renamedText) };
        try {
          await kv.setMany([
            [textKey(slotId), renamedText],
            [metaKey(slotId), updated],
          ]);
        } catch (e) {
          return fail(
            'SAVE_WRITE_FAILED',
            `The slot could not be renamed: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
        return ok(updated);
      }),

    remove: (slotId) =>
      exclusive(async () => {
        if (!(await readMeta(slotId))) return fail('SLOT_NOT_FOUND', 'That save slot no longer exists.');
        try {
          await kv.delMany([textKey(slotId), metaKey(slotId)]);
        } catch (e) {
          return fail(
            'SAVE_WRITE_FAILED',
            `The slot could not be deleted: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
        return ok(null);
      }),

    exportSlot: (slotId, exportOptions = {}) =>
      exclusive(async () => {
        const meta = await readMeta(slotId);
        const text = await readText(slotId);
        if (!meta || text === null) return fail('SLOT_NOT_FOUND', 'That save slot no longer exists.');
        return ok(exportSaveText(text, meta.slotName, exportOptions));
      }),

    importFile: (input, importOptions = {}) =>
      exclusive(async () => {
        const loaded = readSave(input, codec);
        if (!loaded.ok) return loaded;
        let { save, text } = loaded.value;
        if (importOptions.slotName !== undefined) {
          save = { ...save, slotName: importOptions.slotName };
          text = serializeSave(save);
        }
        const seq = await nextSeq();
        const written = first(await write([{ slotId: `m${seq}`, kind: 'manual', save, text }], seq));
        return written.ok ? ok({ meta: written.value, notices: loaded.value.notices }) : written;
      }),

    autosave: (save) =>
      exclusive(async () => {
        // The replay log never goes into autosaves (§2.9).
        const { actionLog: _log, ...rest } = save;
        const stamped: SaveEnvelope = { ...rest, savedAt: now() };
        const text = serializeSave(stamped);
        const existing = await readMetas();
        const entries: { slotId: string; kind: SlotKind; save: SaveEnvelope; text: string }[] = [
          { slotId: nextAutosaveSlot(existing, rotatingSlots), kind: 'autosave', save: stamped, text },
        ];
        if (save.summary.week === 1) {
          entries.push({ slotId: yearlySlotId(save.summary.year), kind: 'yearly', save: stamped, text });
        }
        const seq = await nextSeq();
        const written = entries.map((e, i) => metaFor(e.slotId, e.kind, seq + i, e.save, e.text));
        const after = [...existing.filter((m) => !written.some((w) => w.slotId === m.slotId)), ...written];
        return write(entries, seq, autosavesToPrune(after, rotatingSlots, yearlyKeep));
      }),

    latestAutosave: () =>
      exclusive(async () => (await readMetas()).find((m) => m.kind === 'autosave' || m.kind === 'yearly') ?? null),
  };
}
