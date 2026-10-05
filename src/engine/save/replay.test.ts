import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { applyAction } from '../actions/apply';
import { asAction, registerTestActions } from '../actions/testActions';
import type { LoggedAction } from '../actions/types';
import { hashState } from '../state/hash';
import { newGame } from '../state/newGame';
import { defaultNewGameSetup } from '../state/setup';
import { advanceWeek } from '../turn/advanceWeek';
import { REPLAY_FORMAT, ReplayError, replayLog, type ReplayLog } from './replay';

// Every replay builds a fresh world (§3 generation can take ~1.5 s per newGame).
vi.setConfig({ testTimeout: 60_000 });

let unregister: () => void;
beforeAll(() => {
  unregister = registerTestActions();
});
afterAll(() => unregister());

const setup = defaultNewGameSetup({ companyName: 'Replay Test' });
const log = (actions: LoggedAction[], weeks = 6): ReplayLog => ({
  format: REPLAY_FORMAT,
  version: 1,
  seed: 'replay',
  setup,
  weeks,
  actions,
});
const entry = (turn: number, actionSeq: number, a: Parameters<typeof asAction>[0]): LoggedAction => ({
  turn,
  actionSeq,
  action: asAction(a),
});

describe('replayLog (DESIGN §2.3 item 5)', () => {
  it('rebuilds the game played by hand: same per-week hashes', () => {
    const actions = [
      entry(0, 1, { type: 'test/transfer', cents: 1_000 }),
      entry(2, 2, { type: 'test/decide', blocking: true, deadlineInWeeks: 1, cents: 50 }),
      entry(2, 3, { type: 'decision/answer', decisionId: 'dec_000001', optionId: 'a' } as never),
      entry(6, 4, { type: 'test/draw', n: 2 }),
    ];
    const r = replayLog(log(actions));
    // By hand.
    let s = newGame(setup, 'replay');
    const hand: string[] = [];
    const applyAll = (turn: number): void => {
      for (const e of actions.filter((x) => x.turn === turn)) {
        const res = applyAction(s, e.action);
        if (!res.ok) throw new Error(res.error.code);
        s = res.state;
      }
    };
    applyAll(0);
    hand.push(hashState(s));
    for (let t = 1; t <= 6; t++) {
      s = advanceWeek(s).state;
      applyAll(t);
      hand.push(hashState(s));
    }
    expect(r.hashes.map((h) => h.turn)).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(r.hashes.map((h) => h.hash)).toEqual(hand);
    expect(r.state.clock.actionSeq).toBe(4);
    expect(replayLog(log(actions)).hashes).toEqual(r.hashes);
  });

  it('gives identical hashes with explain on (T18) and reports each week through onWeek', () => {
    const seen: number[] = [];
    const on = replayLog(log([]), { explain: true, onWeek: (st) => seen.push(st.clock.turn) });
    expect(on.hashes).toEqual(replayLog(log([])).hashes);
    expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('refuses logs that drift: wrong actionSeq, a rejected action, unreachable or unordered entries', () => {
    expect(() => replayLog(log([entry(0, 2, { type: 'test/reveal' })]))).toThrow(ReplayError);
    expect(() => replayLog(log([entry(0, 1, { type: 'test/transfer', cents: 99_000_000_000 })]))).toThrow(
      /INSUFFICIENT_FUNDS/,
    );
    expect(() => replayLog(log([entry(7, 1, { type: 'test/reveal' })]))).toThrow(ReplayError);
    expect(() => replayLog(log([entry(2, 1, { type: 'test/reveal' }), entry(1, 2, { type: 'test/reveal' })]))).toThrow(
      ReplayError,
    );
    expect(() => replayLog({ ...log([]), format: 'other' as never })).toThrow(ReplayError);
  });
});
