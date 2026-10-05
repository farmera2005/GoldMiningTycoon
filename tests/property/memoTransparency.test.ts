// Memo transparency (DESIGN §2.3 item 6, §2.14): caches disabled, enabled, and cleared every week give identical state
// hashes and identical derived values. P0's memoized value is effective(); the run carries modifiers that start and
// expire mid-run, so the active set changes while the caches are warm.
import { afterEach, describe, expect, it } from 'vitest';
import { advanceWeek, effective, hashState, newGame, type EffectModifier, type GameState } from '../../src/engine';
import { clearAllMemos, setMemoEnabled } from '../../src/engine/core/memo';
import type { DistrictId, EvtId } from '../../src/engine/core/ids';
import { produceState } from '../../src/engine/state/immutability';
import { addModifier } from '../../src/engine/systems/events/modifiers';
import { P0_SETUP, WORLD_TIMEOUT_MS } from './helpers';

type Mode = 'enabled' | 'disabled' | 'clearedWeekly';
const D1 = 'dst_000001' as DistrictId;
const KEYS = ['game.startCompanyCashMult', 'game.nw.partsResaleFactor'] as const;
const QUERIES = [{}, { districtId: D1 }];

function mod(id: string, target: string, over: Partial<EffectModifier>): EffectModifier {
  return {
    id,
    target,
    op: 'mul',
    value: 1,
    scope: {},
    startTurn: 0,
    untilTurn: Number.MAX_SAFE_INTEGER,
    visibleFromTurn: 0,
    sourceEvtId: id.split('/')[0] as EvtId,
    ...over,
  };
}

function seeded(seed: string): GameState {
  // Built fresh in each mode, so any cache newGame itself uses (e.g. §3's truth decode) runs under that mode too.
  return produceState(newGame(P0_SETUP, seed), (d) => {
    addModifier(d.events, mod('evt_000001/m0', KEYS[0], { value: 1.2, startTurn: 3, untilTurn: 20 }));
    addModifier(d.events, mod('evt_000002/m0', KEYS[0], { op: 'add', value: 0.05, scope: { districtId: D1 } }));
    addModifier(d.events, mod('evt_000003/m0', KEYS[1], { op: 'set', value: 0.4, startTurn: 10, untilTurn: 12 }));
  });
}

function run(seed: string, mode: Mode): { hashes: string[]; values: number[] } {
  setMemoEnabled(mode !== 'disabled');
  let s = seeded(seed);
  const hashes: string[] = [];
  const values: number[] = [];
  for (let w = 0; w < 30; w++) {
    s = advanceWeek(s).state;
    for (const key of KEYS) for (const q of QUERIES) values.push(effective(s, key, q), effective(s, key, q));
    hashes.push(hashState(s));
    if (mode === 'clearedWeekly') clearAllMemos();
  }
  return { hashes, values };
}

afterEach(() => setMemoEnabled(true));

describe('memo transparency', () => {
  it.each(['memo-a', 'memo-b'])(
    'seed %s: enabled, disabled and cleared-weekly runs agree',
    (seed) => {
      const enabled = run(seed, 'enabled');
      const disabled = run(seed, 'disabled');
      const cleared = run(seed, 'clearedWeekly');
      expect(disabled).toEqual(enabled);
      expect(cleared).toEqual(enabled);
      // The modifiers really act: the value moves when evt_000001 starts and when it expires.
      expect(new Set(enabled.values).size).toBeGreaterThan(2);
    },
    WORLD_TIMEOUT_MS,
  );
});
