// The engine client (DESIGN §13.18) with the real engine, the UI store and a memory save store: new game, Advance,
// undo rules (D-13.11, T10's client half), retention, autosave rotation and the year-start snapshot (13.16, D-13.25)
// with a fake idle scheduler and wall clock, and the failed-write toast.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { uiConfig } from '../../data/tuning/ui';
import { asAction, registerTestActions } from '../../engine/actions/testActions';
import { hashState, select, toSaveFile, type GameState } from '../../engine';
import { createMemoryKv, type KvStore } from '../../persistence';
import { createHarness, freshState, loadState } from '../testing/harness';

vi.setConfig({ testTimeout: 60_000 });

let unregister: () => void = () => undefined;
beforeAll(() => {
  unregister = registerTestActions();
});
afterAll(() => unregister());

const transfer = (cents: number) => asAction({ type: 'test/transfer', cents });

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
    const slots = await h.saves.list();
    expect(slots.map((s) => [s.kind, s.slotId]).sort()).toEqual([
      ['autosave', 'auto-1'],
      ['yearly', 'year-1'],
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
    expect(await h.saves.list()).toEqual([]);
    expect(h.idle.pending()).toBe(5);
    h.idle.flush();
    await h.client.settled();
    const autos = (await h.saves.list()).filter((s) => s.kind === 'autosave');
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
    const yearly = (await h.saves.list()).filter((s) => s.kind === 'yearly');
    expect(yearly.map((s) => s.slotId)).toEqual(['year-4', 'year-3']);
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
    loadState(h.client);
    expect(await h.client.quickSave()).toBe(false);
    const first = await h.client.saveToSlot({ slotName: 'Camp' });
    h.client.advance();
    expect(await h.client.quickSave()).toBe(true);
    const slots = (await h.saves.list()).filter((s) => s.kind === 'manual');
    expect(slots).toHaveLength(1);
    expect(first.ok && slots[0]?.slotId === first.value.slotId).toBe(true);
    expect(slots[0]?.summary.week).toBe(2);
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
    expect(save?.ui).toMatchObject({ uiVersion: 1, ironman: false });
    expect(toSaveFile(state, { slotName: 'x', savedAt: 'y' }).summary).toEqual(save?.summary);
  });
});
