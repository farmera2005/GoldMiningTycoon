// T11 Saves, storage half (DESIGN §13.27; §13.16, D-13.25): slots, autosave rotation (3 rotating + yearly
// snapshots), byte-identical export → import through the store, and failures that change nothing.
import { describe, expect, it } from 'vitest';
import { uiConfig } from '../data/tuning/ui';
import { createMemoryKv, type KvStore } from './kv';
import { readSave, serializeSave, type Result } from './saveFile';
import {
  autosavesToPrune,
  createSaveStore,
  nextAutosaveSlot,
  type SaveStore,
  type SlotKind,
  type SlotMeta,
} from './saveStore';
import { fixtureCodec, fixtureSave, fixtureSaveV1 } from './testFixtures';

function clock(): () => string {
  let t = Date.UTC(2026, 9, 5, 12, 0, 0);
  return () => new Date((t += 60_000)).toISOString();
}

const GAME_A = { gameId: 'gA' } as const;
const GAME_B = { gameId: 'gB' } as const;

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
    expect(value(await store.list())).toEqual([meta]);
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
    expect(value(await store.list())).toHaveLength(1);
  });

  it('refuses unknown slots, autosave slots as Save here targets, and manual saves in Ironman', async () => {
    const { store } = setup();
    expect(errorCode(await store.save(fixtureSave(), { slotId: 'm999' }))).toBe('SLOT_NOT_FOUND');
    const autos = value(await store.autosave(fixtureSave({ turn: 3 }), GAME_A));
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
    expect(value(await store.list())).toEqual([]);
    expect((await kv.keys()).filter((k) => k.startsWith('slot/'))).toEqual([]);
  });

  it('skips damaged index entries when listing', async () => {
    const { store, kv } = setup();
    const good = value(await store.save(fixtureSave()));
    await kv.setMany([
      ['slot/junk/meta', { slotId: 'junk', kind: 'manual' }],
      ['slot/odd/meta', { ...good, slotId: 'odd', summary: { company: 'X', year: '1' } }],
    ]);
    expect(value(await store.list()).map((m) => m.slotId)).toEqual([good.slotId]);
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
      store.autosave(fixtureSave({ turn: 3 }), GAME_A),
    ]);
    expect(value(a).slotId).not.toBe(value(b).slotId);
    expect(value(c)).toHaveLength(1);
    expect(value(await store.list())).toHaveLength(3);
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
    value(await store.autosave(fixtureSave({ turn: 6 }), GAME_A));
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

  /** Autosaves `game` for every turn in [from, to] under `company`. */
  async function play(store: SaveStore, game: { gameId: string }, company: string, from: number, to: number) {
    for (let turn = from; turn <= to; turn++) value(await store.autosave(fixtureSave({ turn, company }), game));
  }

  const slotsOf = (list: readonly SlotMeta[], kind: SlotKind): [string | undefined, number, number][] =>
    list.filter((m) => m.kind === kind).map((m) => [m.gameId, m.summary.year, m.summary.week]);

  it('keeps the 3 rotating autosaves holding the 3 latest weeks', async () => {
    const { store } = setup();
    for (let turn = 1; turn <= 20; turn++) value(await store.autosave(fixtureSave({ turn }), GAME_A));
    const autos = value(await store.list()).filter((m) => m.kind === 'autosave');
    expect(ROTATING).toBe(3);
    expect(autos).toHaveLength(3);
    expect(autos.map((m) => m.slotId).sort()).toEqual(['auto-gA-1', 'auto-gA-2', 'auto-gA-3']);
    expect(autos.map((m) => m.summary.week)).toEqual([21, 20, 19]);
    expect(value(await store.latestAutosave())?.summary.week).toBe(21);
  });

  it('writes a year-start snapshot at Wk 1 of each year and keeps the last 5', async () => {
    const { store } = setup();
    for (let turn = 1; turn <= 52 * 7; turn++) value(await store.autosave(fixtureSave({ turn }), GAME_A));
    const list = value(await store.list());
    const yearly = list.filter((m) => m.kind === 'yearly');
    expect(YEARLY).toBe(5);
    expect(yearly.map((m) => [m.slotId, m.summary.year, m.summary.week])).toEqual([
      ['year-gA-8', 8, 1],
      ['year-gA-7', 7, 1],
      ['year-gA-6', 6, 1],
      ['year-gA-5', 5, 1],
      ['year-gA-4', 4, 1],
    ]);
    expect(list.filter((m) => m.kind === 'autosave')).toHaveLength(3);
    expect(list.filter((m) => m.kind === 'manual')).toHaveLength(0);
  });

  it('keeps each game’s autosaves apart: a second game never overwrites or prunes the first’s', async () => {
    const { store } = setup();
    await play(store, GAME_A, 'Alpha', 0, 105); // A: Y1 Wk 1 … Y3 Wk 2
    await play(store, GAME_B, 'Bravo', 0, 0); // B starts: its own Y1 snapshot
    let list = value(await store.list());
    expect(slotsOf(list, 'yearly')).toEqual([
      ['gB', 1, 1],
      ['gA', 3, 1],
      ['gA', 2, 1],
      ['gA', 1, 1],
    ]);
    await play(store, GAME_B, 'Bravo', 1, 52 * 6); // B reaches Y7 Wk 1: 7 snapshots of its own, keeps 5
    list = value(await store.list());
    expect(slotsOf(list, 'yearly')).toEqual([
      ['gB', 7, 1],
      ['gB', 6, 1],
      ['gB', 5, 1],
      ['gB', 4, 1],
      ['gB', 3, 1],
      ['gA', 3, 1],
      ['gA', 2, 1],
      ['gA', 1, 1],
    ]);
    // A's rotating autosaves still hold its last three weeks.
    expect(slotsOf(list, 'autosave').filter(([g]) => g === 'gA')).toEqual([
      ['gA', 3, 2],
      ['gA', 3, 1],
      ['gA', 2, 52],
    ]);
    expect(slotsOf(list, 'autosave').filter(([g]) => g === 'gB')).toHaveLength(ROTATING);
    // The title screen's Continue is the newest autosave of any game.
    expect(value(await store.latestAutosave())).toMatchObject({ gameId: 'gB', summary: { year: 7, week: 1 } });
  });

  it('replaces a game’s own snapshot when it reaches the same year again', async () => {
    const { store } = setup();
    await play(store, GAME_A, 'Alpha', 50, 53); // Y1 Wk 51 … Y2 Wk 2
    // Reloaded from Y1 Wk 52 and played into Y2 again.
    value(await store.autosave(fixtureSave({ turn: 52, company: 'Alpha', cashCents: 7_00 }), GAME_A));
    const yearly = value(await store.list()).filter((m) => m.kind === 'yearly');
    expect(yearly).toHaveLength(1);
    expect(yearly[0]).toMatchObject({ slotId: 'year-gA-2', summary: { year: 2, week: 1, cash: 7_00 } });
  });

  it('never stores the replay log in an autosave (§2.9)', async () => {
    const { store } = setup();
    const [meta] = value(await store.autosave(fixtureSave({ turn: 2, withLog: true }), GAME_A));
    const loaded = value(await store.load(meta?.slotId ?? ''));
    expect(loaded.save.actionLog).toBeUndefined();
    expect(loaded.save.state).toEqual(fixtureSave({ turn: 2 }).state);
  });

  it('overwrites the game’s least recently written rotating slot and ignores other games’ slots', () => {
    const meta = (slotId: string, seq: number, gameId = 'gA'): SlotMeta => ({
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
      gameId,
    });
    expect(nextAutosaveSlot([], 'gA', 3)).toBe('auto-gA-1');
    expect(nextAutosaveSlot([meta('auto-gA-1', 5)], 'gA', 3)).toBe('auto-gA-2');
    expect(nextAutosaveSlot([meta('auto-gA-1', 7), meta('auto-gA-2', 5), meta('auto-gA-3', 6)], 'gA', 3)).toBe(
      'auto-gA-2',
    );
    const b = [meta('auto-gB-1', 1, 'gB'), meta('auto-gB-2', 2, 'gB'), meta('auto-gB-3', 3, 'gB')];
    expect(nextAutosaveSlot(b, 'gA', 3)).toBe('auto-gA-1');
    expect(autosavesToPrune([...b, meta('auto-gA-4', 9)], 'gA', 3, 5)).toEqual(['auto-gA-4']);
  });

  it('leaves index entries written before game ids existed alone', async () => {
    const { store, kv } = setup();
    const [written] = value(await store.autosave(fixtureSave({ turn: 3 }), GAME_A));
    const { gameId: _gameId, ...legacy } = { ...(written as SlotMeta), slotId: 'auto-1' };
    await kv.setMany([['slot/auto-1/meta', legacy]]);
    await play(store, GAME_A, 'Alpha', 4, 10);
    const old = value(await store.list()).find((m) => m.slotId === 'auto-1');
    expect(old).toMatchObject({ kind: 'autosave' });
    expect(old?.gameId).toBeUndefined();
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
    value(await store.autosave(fixtureSave({ turn: 1 }), GAME_A));
    const before = inner.snapshot();
    failWrites = true;
    expect(errorCode(await store.autosave(fixtureSave({ turn: 2 }), GAME_A))).toBe('SAVE_WRITE_FAILED');
    expect(errorCode(await store.save(fixtureSave({ turn: 2 })))).toBe('SAVE_WRITE_FAILED');
    expect(inner.snapshot()).toEqual(before);
    const loaded = readSave((await inner.get('slot/auto-gA-1/text')) as string, fixtureCodec);
    expect(value(loaded).save.summary.week).toBe(2);
  });
});

describe('storage failures (13.16: every operation resolves to a typed Result)', () => {
  type KvOp = 'get' | 'keys' | 'setMany' | 'delMany';

  /** A memory KV whose operations can be made to reject, as IndexedDB does when blocked, evicted or closed. */
  function brokenKv() {
    const inner = createMemoryKv();
    const broken: Record<KvOp, boolean> = { get: false, keys: false, setMany: false, delMany: false };
    const refuse = (): Promise<never> =>
      Promise.reject(new DOMException('Internal error opening backing store', 'UnknownError'));
    const kv: KvStore = {
      get: (k) => (broken.get ? refuse() : inner.get(k)),
      keys: () => (broken.keys ? refuse() : inner.keys()),
      setMany: (e) => (broken.setMany ? refuse() : inner.setMany(e)),
      delMany: (k) => (broken.delMany ? refuse() : inner.delMany(k)),
    };
    return { kv, inner, broken };
  }

  it('turns rejected reads into SAVE_READ_FAILED or SAVE_WRITE_FAILED for every operation, changing nothing', async () => {
    const { kv, inner, broken } = brokenKv();
    const store = createSaveStore({ kv, codec: fixtureCodec, now: clock() });
    const meta = value(await store.save(fixtureSave({ turn: 5 }), { slotName: 'Keep' }));
    value(await store.autosave(fixtureSave({ turn: 6 }), GAME_A));
    const before = inner.snapshot();
    broken.get = true;
    broken.keys = true;
    const outcomes: [string, Result<unknown>][] = [
      ['list', await store.list()],
      ['latestAutosave', await store.latestAutosave()],
      ['load', await store.load(meta.slotId)],
      ['exportSlot', await store.exportSlot(meta.slotId)],
      ['save', await store.save(fixtureSave({ turn: 7 }))],
      ['save here', await store.save(fixtureSave({ turn: 7 }), { slotId: meta.slotId })],
      ['rename', await store.rename(meta.slotId, 'Renamed')],
      ['remove', await store.remove(meta.slotId)],
      ['importFile', await store.importFile(serializeSave(fixtureSave({ turn: 8 })))],
      ['autosave', await store.autosave(fixtureSave({ turn: 7 }), GAME_A)],
    ];
    expect(outcomes.map(([op, r]) => [op, errorCode(r)])).toEqual([
      ['list', 'SAVE_READ_FAILED'],
      ['latestAutosave', 'SAVE_READ_FAILED'],
      ['load', 'SAVE_READ_FAILED'],
      ['exportSlot', 'SAVE_READ_FAILED'],
      ['save', 'SAVE_WRITE_FAILED'],
      ['save here', 'SAVE_WRITE_FAILED'],
      ['rename', 'SAVE_WRITE_FAILED'],
      ['remove', 'SAVE_WRITE_FAILED'],
      ['importFile', 'SAVE_WRITE_FAILED'],
      ['autosave', 'SAVE_WRITE_FAILED'],
    ]);
    for (const [, r] of outcomes) {
      if (!r.ok) expect(r.error.message).toContain('UnknownError: Internal error opening backing store');
    }
    expect(inner.snapshot()).toEqual(before);

    // Once storage recovers the same store works again: a failure never wedges the queue.
    broken.get = false;
    broken.keys = false;
    expect(value(await store.list()).map((m) => m.slotId)).toContain(meta.slotId);
  });

  it('reports a failed rename or delete write as SAVE_WRITE_FAILED', async () => {
    const { kv, broken } = brokenKv();
    const store = createSaveStore({ kv, codec: fixtureCodec, now: clock() });
    const meta = value(await store.save(fixtureSave({ turn: 5 })));
    broken.setMany = true;
    broken.delMany = true;
    expect(errorCode(await store.rename(meta.slotId, 'x'))).toBe('SAVE_WRITE_FAILED');
    expect(errorCode(await store.remove(meta.slotId))).toBe('SAVE_WRITE_FAILED');
    broken.setMany = false;
    broken.delMany = false;
    expect(value(await store.load(meta.slotId)).save.slotName).toBe('Hardrock Gulch Mining LLC');
  });
});
