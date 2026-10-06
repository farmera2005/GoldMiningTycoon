import { describe, expect, it, vi } from 'vitest';
import { hashValue } from '../core/hash';
import { hashState } from '../state/hash';
import { newGame } from '../state/newGame';
import { defaultNewGameSetup } from '../state/setup';
import type { GameState } from '../state/types';
import { advanceWeek } from '../turn/advanceWeek';
import fixtureV1 from './fixtures/save-v1.json';
import {
  CURRENT_SCHEMA_VERSION,
  MIGRATIONS,
  MIN_SUPPORTED_SCHEMA_VERSION,
  MigrationError,
  migrateSave,
} from './migrations';
import { resolveTuning, tuningHashOf } from '../state/tuning';
import {
  BUILD_TUNING_HASH,
  createSaveCodec,
  parseSaveFile,
  saveCodec,
  saveTooOldMessage,
  serializeSaveFile,
  toSaveFile,
  TUNING_MATCHES_BUILD,
} from './saveFile';
import { SLICE_VALIDATORS, idsMirrorProblem, stateProblem } from './validate';
import { SLICE_KEYS } from '../state/types';
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

  it('refuses the committed v1 (P0) fixture with SAVE_TOO_OLD and the 13.16 message (s02 #7)', () => {
    const back = parseSaveFile(JSON.stringify(fixtureV1));
    expect(back).toEqual({
      ok: false,
      error: { code: 'SAVE_TOO_OLD', message: saveTooOldMessage(1, MIN_SUPPORTED_SCHEMA_VERSION) },
    });
    expect(saveTooOldMessage(1, 2)).toBe(
      'This save was made by an earlier version of the game (schema 1); this build reads schema 2 and later.',
    );
    // Persistence migrates any older save through the codec: a too-old one fails there with the same message.
    expect(() => saveCodec.migrate(fixtureV1 as unknown as VersionedSave)).toThrow(saveTooOldMessage(1, 2));
    // A codec that still reads schema 1 (a P0 build) loads the fixture unchanged: the refusal is the build's policy.
    const p0 = createSaveCodec({ currentSchemaVersion: 1, migrations: [] });
    const old = parseSaveFile(JSON.stringify(fixtureV1), p0);
    if (!old.ok) throw new Error(old.error.message);
    expect(hashState(old.save.state)).toBe(hashValue(fixtureV1.state));
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
    // A hard save's tuning differs from the default game's (§1 1.11), yet it is what this build resolves for it.
    const hardGame = fresh('save', { difficulty: 'hard' });
    expect(hardGame.meta.tuningHash).not.toBe(BUILD_TUNING_HASH);
    const hard = parseSaveFile(serializeSaveFile(toSaveFile(hardGame, OPTS)));
    expect(hard).toMatchObject({ ok: true, notices: [] });
    expect(saveCodec.tuningHashOf({ state: hardGame })).toBe(saveCodec.currentTuningHash);
    const overridden = newGame(defaultNewGameSetup({ companyName: 'X' }), 'o', { 'game.nw.partsResaleFactor': 0.5 });
    const r = parseSaveFile(serializeSaveFile(toSaveFile(overridden, OPTS)));
    expect(r).toMatchObject({
      ok: true,
      notices: [
        { code: 'TUNING_DIFFERS', saveTuningHash: overridden.meta.tuningHash, buildTuningHash: BUILD_TUNING_HASH },
      ],
    });
  });

  // Persistence decides the notice with one comparison (src/persistence: tuningHashOf(save) !== currentTuningHash);
  // the engine cannot import persistence (§2.1), so its rule is restated here against the same codec.
  const persistenceSeesDifference = (s: GameState): boolean => {
    const hash = saveCodec.tuningHashOf({ state: s });
    return hash !== null && hash !== saveCodec.currentTuningHash;
  };

  it("notes TUNING_DIFFERS when the save's hash equals the default game's but not its own setup's (D-2.35)", () => {
    // Setup opening spot 2500, then a simulator override back to the base 4200: the stored tuning is the default
    // game's, yet this build resolves the save's own setup (spot 2500) to something else.
    const setup2500 = defaultNewGameSetup({
      companyName: 'Spot Test',
      world: { ...defaultNewGameSetup({ companyName: 'x' }).world, openingSpotUsdPerFineOz: 2500 },
    });
    const game = newGame(setup2500, 'spot', { 'market.openingSpotUsdPerFineOz': 4200 });
    expect(game.meta.tuningHash).toBe(BUILD_TUNING_HASH);
    const setupHash = tuningHashOf(resolveTuning(setup2500));
    expect(setupHash).not.toBe(BUILD_TUNING_HASH);
    const r = parseSaveFile(serializeSaveFile(toSaveFile(game, OPTS)));
    expect(r).toMatchObject({
      ok: true,
      notices: [{ code: 'TUNING_DIFFERS', saveTuningHash: BUILD_TUNING_HASH, buildTuningHash: setupHash }],
    });
    expect(saveCodec.tuningDiffers({ state: game })).toEqual({
      saveTuningHash: BUILD_TUNING_HASH,
      buildTuningHash: setupHash,
    });
    expect(persistenceSeesDifference(game)).toBe(true);
  });

  it('notes TUNING_DIFFERS for a hand-edited setup whose tuning no longer matches the stored tuning', () => {
    const s = fresh();
    const edited = {
      ...s,
      meta: { ...s.meta, setup: { ...s.meta.setup, world: { ...s.meta.setup.world, startCalendarYear: 2031 } } },
    };
    const editedHash = tuningHashOf(resolveTuning(edited.meta.setup));
    const r = parseSaveFile(serializeSaveFile(toSaveFile(edited, OPTS)));
    expect(r).toMatchObject({
      ok: true,
      notices: [{ code: 'TUNING_DIFFERS', saveTuningHash: s.meta.tuningHash, buildTuningHash: editedHash }],
    });
    expect(persistenceSeesDifference(edited)).toBe(true);
  });

  it('notes TUNING_DIFFERS, naming the default-game hash, when the save’s setup no longer resolves', () => {
    const s = fresh();
    const broken = { ...s, meta: { ...s.meta, setup: { ...s.meta.setup, world: null as never } } };
    expect(saveCodec.tuningDiffers({ state: broken })).toEqual({
      saveTuningHash: s.meta.tuningHash,
      buildTuningHash: BUILD_TUNING_HASH,
    });
    expect(persistenceSeesDifference(broken)).toBe(true);
  });

  it('gives persistence a token no tuning hash can equal, and no difference for a matching save', () => {
    expect(saveCodec.currentTuningHash).toBe(TUNING_MATCHES_BUILD);
    expect(TUNING_MATCHES_BUILD).not.toMatch(/^[0-9a-f]{16}$/);
    expect(BUILD_TUNING_HASH).toMatch(/^[0-9a-f]{16}$/);
    expect(saveCodec.tuningDiffers({ state: fresh() })).toBeNull();
    expect(persistenceSeesDifference(fresh())).toBe(false);
    expect(saveCodec.tuningHashOf({ state: {} })).toBeNull();
    expect(saveCodec.tuningDiffers({ state: {} })).toBeNull();
  });
});

describe('migrations (DESIGN §2.9, D-2.34)', () => {
  it('the P1 build writes schema 2, reads schema 2 and later, and ships no migrations inside P1 (s02 #7)', () => {
    expect(CURRENT_SCHEMA_VERSION).toBe(2);
    expect(MIN_SUPPORTED_SCHEMA_VERSION).toBe(2);
    expect(MIGRATIONS).toEqual([]);
    expect(saveCodec.currentSchemaVersion).toBe(2);
    expect(saveCodec.minSupportedSchemaVersion).toBe(2);
    expect(fresh().schemaVersion).toBe(2);
  });

  it('refuses any schema older than the oldest supported, before migrating', () => {
    const good = JSON.parse(serializeSaveFile(toSaveFile(fresh(), OPTS))) as Record<string, unknown>;
    expect(parseSaveFile({ ...good, schemaVersion: 1 })).toMatchObject({ ok: false, error: { code: 'SAVE_TOO_OLD' } });
    // A custom codec defaults to reading every version a chain can reach.
    expect(createSaveCodec({ currentSchemaVersion: 2, migrations: [] }).minSupportedSchemaVersion).toBe(1);
  });

  // A synthetic v3 build: its v2 → v3 step bumps the schema and adds nothing else.
  const toV3: Migration = {
    from: 2,
    name: 'v2→v3 synthetic',
    migrate: (save) => {
      const state = save['state'] as Record<string, unknown>;
      return { ...save, schemaVersion: 3, state: { ...state, schemaVersion: 3 } } as VersionedSave;
    },
  };

  it('migrates an older save forward through a registered chain, with a notice naming each step', () => {
    const codec = createSaveCodec({ currentSchemaVersion: 3, migrations: [toV3], minSupportedSchemaVersion: 2 });
    const v2 = toSaveFile(weeks(fresh(), 2), OPTS);
    const r = parseSaveFile(serializeSaveFile(v2), codec);
    if (!r.ok) throw new Error(r.error.message);
    expect(r.save.schemaVersion).toBe(3);
    expect(r.save.state.schemaVersion).toBe(3);
    expect(r.notices).toContainEqual({
      code: 'SAVE_MIGRATED',
      fromVersion: 2,
      toVersion: 3,
      migrations: ['v2→v3 synthetic'],
    });
    // The v2 input object is not modified by migration.
    expect(v2.schemaVersion).toBe(2);
  });

  it('reports a broken chain as SAVE_CORRUPT and refuses a step that skips a version', () => {
    const missing = createSaveCodec({ currentSchemaVersion: 4, migrations: [toV3] });
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

describe('slice validation at load (DESIGN §2.9 D-2.43; P1 contract §1.7)', () => {
  it('has one owner check per slice, and a fresh state passes every one', () => {
    expect(Object.keys(SLICE_VALIDATORS).sort()).toEqual([...SLICE_KEYS].sort());
    const s = fresh() as unknown as Record<string, Record<string, unknown>>;
    for (const key of SLICE_KEYS) {
      expect(idsMirrorProblem(key, s[key] as Record<string, unknown>), key).toBeNull();
      expect(SLICE_VALIDATORS[key](s[key] as Record<string, unknown>), key).toBeNull();
    }
    expect(stateProblem(fresh(), CURRENT_SCHEMA_VERSION)).toBeNull();
  });

  it('checks every top-level …Ids array against its Record (xs or x), in any slice', () => {
    const sorted = { claims: { clm_000001: 1, clm_000002: 2 }, claimIds: ['clm_000001', 'clm_000002'] };
    expect(idsMirrorProblem('world', sorted)).toBeNull();
    expect(idsMirrorProblem('world', { ...sorted, claimIds: ['clm_000002', 'clm_000001'] })).toMatch(/claimIds/);
    expect(idsMirrorProblem('world', { ...sorted, claimIds: ['clm_000001'] })).toMatch(/claimIds/);
    expect(idsMirrorProblem('world', { ...sorted, claimIds: ['clm_000001', 2] })).toMatch(/non-string/);
    // `x` as well as `xs`, and an ordered subset with no sibling Record is the owner's business.
    expect(idsMirrorProblem('ops', { claim: { clm_000001: 1 }, claimIds: ['clm_000001'] })).toBeNull();
    expect(idsMirrorProblem('world', { ...sorted, familyRunClaimIds: ['clm_000002', 'clm_000001'] })).toBeNull();
    expect(idsMirrorProblem('land', { listings: {}, listingIds: ['lst_000001'] })).toMatch(/listingIds/);
  });

  it('refuses a save whose world ids no longer mirror their Record', () => {
    const good = JSON.parse(serializeSaveFile(toSaveFile(fresh(), OPTS))) as { state: GameState };
    (good.state.world.claimIds as unknown as string[]).reverse();
    expect(parseSaveFile(good)).toMatchObject({ ok: false, error: { code: 'SAVE_CORRUPT' } });
  });
});
