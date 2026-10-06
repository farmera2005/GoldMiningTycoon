// The engine client (DESIGN §13.18) with the real engine, the UI store and a memory save store: new game, Advance,
// undo rules (D-13.11, T10's client half), retention, autosave rotation and the year-start snapshot (13.16, D-13.25)
// with a fake idle scheduler and wall clock, and the failed-write toast.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { uiConfig } from '../../data/tuning/ui';
import { asAction, registerTestActions } from '../../engine/actions/testActions';
import { CURRENT_SCHEMA_VERSION, hashState, select, toSaveFile, type GameState } from '../../engine';
import { createMemoryKv, type KvStore, type SlotMeta } from '../../persistence';
import { legacyGameId } from '../store/gameId';
import { UI_PERSISTED_VERSION } from '../store/persisted';
import { createHarness, faultyKv, freshState, loadState, type Harness } from '../testing/harness';

vi.setConfig({ testTimeout: 60_000 });

let unregister: () => void = () => undefined;
beforeAll(() => {
  unregister = registerTestActions();
});
afterAll(() => unregister());

const transfer = (cents: number) => asAction({ type: 'test/transfer', cents });

async function listed(h: Harness): Promise<SlotMeta[]> {
  const r = await h.saves.list();
  if (!r.ok) throw new Error(`list failed: ${r.error.code}`);
  return r.value;
}

describe('new game and Advance', () => {
  it('starts a game from the wizard input and writes the first autosave (with the year-1 snapshot)', async () => {
    const h = createHarness();
    const out = h.client.newGame({ companyName: '  Ruby Creek Placers ', seed: 'ABCDEFGHJKMNPQRSTVWXYZ0123' });
    expect(out).toEqual({ ok: true });
    const state = h.store.getState().game.state as GameState;
    expect(state.company.name).toBe('Ruby Creek Placers');
    expect(state.meta.seed).toBe('ABCDEFGHJKMNPQRSTVWXYZ0123');
    expect(h.store.getState().game.dirty).toBe(true);
    await h.client.settled();
    const gameId = h.store.getState().persisted.gameId;
    expect(gameId).toMatch(/^g[0-9a-z]{16}$/);
    const slots = await listed(h);
    expect(slots.map((s) => [s.kind, s.slotId, s.gameId]).sort()).toEqual([
      ['autosave', `auto-${gameId}-1`, gameId],
      ['yearly', `year-${gameId}-1`, gameId],
    ]);
    expect(h.store.getState().game).toMatchObject({ dirty: false, savedTurn: 0 });
  });

  it('refuses an invalid name with the engine setup codes and changes nothing', () => {
    const h = createHarness();
    expect(h.client.newGame({ companyName: '   ', seed: 'x' })).toEqual({
      ok: false,
      issues: [{ code: 'NAME_EMPTY', field: 'companyName' }],
    });
    expect(h.client.newGame({ companyName: 'x'.repeat(41), seed: 'x' })).toMatchObject({
      ok: false,
      issues: [{ code: 'NAME_TOO_LONG' }],
    });
    expect(h.store.getState().game.state).toBeNull();
  });

  it('advances the date, keeps P0 cash, stores the report and announces the week', () => {
    const h = createHarness();
    loadState(h.client);
    const before = h.store.getState().game.state as GameState;
    const cash = select.cashOnHand(before);
    for (let i = 0; i < 3; i++) expect(h.client.advance().ok).toBe(true);
    const g = h.store.getState().game;
    const after = g.state as GameState;
    expect(select.dateView(after)).toMatchObject({ year: 1, week: 4 });
    expect(select.cashOnHand(after)).toBe(cash);
    expect(g.reports.map((r) => r.turn)).toEqual([3, 2, 1]);
    expect(g.calcReports.map((r) => r.turn)).toEqual([3, 2, 1]);
    // explain: true, so the reports carry calc trees (the cash tree at least).
    expect(g.calcReports[0]?.calc?.['finance.cashOnHand']?.label).toBe('Cash on hand');
    expect(g.dirty).toBe(true);
    expect(h.store.getState().announcement).toBe('Y1 Wk 4 complete: cash $0.00; 0 new alerts');
  });

  it('keeps ui.reportsInMemory summaries and ui.calcRetentionWeeks full reports', () => {
    const h = createHarness();
    loadState(h.client);
    const weeks = uiConfig['ui.reportsInMemory'] + 2;
    for (let i = 0; i < weeks; i++) h.client.advance();
    const g = h.store.getState().game;
    expect(g.reports).toHaveLength(uiConfig['ui.reportsInMemory']);
    expect(g.reports[0]?.turn).toBe(weeks);
    expect(g.calcReports).toHaveLength(uiConfig['ui.calcRetentionWeeks']);
    expect(g.calcReports.map((r) => r.turn)).toEqual([weeks, weeks - 1, weeks - 2, weeks - 3]);
  });

  it('refuses Advance with no game, with a blocking decision open, and after the run ends (13.21)', () => {
    const h = createHarness();
    expect(h.client.advance()).toEqual({ ok: false, code: 'NO_GAME' });
    loadState(h.client);
    expect(h.client.apply(asAction({ type: 'test/decide', blocking: true, deadlineInWeeks: 2, cents: 100 })).ok).toBe(
      true,
    );
    expect(h.client.advanceBlock()).toBe('BLOCKING_DECISION_OPEN');
    const turn = h.store.getState().game.state?.clock.turn;
    expect(h.client.advance()).toEqual({ ok: false, code: 'BLOCKING_DECISION_OPEN' });
    expect(h.store.getState().game.state?.clock.turn).toBe(turn);

    const h2 = createHarness();
    loadState(h2.client);
    h2.client.apply(asAction({ type: 'test/liquidate' }));
    h2.client.advance(); // step 16d ends the run
    expect(h2.store.getState().game.state?.company.runStatus).not.toBe('active');
    expect(h2.client.advance()).toEqual({ ok: false, code: 'GAME_OVER' });
  });
});

describe('one week per Advance (13.15)', () => {
  it('never re-enters Advance while a week resolves', () => {
    const h = createHarness();
    loadState(h.client);
    const nested: unknown[] = [];
    const stop = h.store.subscribe((s, prev) => {
      // A listener that reacts to the week landing by asking for another one (a held key, a stray click).
      if (s.game.state !== prev.game.state && nested.length === 0) nested.push(h.client.advance());
    });
    expect(h.client.advance().ok).toBe(true);
    stop();
    expect(nested).toEqual([{ ok: false, code: 'RUN_IN_PROGRESS' }]);
    expect(h.store.getState().game.state?.clock.turn).toBe(1);
    // The guard is released once the week is done.
    expect(h.client.advance().ok).toBe(true);
    expect(h.store.getState().game.state?.clock.turn).toBe(2);
  });
});

describe('undo (D-13.11, 13.21 ui/undo)', () => {
  it('restores a deep-equal previous state and pops the action log', () => {
    const h = createHarness();
    loadState(h.client);
    const s0 = h.store.getState().game.state as GameState;
    expect(h.client.apply(transfer(1_000_00))).toEqual({ ok: true, undoable: true });
    expect(h.client.apply(transfer(2_000_00))).toEqual({ ok: true, undoable: true });
    expect(h.store.getState().game.actionLog.map((a) => a.actionSeq)).toEqual([1, 2]);
    expect(h.client.undo()).toEqual({ ok: true });
    expect(h.client.undo()).toEqual({ ok: true });
    const g = h.store.getState().game;
    expect(g.state).toEqual(s0);
    expect(hashState(g.state as GameState)).toBe(hashState(s0));
    expect(g.actionLog).toEqual([]);
    expect(h.client.undo()).toEqual({ ok: false, code: 'NOTHING_TO_UNDO' });
  });

  it('is refused after a non-undoable action (dice, reveal, commitment), even for earlier actions', () => {
    for (const action of [
      asAction({ type: 'test/draw', n: 1 }),
      asAction({ type: 'test/reveal' }),
      asAction({ type: 'test/commit' }),
    ]) {
      const h = createHarness();
      loadState(h.client);
      h.client.apply(transfer(500_00));
      expect(h.client.apply(action)).toEqual({ ok: true, undoable: false });
      expect(h.client.undo()).toEqual({ ok: false, code: 'UNDO_NOT_ALLOWED' });
      expect(h.store.getState().game.actionLog).toHaveLength(2);
    }
  });

  it('keeps refusing with UNDO_NOT_ALLOWED after undoing back to a non-undoable action, until Advance (D-13.77)', () => {
    const h = createHarness();
    loadState(h.client);
    expect(h.client.apply(asAction({ type: 'test/reveal' }))).toEqual({ ok: true, undoable: false });
    expect(h.client.undo()).toEqual({ ok: false, code: 'UNDO_NOT_ALLOWED' });
    expect(h.client.apply(transfer(500_00))).toEqual({ ok: true, undoable: true });
    expect(h.client.undo()).toEqual({ ok: true });
    expect(h.client.undo()).toEqual({ ok: false, code: 'UNDO_NOT_ALLOWED' });
    expect(h.store.getState().game.actionLog).toHaveLength(1);
    h.client.advance();
    expect(h.client.undo()).toEqual({ ok: false, code: 'NOTHING_TO_UNDO' });
  });

  it('is cleared by Advance and refused in Ironman', () => {
    const h = createHarness();
    loadState(h.client);
    h.client.apply(transfer(500_00));
    h.client.advance();
    expect(h.client.undo()).toEqual({ ok: false, code: 'NOTHING_TO_UNDO' });

    h.store.getState().setPersisted({ ...h.store.getState().persisted, ironman: true });
    expect(h.client.apply(transfer(500_00))).toEqual({ ok: true, undoable: true });
    expect(h.store.getState().game.undo).toEqual([]);
    expect(h.client.undo()).toEqual({ ok: false, code: 'UNDO_IRONMAN' });
  });

  it('keeps at most ui.undoMaxEntries entries', () => {
    const h = createHarness();
    loadState(h.client);
    const n = uiConfig['ui.undoMaxEntries'] + 3;
    for (let i = 0; i < n; i++) h.client.apply(transfer(i % 2 === 0 ? 100 : -100));
    expect(h.store.getState().game.undo).toHaveLength(uiConfig['ui.undoMaxEntries']);
  });

  it('returns the typed validation error and leaves the state alone on a refused action', () => {
    const h = createHarness();
    loadState(h.client);
    const s0 = h.store.getState().game.state;
    const r = h.client.apply(transfer(10_000_000_00));
    expect(r).toMatchObject({ ok: false, error: { code: 'INSUFFICIENT_FUNDS' } });
    expect(h.client.validate(transfer(10_000_000_00))).toMatchObject({ ok: false });
    expect(h.store.getState().game.state).toBe(s0);
  });
});

describe('autosave (13.16, D-13.25)', () => {
  it('writes after every week when idle, rotating across ui.autosaveRotatingSlots', async () => {
    const h = createHarness();
    loadState(h.client);
    for (let i = 0; i < 5; i++) {
      h.tick();
      h.client.advance();
    }
    // Nothing is written until the browser is idle.
    expect(await listed(h)).toEqual([]);
    expect(h.idle.pending()).toBe(5);
    h.idle.flush();
    await h.client.settled();
    const autos = (await listed(h)).filter((s) => s.kind === 'autosave');
    expect(autos).toHaveLength(uiConfig['ui.autosaveRotatingSlots']);
    expect(autos.map((s) => s.summary.week)).toEqual([6, 5, 4]);
    expect(h.store.getState().game).toMatchObject({ dirty: false, savedTurn: 5 });
  });

  it('writes a year-start snapshot at Wk 1 and keeps the last ui.autosaveYearlyKeep', async () => {
    const keep = 2;
    const h = createHarness({ yearlyKeep: keep });
    loadState(h.client);
    for (let year = 1; year <= 3; year++) {
      for (let w = 0; w < 52; w++) {
        h.client.advance();
        // Only the Wk 1 writes matter here; drop the others to keep the test fast.
        if (h.store.getState().game.state?.clock.week === 1) h.idle.flush();
        else h.idle.drop();
        await h.client.settled();
      }
    }
    const yearly = (await listed(h)).filter((s) => s.kind === 'yearly');
    const gameId = legacyGameId(freshState());
    expect(yearly.map((s) => s.slotId)).toEqual([`year-${gameId}-4`, `year-${gameId}-3`]);
    expect(yearly.map((s) => s.summary)).toMatchObject([
      { year: 4, week: 1 },
      { year: 3, week: 1 },
    ]);
  });

  it('never marks a newer game saved by an older game’s late write', async () => {
    const h = createHarness();
    loadState(h.client);
    h.client.advance();
    loadState(h.client, freshState('another-seed', 'Other Co'));
    h.idle.flush();
    await h.client.settled();
    expect(h.store.getState().game).toMatchObject({ savedTurn: 0, dirty: false });
    expect(h.store.getState().game.state?.company.name).toBe('Other Co');
  });

  it('shows a critical toast with Export now when the write fails, and leaves the old slots intact', async () => {
    const memory = createMemoryKv();
    let failing = false;
    const kv: KvStore = {
      get: (k) => memory.get(k),
      keys: () => memory.keys(),
      delMany: (k) => memory.delMany(k),
      setMany: (e) => (failing ? Promise.reject(new Error('QuotaExceededError')) : memory.setMany(e)),
    };
    const h = createHarness({ kv });
    loadState(h.client);
    h.client.advance();
    h.idle.flush();
    await h.client.settled();
    const before = memory.snapshot();
    failing = true;
    h.client.advance();
    h.idle.flush();
    await h.client.settled();
    expect(h.store.getState().toasts).toMatchObject([
      { severity: 'critical', action: 'exportNow', message: expect.stringContaining('QuotaExceededError') },
    ]);
    expect(h.store.getState().game.dirty).toBe(true);
    expect(memory.snapshot()).toEqual(before);
    // Export now still works from memory.
    const file = h.client.exportCurrent();
    expect(file?.fileName).toBe('ruby-creek-placers.gmt.json.gz');
  });

  it('shows the same toast when storage cannot even be read, for a week and for a new game’s first autosave', async () => {
    const f = faultyKv();
    const h = createHarness({ kv: f.kv });
    loadState(h.client);
    f.broken.keys = true;
    f.broken.get = true;
    h.client.advance();
    h.idle.flush();
    await h.client.settled();
    expect(h.store.getState().toasts).toMatchObject([
      { severity: 'critical', action: 'exportNow', message: expect.stringMatching(/^Autosave failed: .*UnknownError/) },
    ]);
    expect(h.store.getState().game.dirty).toBe(true);
    expect(f.memory.snapshot()).toEqual({});

    h.client.newGame({ companyName: 'Second Try', seed: 'ui-test' });
    await h.client.settled();
    expect(h.store.getState().toasts).toHaveLength(2);
    expect(h.store.getState().toasts[1]).toMatchObject({ severity: 'critical', action: 'exportNow' });
  });

  it('keeps each game’s autosaves apart, and a loaded game keeps writing into its own (13.16)', async () => {
    const h = createHarness({ yearlyKeep: 5 });
    const alpha = freshState('alpha-seed', 'Alpha Placers');
    const bravo = freshState('bravo-seed', 'Bravo Gold');
    loadState(h.client, alpha);
    for (let i = 0; i < 4; i++) h.client.advance();
    h.idle.flush();
    await h.client.settled();
    const saved = await h.client.saveToSlot({ slotName: 'Alpha camp' });
    if (!saved.ok) throw new Error(saved.error.message);

    loadState(h.client, bravo);
    for (let i = 0; i < 5; i++) h.client.advance();
    h.idle.flush();
    await h.client.settled();
    const autosOf = async (company: string) =>
      (await listed(h))
        .filter((s) => s.kind === 'autosave' && s.summary.company === company)
        .map((s) => s.summary.week);
    expect(await autosOf('Alpha Placers')).toEqual([5, 4, 3]);
    expect(await autosOf('Bravo Gold')).toEqual([6, 5, 4]);

    // Back to Alpha from its manual slot: same game, so its own rotation continues.
    const loaded = await h.client.loadSlot(saved.value);
    expect(loaded.ok).toBe(true);
    expect(h.store.getState().persisted.gameId).toBe(legacyGameId(alpha));
    h.client.advance();
    h.idle.flush();
    await h.client.settled();
    expect(await autosOf('Alpha Placers')).toEqual([6, 5, 4]);
    expect(await autosOf('Bravo Gold')).toEqual([6, 5, 4]);
  });
});

describe('saving and loading through the client', () => {
  it('saves to a slot with SaveFile.ui = the persisted slice, then loads it back identically', async () => {
    const h = createHarness();
    loadState(h.client);
    h.client.advance();
    h.client.advance();
    const saved = await h.client.saveToSlot({ slotName: 'Spring camp' });
    expect(saved.ok).toBe(true);
    expect(h.store.getState().game).toMatchObject({ dirty: false, savedTurn: 2 });
    const state = h.store.getState().game.state as GameState;

    const other = createHarness({ kv: h.kv });
    if (!saved.ok) throw new Error('save failed');
    const loaded = await other.client.loadSlot(saved.value);
    expect(loaded).toEqual({ ok: true, notices: [] });
    const g = other.store.getState().game;
    expect(hashState(g.state as GameState)).toBe(hashState(state));
    expect(g.slotId).toBe(saved.value.slotId);
    expect(other.store.getState().persisted.stopRules).toEqual(h.store.getState().persisted.stopRules);
    // The newest calc week travels in SaveFile.ui (ui.calcPersistWeeks).
    expect(g.calcReports.map((r) => r.turn)).toEqual([2]);
  });

  it('quick-saves over the current manual slot, and declines without one', async () => {
    const h = createHarness();
    expect(await h.client.quickSave()).toEqual({ kind: 'noGame' });
    loadState(h.client);
    expect(await h.client.quickSave()).toEqual({ kind: 'noSlot' });
    const first = await h.client.saveToSlot({ slotName: 'Camp' });
    h.client.advance();
    expect(await h.client.quickSave()).toMatchObject({ kind: 'saved', slot: { slotName: 'Camp' } });
    const slots = (await listed(h)).filter((s) => s.kind === 'manual');
    expect(slots).toHaveLength(1);
    expect(first.ok && slots[0]?.slotId === first.value.slotId).toBe(true);
    expect(slots[0]?.summary.week).toBe(2);
  });

  it('reports a failed quick save with the critical toast and Export now, keeping the slot as it was', async () => {
    const f = faultyKv();
    const h = createHarness({ kv: f.kv });
    loadState(h.client);
    const first = await h.client.saveToSlot({ slotName: 'Camp' });
    if (!first.ok) throw new Error(first.error.message);
    h.client.advance();
    const before = f.memory.snapshot();
    f.broken.setMany = true;
    const outcome = await h.client.quickSave();
    expect(outcome).toMatchObject({ kind: 'failed', error: { code: 'SAVE_WRITE_FAILED' } });
    expect(h.store.getState().toasts).toMatchObject([
      {
        severity: 'critical',
        action: 'exportNow',
        message: expect.stringMatching(/^Quick save failed: .*UnknownError/),
      },
    ]);
    expect(h.store.getState().game).toMatchObject({ dirty: true, slotId: first.value.slotId });
    expect(f.memory.snapshot()).toEqual(before);
  });

  it('forgets a slot deleted elsewhere: the quick save fails with SLOT_NOT_FOUND, and the next one has no slot', async () => {
    const h = createHarness();
    loadState(h.client);
    const first = await h.client.saveToSlot({ slotName: 'Camp' });
    if (!first.ok) throw new Error(first.error.message);
    await h.saves.remove(first.value.slotId);
    expect(await h.client.quickSave()).toMatchObject({ kind: 'failed', error: { code: 'SLOT_NOT_FOUND' } });
    expect(h.store.getState().toasts[0]?.message).toContain('That save slot no longer exists.');
    expect(h.store.getState().game.slotId).toBeNull();
    expect(await h.client.quickSave()).toEqual({ kind: 'noSlot' });
  });

  it('keeps the typed error of a failed load (SLOT_NOT_FOUND, SAVE_TOO_NEW, SAVE_READ_FAILED) and changes nothing', async () => {
    const f = faultyKv();
    const h = createHarness({ kv: f.kv });
    loadState(h.client);
    const saved = await h.client.saveToSlot({ slotName: 'Camp' });
    if (!saved.ok) throw new Error(saved.error.message);
    const slot = saved.value;
    h.client.advance();
    const state = h.store.getState().game.state;

    expect(await h.client.loadSlot({ slotId: 'm999', kind: 'manual' })).toMatchObject({
      ok: false,
      error: { code: 'SLOT_NOT_FOUND' },
    });
    const key = `slot/${slot.slotId}/text`;
    const text = (await f.memory.get(key)) as string;
    await f.memory.setMany([[key, JSON.stringify({ ...JSON.parse(text), schemaVersion: CURRENT_SCHEMA_VERSION + 1 })]]);
    expect(await h.client.loadSlot(slot)).toMatchObject({
      ok: false,
      error: { code: 'SAVE_TOO_NEW', message: expect.stringContaining('newer version of the game') },
    });
    f.broken.get = true;
    expect(await h.client.loadSlot(slot)).toMatchObject({ ok: false, error: { code: 'SAVE_READ_FAILED' } });
    expect(h.store.getState().game.state).toBe(state);
  });

  it('builds the SaveFile from the engine with the action log in manual saves only', () => {
    const h = createHarness();
    loadState(h.client);
    h.client.apply(transfer(100));
    const save = h.client.currentSave();
    const state = h.store.getState().game.state as GameState;
    expect(save).toMatchObject({ format: 'gmt-save', slotName: 'Ruby Creek Placers' });
    expect(save?.state).toBe(state);
    expect(save?.actionLog).toHaveLength(1);
    expect(save?.ui).toMatchObject({ uiVersion: UI_PERSISTED_VERSION, ironman: false, gameId: legacyGameId(state) });
    expect(toSaveFile(state, { slotName: 'x', savedAt: 'y' }).summary).toEqual(save?.summary);
  });
});
