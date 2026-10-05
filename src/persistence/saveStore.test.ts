// T11 Saves, storage half (DESIGN §13.27; §13.16, D-13.25): slots, autosave rotation (3 rotating + yearly
// snapshots), byte-identical export → import through the store, and failures that change nothing.
import { describe, expect, it } from 'vitest';
import { uiConfig } from '../data/tuning/ui';
import { createMemoryKv, type KvStore } from './kv';
import { readSave, serializeSave, type Result } from './saveFile';
import { createSaveStore, nextAutosaveSlot, type SlotMeta } from './saveStore';
import { fixtureCodec, fixtureSave, fixtureSaveV1 } from './testFixtures';

function clock(): () => string {
  let t = Date.UTC(2026, 9, 5, 12, 0, 0);
  return () => new Date((t += 60_000)).toISOString();
}

function setup(kv = createMemoryKv()) {
  return { kv, store: createSaveStore({ kv, codec: fixtureCodec, now: clock() }) };
}

function value<T>(result: Result<T>): T {
  if (!result.ok) throw new Error(`expected success, got ${result.error.code}: ${result.error.message}`);
  return result.value;
}

function errorCode<T>(result: Result<T>): string | null {
  return result.ok ? null : result.error.code;
}

describe('manual slots', () => {
  it('saves to a new slot, lists it and loads it back', async () => {
    const { store } = setup();
    const meta = value(await store.save(fixtureSave({ turn: 20 }), { slotName: 'Before breakup' }));
    expect(meta).toMatchObject({
      kind: 'manual',
      slotName: 'Before breakup',
      savedAt: '2026-10-05T12:01:00.000Z',
      schemaVersion: 3,
      rulesVersion: 'p0',
      summary: { company: 'Hardrock Gulch Mining LLC', year: 1, week: 21 },
      status: 'active',
    });
    expect(await store.list()).toEqual([meta]);
    const loaded = value(await store.load(meta.slotId));
    expect(loaded.save.state).toEqual(fixtureSave({ turn: 20 }).state);
    expect(loaded.save.slotName).toBe('Before breakup');
    expect(meta.sizeBytes).toBe(new TextEncoder().encode(loaded.text).length);
  });

  it('overwrites with Save here and keeps the slot name', async () => {
    const { store } = setup();
    const first = value(await store.save(fixtureSave({ turn: 1 }), { slotName: 'Main' }));
    const second = value(await store.save(fixtureSave({ turn: 9 }), { slotId: first.slotId }));
    expect(second.slotId).toBe(first.slotId);
    expect(second.slotName).toBe('Main');
    expect(second.summary.week).toBe(10);
    expect(await store.list()).toHaveLength(1);
  });

  it('refuses unknown slots, autosave slots as Save here targets, and manual saves in Ironman', async () => {
    const { store } = setup();
    expect(errorCode(await store.save(fixtureSave(), { slotId: 'm999' }))).toBe('SLOT_NOT_FOUND');
    const autos = value(await store.autosave(fixtureSave({ turn: 3 })));
    expect(errorCode(await store.save(fixtureSave(), { slotId: autos[0]?.slotId ?? '' }))).toBe('SLOT_NOT_FOUND');
    expect(errorCode(await store.save(fixtureSave(), { ironman: true }))).toBe('IRONMAN_MANUAL_SAVE');
    expect(errorCode(await store.load('nope'))).toBe('SLOT_NOT_FOUND');
    expect(errorCode(await store.rename('nope', 'x'))).toBe('SLOT_NOT_FOUND');
    expect(errorCode(await store.remove('nope'))).toBe('SLOT_NOT_FOUND');
    expect(errorCode(await store.exportSlot('nope'))).toBe('SLOT_NOT_FOUND');
  });

  it('renames a slot in its index and inside the save', async () => {
    const { store } = setup();
    const meta = value(await store.save(fixtureSave()));
    expect(meta.slotName).toBe('Hardrock Gulch Mining LLC');
    const renamed = value(await store.rename(meta.slotId, 'Ruby Creek gamble'));
    expect(renamed.slotName).toBe('Ruby Creek gamble');
    expect(value(await store.load(meta.slotId)).save.slotName).toBe('Ruby Creek gamble');
  });

  it('deletes a slot', async () => {
    const { store, kv } = setup();
    const meta = value(await store.save(fixtureSave()));
    value(await store.remove(meta.slotId));
    expect(await store.list()).toEqual([]);
    expect((await kv.keys()).filter((k) => k.startsWith('slot/'))).toEqual([]);
  });

  it('skips damaged index entries when listing', async () => {
    const { store, kv } = setup();
    const good = value(await store.save(fixtureSave()));
    await kv.setMany([
      ['slot/junk/meta', { slotId: 'junk', kind: 'manual' }],
      ['slot/odd/meta', { ...good, slotId: 'odd', summary: { company: 'X', year: '1' } }],
    ]);
    expect((await store.list()).map((m) => m.slotId)).toEqual([good.slotId]);
  });

  it('marks an ended run read-only in the index', async () => {
    const { store } = setup();
    expect(value(await store.save(fixtureSave({ runStatus: 'ended' }))).status).toBe('ended');
  });

  it('gives concurrent saves distinct slots', async () => {
    const { store } = setup();
    const [a, b, c] = await Promise.all([
      store.save(fixtureSave({ turn: 1 })),
      store.save(fixtureSave({ turn: 2 })),
      store.autosave(fixtureSave({ turn: 3 })),
    ]);
    expect(value(a).slotId).not.toBe(value(b).slotId);
    expect(value(c)).toHaveLength(1);
    expect(await store.list()).toHaveLength(3);
  });
});

describe('export and import through the store', () => {
  it('round-trips byte-identical text: export → import → export', async () => {
    const { store, kv } = setup();
    const meta = value(await store.save(fixtureSave({ turn: 40, withLog: true }), { slotName: 'Season one' }));
    const storedText = (await kv.get(`slot/${meta.slotId}/text`)) as string;
    for (const gzip of [true, false]) {
      const file = value(await store.exportSlot(meta.slotId, { gzip }));
      expect(file.fileName).toBe(gzip ? 'season-one.gmt.json.gz' : 'season-one.gmt.json');
      const imported = value(await store.importFile(file.bytes));
      expect(imported.notices).toEqual([]);
      expect(value(await store.load(imported.meta.slotId)).text).toBe(storedText);
      const again = value(await store.exportSlot(imported.meta.slotId, { gzip }));
      expect(again.bytes).toEqual(file.bytes);
    }
  });

  it('migrates an older file on import and reports it', async () => {
    const { store } = setup();
    const imported = value(await store.importFile(JSON.stringify(fixtureSaveV1())));
    expect(imported.meta.schemaVersion).toBe(3);
    expect(imported.notices[0]).toMatchObject({ code: 'SAVE_MIGRATED', fromVersion: 1, toVersion: 3 });
  });

  it('rejects corrupt, foreign and too-new files and changes nothing', async () => {
    const { store, kv } = setup();
    value(await store.save(fixtureSave({ turn: 5 })));
    value(await store.autosave(fixtureSave({ turn: 6 })));
    const before = kv.snapshot();
    const bad: [Uint8Array | string, string][] = [
      [new Uint8Array([0x1f, 0x8b, 0x08, 0x00, 0x01]), 'SAVE_CORRUPT'],
      ['{"format":"gmt-save","schemaVersion":3,', 'SAVE_CORRUPT'],
      [serializeSave({ ...fixtureSave(), state: null }), 'SAVE_CORRUPT'],
      ['{"format":"spreadsheet"}', 'SAVE_FORMAT'],
      [serializeSave({ ...fixtureSave(), schemaVersion: 4 }), 'SAVE_TOO_NEW'],
    ];
    for (const [input, code] of bad) {
      expect(errorCode(await store.importFile(input))).toBe(code);
    }
    expect(kv.snapshot()).toEqual(before);
  });
});

describe('autosave (13.16, D-13.25)', () => {
  const ROTATING = uiConfig['ui.autosaveRotatingSlots'];
  const YEARLY = uiConfig['ui.autosaveYearlyKeep'];

  it('keeps the 3 rotating autosaves holding the 3 latest weeks', async () => {
    const { store } = setup();
    for (let turn = 1; turn <= 20; turn++) value(await store.autosave(fixtureSave({ turn })));
    const autos = (await store.list()).filter((m) => m.kind === 'autosave');
    expect(ROTATING).toBe(3);
    expect(autos).toHaveLength(3);
    expect(autos.map((m) => m.slotId).sort()).toEqual(['auto-1', 'auto-2', 'auto-3']);
    expect(autos.map((m) => m.summary.week)).toEqual([21, 20, 19]);
    expect((await store.latestAutosave())?.summary.week).toBe(21);
  });

  it('writes a year-start snapshot at Wk 1 of each year and keeps the last 5', async () => {
    const { store } = setup();
    for (let turn = 1; turn <= 52 * 7; turn++) value(await store.autosave(fixtureSave({ turn })));
    const list = await store.list();
    const yearly = list.filter((m) => m.kind === 'yearly');
    expect(YEARLY).toBe(5);
    expect(yearly.map((m) => [m.slotId, m.summary.year, m.summary.week])).toEqual([
      ['year-8', 8, 1],
      ['year-7', 7, 1],
      ['year-6', 6, 1],
      ['year-5', 5, 1],
      ['year-4', 4, 1],
    ]);
    expect(list.filter((m) => m.kind === 'autosave')).toHaveLength(3);
    expect(list.filter((m) => m.kind === 'manual')).toHaveLength(0);
  });

  it('never stores the replay log in an autosave (§2.9)', async () => {
    const { store } = setup();
    const [meta] = value(await store.autosave(fixtureSave({ turn: 2, withLog: true })));
    const loaded = value(await store.load(meta?.slotId ?? ''));
    expect(loaded.save.actionLog).toBeUndefined();
    expect(loaded.save.state).toEqual(fixtureSave({ turn: 2 }).state);
  });

  it('overwrites the least recently written rotating slot', () => {
    const meta = (slotId: string, seq: number): SlotMeta => ({
      slotId,
      kind: 'autosave',
      slotName: '',
      savedAt: '',
      seq,
      schemaVersion: 3,
      rulesVersion: 'p0',
      summary: { company: '', year: 1, week: 1, cash: 0, netWorth: 0 },
      sizeBytes: 0,
      status: 'active',
    });
    expect(nextAutosaveSlot([], 3)).toBe('auto-1');
    expect(nextAutosaveSlot([meta('auto-1', 5)], 3)).toBe('auto-2');
    expect(nextAutosaveSlot([meta('auto-1', 7), meta('auto-2', 5), meta('auto-3', 6)], 3)).toBe('auto-2');
  });

  it('reports a failed write and leaves the previous slots intact', async () => {
    const inner = createMemoryKv();
    let failWrites = false;
    const flaky: KvStore = {
      get: (k) => inner.get(k),
      keys: () => inner.keys(),
      delMany: (k) => inner.delMany(k),
      setMany: (entries) => (failWrites ? Promise.reject(new Error('QuotaExceededError')) : inner.setMany(entries)),
    };
    const store = createSaveStore({ kv: flaky, codec: fixtureCodec, now: clock() });
    value(await store.autosave(fixtureSave({ turn: 1 })));
    const before = inner.snapshot();
    failWrites = true;
    expect(errorCode(await store.autosave(fixtureSave({ turn: 2 })))).toBe('SAVE_WRITE_FAILED');
    expect(errorCode(await store.save(fixtureSave({ turn: 2 })))).toBe('SAVE_WRITE_FAILED');
    expect(inner.snapshot()).toEqual(before);
    const loaded = readSave((await inner.get('slot/auto-1/text')) as string, fixtureCodec);
    expect(value(loaded).save.summary.week).toBe(2);
  });
});
