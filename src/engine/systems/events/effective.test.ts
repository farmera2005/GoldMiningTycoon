import { afterEach, describe, expect, it } from 'vitest';
import type { DistrictId, EvtId } from '../../core/ids';
import { clearAllMemos, setMemoEnabled } from '../../core/memo';
import { produceState } from '../../state/immutability';
import { newGame } from '../../state/newGame';
import { defaultNewGameSetup } from '../../state/setup';
import type { GameState } from '../../state/types';
import { EffectiveError, effective } from './effective';
import { ModifierError, addModifier, removeModifier } from './modifiers';
import type { EffectModifier } from './types';

const KEY = 'game.startCompanyCashMult';
const base = newGame(defaultNewGameSetup({ companyName: 'Effective Test' }), 'eff');
const D1 = 'dst_000001' as DistrictId;

function mod(id: string, over: Partial<EffectModifier> & Pick<EffectModifier, 'op' | 'value'>): EffectModifier {
  return {
    id,
    target: KEY,
    scope: {},
    startTurn: 0,
    untilTurn: Number.MAX_SAFE_INTEGER,
    visibleFromTurn: 0,
    sourceEvtId: id.split('/')[0] as EvtId,
    ...over,
  };
}

function withMods(s: GameState, mods: EffectModifier[]): GameState {
  return produceState(s, (d) => {
    for (const m of mods) addModifier(d.events, m);
  });
}

afterEach(() => setMemoEnabled(true));

describe('effective(state, key, q) (DESIGN §2.10, §12 12.3)', () => {
  it('returns the resolved tuning value when no modifier targets the key', () => {
    expect(effective(base, KEY, {})).toBe(1);
    expect(effective(base, 'game.history.weeklyKeep', {})).toBe(156);
  });

  it('refuses keys that are neither hooks nor numeric tuning keys', () => {
    expect(() => effective(base, 'fleet.noSuchHook', {})).toThrow(EffectiveError);
  });

  it('applies the game modifiers by scope: base × Πmul + Σadd, or the latest set', () => {
    const s = withMods(base, [
      mod('evt_000001/m0', { op: 'mul', value: 1.25 }),
      mod('evt_000002/m0', { op: 'mul', value: 0.8, scope: { districtId: D1 } }),
      mod('evt_000003/m0', { op: 'add', value: 0.5 }),
    ]);
    expect(effective(s, KEY, {})).toBe(1 * 1.25 + 0.5);
    expect(effective(s, KEY, { districtId: D1 })).toBeCloseTo(1 * 1.25 * 0.8 + 0.5, 15);
    const set = withMods(s, [mod('evt_000004/m0', { op: 'set', value: 0.3, startTurn: 0 })]);
    expect(effective(set, KEY, { districtId: D1 })).toBe(0.3);
  });

  it('indexes modifiers by target in id order, bumps the version, and reverts on removal', () => {
    const s = withMods(base, [
      mod('evt_000010/m1', { op: 'mul', value: 2 }),
      mod('evt_000002/m0', { op: 'mul', value: 3 }),
    ]);
    expect(s.events.modifierIdsByTarget[KEY]).toEqual(['evt_000002/m0', 'evt_000010/m1']);
    expect(s.events.modifiersVersion).toBe(2);
    // Π mul = 6 is clamped to the default product bound [0, 5] (§12 12.3).
    expect(effective(s, KEY, {})).toBe(5);
    const removed = produceState(s, (d) => {
      expect(removeModifier(d.events, 'evt_000010/m1')).toBe(true);
      expect(removeModifier(d.events, 'evt_000010/m1')).toBe(false);
    });
    expect(removed.events.modifiersVersion).toBe(3);
    expect(effective(removed, KEY, {})).toBe(3);
    const none = produceState(removed, (d) => void removeModifier(d.events, 'evt_000002/m0'));
    expect(none.events.modifierIdsByTarget[KEY]).toBeUndefined();
    expect(effective(none, KEY, {})).toBe(1);
  });

  it('rejects duplicate ids and malformed modifiers', () => {
    expect(() =>
      withMods(base, [mod('evt_000001/m0', { op: 'mul', value: 2 }), mod('evt_000001/m0', { op: 'mul', value: 2 })]),
    ).toThrow(ModifierError);
    expect(() => withMods(base, [mod('evt_000001/m0', { op: 'mul', value: Number.NaN })])).toThrow(ModifierError);
    expect(() => withMods(base, [mod('evt_000001/m0', { op: 'mul', value: 2, startTurn: 5, untilTurn: 4 })])).toThrow(
      ModifierError,
    );
  });

  it('memo is transparent: undone branches with the same version number keep their own values', () => {
    // Two branches from one state, each adding a different modifier: same turn, same modifiersVersion (1), same key and
    // query, different content (an undo followed by a different action).
    const a = withMods(base, [mod('evt_000001/m0', { op: 'mul', value: 2 })]);
    const b = withMods(base, [mod('evt_000001/m0', { op: 'mul', value: 3 })]);
    expect(a.events.modifiersVersion).toBe(b.events.modifiersVersion);
    expect(effective(a, KEY, {})).toBe(2);
    expect(effective(b, KEY, {})).toBe(3);
    expect(effective(a, KEY, {})).toBe(2);
  });

  it('gives identical values with memos enabled, disabled and cleared', () => {
    const s = withMods(base, [
      mod('evt_000001/m0', { op: 'mul', value: 1.1 }),
      mod('evt_000002/m0', { op: 'add', value: 0.2 }),
    ]);
    const queries = [{}, { districtId: D1 }];
    const read = (): number[] => queries.map((q) => effective(s, KEY, q));
    const enabled = read();
    expect(read()).toEqual(enabled);
    clearAllMemos();
    expect(read()).toEqual(enabled);
    setMemoEnabled(false);
    expect(read()).toEqual(enabled);
  });
});
