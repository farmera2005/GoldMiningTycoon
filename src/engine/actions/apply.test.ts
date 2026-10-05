import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { hashState } from '../state/hash';
import { newGame } from '../state/newGame';
import { defaultNewGameSetup } from '../state/setup';
import type { GameState } from '../state/types';
import { applyAction, validateAction } from './apply';
import { registerAction } from './registry';
import { asAction, registerTestActions } from './testActions';
import type { Action } from './types';

let unregister: () => void;
beforeAll(() => {
  unregister = registerTestActions();
});
afterAll(() => unregister());

// newGame is deterministic and states are immutable, so one start state serves every test (world generation is slow).
const BASE = newGame(defaultNewGameSetup({ companyName: 'Apply Test' }), 'apply');
const fresh = (): GameState => BASE;

function apply(s: GameState, a: Parameters<typeof asAction>[0]): Extract<ReturnType<typeof applyAction>, { ok: true }> {
  const r = applyAction(s, asAction(a));
  if (!r.ok) throw new Error(`${r.error.code}: ${r.error.message}`);
  return r;
}

describe('applyAction / validateAction (DESIGN §2.2)', () => {
  it('rejects malformed and unknown actions with typed codes and leaves the state untouched', () => {
    const s = fresh();
    const bad = [null, 5, [], {}, { type: 7 }] as unknown as Action[];
    for (const a of bad) expect(validateAction(s, a)).toMatchObject({ ok: false, error: { code: 'ACTION_MALFORMED' } });
    const unknown = { type: 'land/acceptAsk' } as unknown as Action;
    expect(validateAction(s, unknown)).toMatchObject({ ok: false, error: { code: 'ACTION_UNKNOWN' } });
    const r = applyAction(s, unknown);
    expect(r).toMatchObject({ ok: false, error: { code: 'ACTION_UNKNOWN' } });
  });

  it("runs the row's validator before its handler", () => {
    const s = fresh();
    expect(validateAction(s, asAction({ type: 'test/transfer', cents: 0 }))).toMatchObject({
      ok: false,
      error: { code: 'ACTION_MALFORMED' },
    });
    expect(applyAction(s, asAction({ type: 'test/transfer', cents: 40_000_001 }))).toMatchObject({
      ok: false,
      error: { code: 'INSUFFICIENT_FUNDS' },
    });
    expect(validateAction(s, asAction({ type: 'test/transfer', cents: 40_000_000 }))).toEqual({ ok: true });
  });

  it('applies a pure action immutably: new state, old state unchanged, actionSeq + 1, effects reported', () => {
    const s = fresh();
    const before = hashState(s);
    const r = apply(s, { type: 'test/transfer', cents: 1_000_000 });
    expect(hashState(s)).toBe(before);
    expect(r.state).not.toBe(s);
    expect(r.state.clock.actionSeq).toBe(1);
    expect(r.state.finance.books.company.balances['cash.reserve']).toBe(1_000_000);
    expect(r.effects).toEqual([{ kind: 'ledger', txnId: 'txn_000003' }]);
    expect(r.undoable).toBe(true);
    expect(r.state.world).toBe(s.world); // structural sharing
  });

  it('sets undoable false when the handler drew from a stream, or the row reveals or commits (D-2.22)', () => {
    const s = fresh();
    expect(apply(s, { type: 'test/draw', n: 0 }).undoable).toBe(false);
    expect(apply(s, { type: 'test/draw', n: 3 }).undoable).toBe(false);
    expect(apply(s, { type: 'test/reveal' }).undoable).toBe(false);
    expect(apply(s, { type: 'test/commit' }).undoable).toBe(false);
    expect(apply(s, { type: 'test/decide', blocking: false, deadlineInWeeks: 2, cents: 100 }).undoable).toBe(true);
  });

  it('refuses every action once the run has ended (GAME_OVER)', () => {
    const s = fresh();
    const ended: GameState = { ...s, company: { ...s.company, runStatus: 'lost', endReason: 'liquidated' } };
    expect(applyAction(ended, asAction({ type: 'test/reveal' }))).toMatchObject({
      ok: false,
      error: { code: 'GAME_OVER' },
    });
  });

  it('supports marking reveals and commits from the handler when they depend on params', () => {
    const undo = registerAction<{ type: 'test/maybeCommit'; commit: boolean }>({
      type: 'test/maybeCommit',
      ownerSection: 2,
      reveals: false,
      commits: false,
      validate: () => null,
      handle: (_d, a, ctx) => {
        if (a.commit) ctx.markCommits();
      },
    });
    try {
      const s = fresh();
      const yes = applyAction(s, { type: 'test/maybeCommit', commit: true } as unknown as Action);
      const no = applyAction(s, { type: 'test/maybeCommit', commit: false } as unknown as Action);
      expect(yes).toMatchObject({ ok: true, undoable: false });
      expect(no).toMatchObject({ ok: true, undoable: true });
    } finally {
      undo();
    }
  });

  it('refuses duplicate and malformed registry rows', () => {
    expect(() =>
      registerAction({
        type: 'test/transfer',
        ownerSection: 2,
        reveals: false,
        commits: false,
        validate: () => null,
        handle: () => undefined,
      }),
    ).toThrow(/already registered/);
    expect(() =>
      registerAction({
        type: 'NotAType',
        ownerSection: 2,
        reveals: false,
        commits: false,
        validate: () => null,
        handle: () => undefined,
      }),
    ).toThrow(/family\/verb/);
  });
});
