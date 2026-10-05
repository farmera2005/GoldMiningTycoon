// The engine's saveCodec drives browser persistence (DESIGN §2.9, §13 13.16): persistence never imports the engine,
// so this checks the two meet — the codec type-checks as persistence's SaveCodec, and a save written by the engine
// survives persistence's export → import with an identical state hash (§13 T11).
import { describe, expect, it } from 'vitest';
import {
  advanceWeek,
  defaultNewGameSetup,
  hashState,
  newGame,
  saveCodec,
  toSaveFile,
  type GameState,
} from '../../src/engine';
import { exportSave, readSave, type SaveCodec, type SaveEnvelope } from '../../src/persistence';

const codec: SaveCodec = saveCodec;

// Built once: newGame is deterministic and states are immutable (world generation is slow).
const GAME: GameState = (() => {
  let s = newGame(defaultNewGameSetup({ companyName: 'Codec Placers' }), 'codec');
  for (let i = 0; i < 9; i++) s = advanceWeek(s).state;
  return s;
})();
const game = (): GameState => GAME;

describe('engine saveCodec × persistence', () => {
  it('exports and imports (gzip and plain) with an identical state and ui', () => {
    const s = game();
    const save = toSaveFile(s, { slotName: 'Codec slot', savedAt: '2026-10-05T10:00:00.000Z', ui: { uiVersion: 1 } });
    for (const gzip of [true, false]) {
      const file = exportSave(save as unknown as SaveEnvelope, { gzip });
      const loaded = readSave(file.bytes, codec);
      if (!loaded.ok) throw new Error(loaded.error.message);
      expect(hashState(loaded.value.save.state as GameState)).toBe(hashState(s));
      expect(loaded.value.save.ui).toEqual({ uiVersion: 1 });
      expect(loaded.value.notices).toEqual([]);
    }
  });

  it('reports a newer schema as SAVE_TOO_NEW and damaged state as SAVE_CORRUPT', () => {
    const save = toSaveFile(game(), { slotName: 's', savedAt: '' });
    const newer = JSON.stringify({ ...save, schemaVersion: codec.currentSchemaVersion + 1 });
    expect(readSave(newer, codec)).toMatchObject({ ok: false, error: { code: 'SAVE_TOO_NEW' } });
    const damaged = JSON.stringify({ ...save, state: { ...save.state, clock: { turn: -1 } } });
    expect(readSave(damaged, codec)).toMatchObject({ ok: false, error: { code: 'SAVE_CORRUPT' } });
  });

  it('flags tuning that differs from the build, and marks ended runs read-only', () => {
    const custom = newGame(defaultNewGameSetup({ companyName: 'Codec' }), 'c', { 'game.nw.partsResaleFactor': 0.7 });
    const loaded = readSave(JSON.stringify(toSaveFile(custom, { slotName: 's', savedAt: '' })), codec);
    expect(loaded).toMatchObject({ ok: true, value: { notices: [{ code: 'TUNING_DIFFERS' }] } });
    const s = game();
    const ended = { ...s, company: { ...s.company, runStatus: 'lost' as const } };
    expect(codec.runStatusOf?.(toSaveFile(ended, { slotName: 's', savedAt: '' }) as unknown as SaveEnvelope)).toBe(
      'ended',
    );
  });
});
