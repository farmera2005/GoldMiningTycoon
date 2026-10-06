// T11 Saves (DESIGN §13.27 T11, §2.9, §13.16) through the UI's own path: the engine client builds the SaveFile,
// src/persistence stores, exports and imports it with the engine's codec. Autosave rotation and the yearly keep are
// in engineClient.test.ts; the Saves screen's error display is in screens/saves/Saves.test.tsx.
import { describe, expect, it, vi } from 'vitest';
import { uiConfig } from '../../data/tuning/ui';
import fixtureV1 from '../../engine/save/fixtures/save-v1.json';
import {
  CURRENT_SCHEMA_VERSION,
  createSaveCodec,
  defaultNewGameSetup,
  hashState,
  newGame,
  parseSaveFile,
  serializeSaveFile,
  toSaveFile,
  type GameState,
  type Migration,
  type VersionedSave,
} from '../../engine';
import { createMemoryKv, exportSaveText, readSave, type MemoryKv } from '../../persistence';
import { createHarness, freshState, loadState } from '../testing/harness';
import type { UiPersisted } from '../store/persisted';

vi.setConfig({ testTimeout: 60_000 });

async function savedGame() {
  const h = createHarness();
  loadState(h.client);
  for (let i = 0; i < 3; i++) h.client.advance();
  const persisted: UiPersisted = {
    ...h.store.getState().persisted,
    tableLayouts: { ledger: { columns: ['date', 'memo'], sort: [{ id: 'date', desc: true }], filters: [] } },
    tutorial: { enabled: true, completed: ['dashboard'], dismissed: [] },
  };
  h.store.getState().setPersisted(persisted);
  const meta = await h.client.saveToSlot({ slotName: 'Round trip' });
  if (!meta.ok) throw new Error(meta.error.message);
  return { h, meta: meta.value };
}

describe('T11: export → import round trip', () => {
  it.each([true, false])('gives byte-identical state and ui (gzip %s)', async (gzip) => {
    const { h, meta } = await savedGame();
    const original = await h.saves.load(meta.slotId);
    if (!original.ok) throw new Error(original.error.message);
    const file = await h.saves.exportSlot(meta.slotId, { gzip });
    if (!file.ok) throw new Error(file.error.message);
    expect(file.value.fileName).toBe(gzip ? 'round-trip.gmt.json.gz' : 'round-trip.gmt.json');

    const other = createHarness();
    const imported = await other.saves.importFile(file.value.bytes);
    if (!imported.ok) throw new Error(imported.error.message);
    expect(imported.value.notices).toEqual([]);
    const back = await other.saves.load(imported.value.meta.slotId);
    if (!back.ok) throw new Error(back.error.message);
    expect(JSON.stringify(back.value.save.state)).toBe(JSON.stringify(original.value.save.state));
    expect(JSON.stringify(back.value.save.ui)).toBe(JSON.stringify(original.value.save.ui));

    // Loaded into a second client, the game hashes identically and keeps its UI block.
    const loaded = await other.client.loadSlot(imported.value.meta);
    expect(loaded.ok).toBe(true);
    const a = h.store.getState().game.state as GameState;
    const b = other.store.getState().game.state as GameState;
    expect(hashState(b)).toBe(hashState(a));
    expect(other.store.getState().persisted.tableLayouts).toEqual(h.store.getState().persisted.tableLayouts);
    expect(other.store.getState().persisted.tutorial).toEqual({ enabled: true, completed: ['dashboard'], dismissed: [] });
  });

  it('keeps SaveFile.ui out of the state hash', () => {
    const s = freshState();
    const a = parseSaveFile(serializeSaveFile(toSaveFile(s, { slotName: 'a', savedAt: 'x', ui: { uiVersion: 1 } })));
    const b = parseSaveFile(
      serializeSaveFile(toSaveFile(s, { slotName: 'b', savedAt: 'y', ui: { uiVersion: 1, ironman: true } })),
    );
    if (!a.ok || !b.ok) throw new Error('parse failed');
    expect(hashState(a.save.state)).toBe(hashState(b.save.state));
  });
});

describe('T11: refused and damaged files change nothing', () => {
  async function storeWithSlot(): Promise<{ kv: MemoryKv; harness: ReturnType<typeof createHarness> }> {
    const kv = createMemoryKv();
    const harness = createHarness({ kv });
    loadState(harness.client);
    await harness.client.saveToSlot({ slotName: 'Keep me' });
    return { kv, harness };
  }

  it('rejects a newer schema with SAVE_TOO_NEW', async () => {
    const { kv, harness } = await storeWithSlot();
    const before = kv.snapshot();
    const save = toSaveFile(freshState(), { slotName: 'Future', savedAt: 'x' });
    const text = JSON.stringify({ ...save, schemaVersion: CURRENT_SCHEMA_VERSION + 1 });
    const r = await harness.saves.importFile(text);
    expect(r).toMatchObject({ ok: false, error: { code: 'SAVE_TOO_NEW' } });
    expect(kv.snapshot()).toEqual(before);
  });

  it('rejects a corrupt file with SAVE_CORRUPT and a foreign one with SAVE_FORMAT', async () => {
    const { kv, harness } = await storeWithSlot();
    const before = kv.snapshot();
    expect(await harness.saves.importFile(new Uint8Array([0x1f, 0x8b, 1, 2, 3]))).toMatchObject({
      ok: false,
      error: { code: 'SAVE_CORRUPT' },
    });
    expect(await harness.saves.importFile('{"format":"other-game"}')).toMatchObject({
      ok: false,
      error: { code: 'SAVE_FORMAT' },
    });
    // A well-formed envelope around a damaged state (the ledger no longer balances).
    const save = JSON.parse(serializeSaveFile(toSaveFile(freshState(), { slotName: 'x', savedAt: 'x' }))) as {
      state: GameState;
    };
    (save.state.finance.books.company.balances as Record<string, number>)['cash.operating'] = 1;
    expect(await harness.saves.importFile(JSON.stringify(save))).toMatchObject({
      ok: false,
      error: { code: 'SAVE_CORRUPT' },
    });
    expect(kv.snapshot()).toEqual(before);
  });
});

describe('T11: older saves migrate (§2.9)', () => {
  // P0 has no shipped migration (the registry is empty until P1), so this registers one the way §2.9 adds them: a
  // synthetic v2 build whose v1 → v2 step bumps the schema.
  const toV2: Migration = {
    from: 1,
    name: 'v1→v2 synthetic',
    migrate: (save) =>
      ({ ...save, schemaVersion: 2, state: { ...(save['state'] as object), schemaVersion: 2 } }) as VersionedSave,
  };

  it('migrates a v(N−1) file on import and lists the migration in the notice', async () => {
    const codec = createSaveCodec({ currentSchemaVersion: 2, migrations: [toV2] });
    const h = createHarness({ codec });
    const v1 = serializeSaveFile(toSaveFile(freshState(), { slotName: 'Old camp', savedAt: 'x' }));
    const r = await h.saves.importFile(v1);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.notices).toEqual([
      { code: 'SAVE_MIGRATED', fromVersion: 1, toVersion: 2, migrations: ['v1→v2 synthetic'] },
    ]);
    expect(r.value.meta.schemaVersion).toBe(2);
  });

  it("reads the engine's committed v1 fixture, noting only that it keeps its own tuning", () => {
    const loaded = readSave(JSON.stringify(fixtureV1), createSaveCodec({ currentSchemaVersion: 1, migrations: [] }));
    if (!loaded.ok) throw new Error(loaded.error.message);
    expect(loaded.value.notices.every((n) => n.code === 'TUNING_DIFFERS')).toBe(true);
    expect(exportSaveText(loaded.value.text, 'fixture', { gzip: false }).bytes.length).toBeGreaterThan(0);
  });
});

describe('T11: ui.* is outside the tuning hash (D-13.32)', () => {
  it('changing a ui.* value leaves meta.tuningHash unchanged', () => {
    const setup = defaultNewGameSetup({ companyName: 'Hash Check' });
    const before = newGame(setup, 'ui-hash').meta.tuningHash;
    const table = uiConfig as unknown as Record<string, unknown>;
    const saved = { reports: table['ui.reportsInMemory'], cents: table['ui.fmt.centsHiddenAboveUsd'] };
    try {
      table['ui.reportsInMemory'] = 99;
      table['ui.fmt.centsHiddenAboveUsd'] = 5;
      const after = newGame(setup, 'ui-hash');
      expect(after.meta.tuningHash).toBe(before);
      expect(Object.keys(after.meta.tuning).some((k) => k.startsWith('ui.'))).toBe(false);
    } finally {
      table['ui.reportsInMemory'] = saved.reports;
      table['ui.fmt.centsHiddenAboveUsd'] = saved.cents;
    }
  });
});
