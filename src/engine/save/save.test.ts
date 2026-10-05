import { describe, expect, it, vi } from 'vitest';
import { hashValue } from '../core/hash';
import { hashState } from '../state/hash';
import { newGame } from '../state/newGame';
import { defaultNewGameSetup } from '../state/setup';
import type { GameState } from '../state/types';
import { advanceWeek } from '../turn/advanceWeek';
import fixtureV1 from './fixtures/save-v1.json';
import { CURRENT_SCHEMA_VERSION, MIGRATIONS, MigrationError, migrateSave } from './migrations';
import {
  BUILD_TUNING_HASH,
  createSaveCodec,
  parseSaveFile,
  saveCodec,
  serializeSaveFile,
  toSaveFile,
} from './saveFile';
import type { Migration, VersionedSave } from './types';

// A few tests build fresh worlds (§3 generation can take ~1.5 s per newGame).
vi.setConfig({ testTimeout: 60_000 });

// newGame is deterministic and states are immutable, so start states are built once (world generation is slow).
const starts: Record<string, GameState> = {};
const fresh = (seed = 'save', over = {}): GameState => {
  const key = `${seed}|${JSON.stringify(over)}`;
  starts[key] ??= newGame(defaultNewGameSetup({ companyName: 'Save Test Mining', ...over }), seed);
  return starts[key];
};

function weeks(s: GameState, n: number): GameState {
  let out = s;
  for (let i = 0; i < n; i++) out = advanceWeek(out).state;
  return out;
}

const OPTS = { slotName: 'Slot 1', savedAt: '2026-10-05T12:00:00.000Z' };

describe('SaveFile (DESIGN §2.9)', () => {
  it('builds the envelope with a summary from the selectors', () => {
    const s = weeks(fresh(), 5);
    const save = toSaveFile(s, { ...OPTS, ui: { uiVersion: 1 } });
    expect(save).toMatchObject({
      format: 'gmt-save',
      schemaVersion: CURRENT_SCHEMA_VERSION,
      rulesVersion: s.meta.rulesVersion,
      savedAt: OPTS.savedAt,
      slotName: 'Slot 1',
      summary: { company: 'Save Test Mining', year: 1, week: 6, cash: 40_000_000, netWorth: 52_000_000 },
      ui: { uiVersion: 1 },
    });
    expect(save.state).toBe(s);
    expect('actionLog' in save).toBe(false);
  });

  it('round-trips through JSON to an identical state hash (§13 T11)', () => {
    const s = weeks(fresh(), 12);
    const text = serializeSaveFile(toSaveFile(s, { ...OPTS, ui: { inbox: { msg_000001: { read: true } } } }));
    const back = parseSaveFile(text);
    if (!back.ok) throw new Error(back.error.message);
    expect(hashState(back.save.state)).toBe(hashState(s));
    expect(back.notices).toEqual([]);
    expect(back.save.ui).toEqual({ inbox: { msg_000001: { read: true } } });
    // The loaded game plays on identically.
    expect(hashState(advanceWeek(back.save.state).state)).toBe(hashState(advanceWeek(s).state));
  });

  it('keeps SaveFile.ui out of the state hash', () => {
    const s = fresh();
    const a = parseSaveFile(serializeSaveFile(toSaveFile(s, { ...OPTS, ui: { a: 1 } })));
    const b = parseSaveFile(serializeSaveFile(toSaveFile(s, { ...OPTS, ui: { a: 2, tutorial: { enabled: true } } })));
    if (!a.ok || !b.ok) throw new Error('parse failed');
    expect(hashState(a.save.state)).toBe(hashState(b.save.state));
  });

  it('loads the committed v1 fixture unchanged, and it plays on', () => {
    const back = parseSaveFile(JSON.stringify(fixtureV1));
    if (!back.ok) throw new Error(back.error.message);
    expect(hashState(back.save.state)).toBe(hashValue(fixtureV1.state));
    expect(back.save.state.clock).toMatchObject({ turn: 3, year: 1, week: 4 });
    expect(back.save.slotName).toBe('Fixture Placers LLC');
    // A later build may resolve different tuning; the save keeps its own and only gets a notice.
    expect(back.notices.every((n) => n.code === 'TUNING_DIFFERS')).toBe(true);
    expect(advanceWeek(back.save.state).state.clock.turn).toBe(4);
  });

  it('rejects non-saves, newer schemas and damaged data with typed codes', () => {
    const good = JSON.parse(serializeSaveFile(toSaveFile(fresh(), OPTS))) as Record<string, unknown>;
    expect(parseSaveFile('{not json')).toMatchObject({ ok: false, error: { code: 'SAVE_CORRUPT' } });
    expect(parseSaveFile('{"format":"other"}')).toMatchObject({ ok: false, error: { code: 'SAVE_FORMAT' } });
    expect(parseSaveFile({ ...good, schemaVersion: 0 })).toMatchObject({ ok: false, error: { code: 'SAVE_FORMAT' } });
    expect(parseSaveFile({ ...good, schemaVersion: CURRENT_SCHEMA_VERSION + 1 })).toMatchObject({
      ok: false,
      error: { code: 'SAVE_TOO_NEW' },
    });
    expect(parseSaveFile({ ...good, slotName: 5 })).toMatchObject({ ok: false, error: { code: 'SAVE_CORRUPT' } });

    const tamper = (edit: (state: Record<string, unknown>) => void): unknown => {
      const copy = JSON.parse(JSON.stringify(good)) as { state: Record<string, unknown> };
      edit(copy.state);
      return copy;
    };
    const cases: [string, (st: Record<string, unknown>) => void, RegExp][] = [
      [
        'ledger',
        (st) => ((st as never as GameState).finance.books.company.balances['cash.operating'] = 1 as never),
        /ledger/,
      ],
      [
        'tuning',
        (st) => (((st as never as GameState).meta.tuning as Record<string, unknown>)['game.history.weeklyKeep'] = 1),
        /tuningHash/,
      ],
      ['clock', (st) => ((st as never as GameState).clock.week = 9), /clock/],
      ['ids', (st) => (((st as never as GameState).ids as Record<string, unknown>)['zzz'] = 1), /ids/],
      ['slice', (st) => delete st['inbox'], /inbox/],
      [
        'decisionIds',
        (st) => ((st as never as GameState).inbox.decisionIds as string[]).push('dec_000001'),
        /decisionIds/,
      ],
    ];
    for (const [, edit, message] of cases) {
      const r = parseSaveFile(tamper(edit));
      expect(r.ok).toBe(false);
      if (!r.ok) {
        expect(r.error.code).toBe('SAVE_CORRUPT');
        expect(r.error.message).toMatch(message);
      }
    }
  });

  it('notes TUNING_DIFFERS when a save carries tuning this build would not resolve for its setup', () => {
    const standard = parseSaveFile(serializeSaveFile(toSaveFile(fresh(), OPTS)));
    expect(standard).toMatchObject({ ok: true, notices: [] });
    const hard = parseSaveFile(serializeSaveFile(toSaveFile(fresh('save', { difficulty: 'hard' }), OPTS)));
    expect(hard).toMatchObject({ ok: true, notices: [] });
    const overridden = newGame(defaultNewGameSetup({ companyName: 'X' }), 'o', { 'game.nw.partsResaleFactor': 0.5 });
    const r = parseSaveFile(serializeSaveFile(toSaveFile(overridden, OPTS)));
    expect(r).toMatchObject({
      ok: true,
      notices: [
        { code: 'TUNING_DIFFERS', saveTuningHash: overridden.meta.tuningHash, buildTuningHash: BUILD_TUNING_HASH },
      ],
    });
  });
});

describe('migrations (DESIGN §2.9, D-2.34)', () => {
  it('the P0 build reads schema 1 and ships no migrations yet', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(1);
    expect(MIGRATIONS).toEqual([]);
    expect(saveCodec.currentSchemaVersion).toBe(1);
  });

  // A synthetic v2 build: v2 renamed the envelope's slotName to slotTitle and moved it back, adding a state marker.
  const toV2: Migration = {
    from: 1,
    name: 'v1→v2 synthetic',
    migrate: (save) => {
      const state = save['state'] as Record<string, unknown>;
      return { ...save, schemaVersion: 2, state: { ...state, schemaVersion: 2 } } as VersionedSave;
    },
  };

  it('migrates an older save forward through a registered chain, with a notice naming each step', () => {
    const codec = createSaveCodec({ currentSchemaVersion: 2, migrations: [toV2] });
    const v1 = toSaveFile(weeks(fresh(), 2), OPTS);
    const r = parseSaveFile(serializeSaveFile(v1), codec);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.save.schemaVersion).toBe(2);
    expect(r.save.state.schemaVersion).toBe(2);
    expect(r.notices).toContainEqual({
      code: 'SAVE_MIGRATED',
      fromVersion: 1,
      toVersion: 2,
      migrations: ['v1→v2 synthetic'],
    });
    // The v1 input object is not modified by migration.
    expect(v1.schemaVersion).toBe(1);
  });

  it('reports a broken chain as SAVE_CORRUPT and refuses a step that skips a version', () => {
    const missing = createSaveCodec({ currentSchemaVersion: 3, migrations: [toV2] });
    const text = serializeSaveFile(toSaveFile(fresh(), OPTS));
    expect(parseSaveFile(text, missing)).toMatchObject({ ok: false, error: { code: 'SAVE_CORRUPT' } });
    const skip: Migration = { from: 1, name: 'bad', migrate: (s) => ({ ...s, schemaVersion: 3 }) as VersionedSave };
    expect(() => migrateSave({ format: 'gmt-save', schemaVersion: 1 }, [skip], 3)).toThrow(MigrationError);
    expect(() => migrateSave({ format: 'gmt-save', schemaVersion: 4 }, [], 3)).toThrow(MigrationError);
  });

  it('exposes the codec persistence needs: tuning hash per save and run status', () => {
    const s = fresh();
    expect(saveCodec.tuningHashOf({ state: s })).toBe(saveCodec.currentTuningHash);
    expect(saveCodec.runStatusOf({ state: s })).toBe('active');
    const ended = { ...s, company: { ...s.company, runStatus: 'lost' as const } };
    expect(saveCodec.runStatusOf({ state: ended })).toBe('ended');
    expect(saveCodec.checkState(s)).toBeNull();
    expect(saveCodec.checkState({})).toMatch(/schemaVersion/);
  });
});
