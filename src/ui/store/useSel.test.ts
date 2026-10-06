// useSel's two memo forms (DESIGN §13.18 Selectors, D-13.98, S13-19): per state reference, and per declared slices,
// so an unrelated change to state is a cache hit for a declared selector and a recomputation for a plain one; a
// change to a declared slice recomputes; distinct arguments are cached apart, with a bounded number kept.
import { produce } from 'immer';
import { describe, expect, it, vi } from 'vitest';
import { select, type GameState } from '../../engine';
import { freshState } from '../testing/harness';
import { DECLARED_CACHE_ARGS, memoSel, memoSelDeps, withDeps } from './useSel';

function touchInbox(state: GameState): GameState {
  // A change outside finance and clock: Immer keeps the untouched slices reference-equal.
  return produce(state, (d) => {
    d.inbox = { ...d.inbox };
  });
}

function touchFinance(state: GameState): GameState {
  return produce(state, (d) => {
    d.finance = { ...d.finance };
  });
}

describe('memoSel (plain form: per state reference)', () => {
  it('computes once per state and arguments', () => {
    const s0 = freshState();
    const fn = vi.fn((s: GameState, k: string) => `${s.clock.turn}:${k}`);
    expect(memoSel(fn, s0, 'a')).toBe('0:a');
    expect(memoSel(fn, s0, 'a')).toBe('0:a');
    expect(memoSel(fn, s0, 'b')).toBe('0:b');
    expect(fn).toHaveBeenCalledTimes(2);
    memoSel(fn, touchInbox(s0), 'a');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('memoSelDeps (declared form, S13-19)', () => {
  it('survives a change outside the declared slices and recomputes when one changes', () => {
    const s0 = freshState();
    const fn = vi.fn((s: GameState) => select.cashOnHand(s));
    const sel = withDeps(fn, (s) => [s.finance, s.clock]);
    const v0 = memoSelDeps(sel, s0);
    expect(v0).toBe(40_000_000);
    const s1 = touchInbox(s0);
    expect(s1).not.toBe(s0);
    expect(s1.finance).toBe(s0.finance);
    expect(memoSelDeps(sel, s1)).toBe(v0);
    expect(fn).toHaveBeenCalledTimes(1);
    const s2 = touchFinance(s1);
    expect(memoSelDeps(sel, s2)).toBe(v0);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('gives the same value as a cold call (the declared slices cover what it reads)', () => {
    const s0 = freshState();
    const sel = withDeps((s: GameState, mode: 'scoring' | 'appraised') => select.netWorth(s, mode), (s) => [s.finance, s.company]);
    expect(memoSelDeps(sel, touchInbox(s0), 'scoring')).toEqual(select.netWorth(s0, 'scoring'));
  });

  it('caches argument sets apart and keeps a bounded number of them', () => {
    const s0 = freshState();
    const fn = vi.fn((_s: GameState, n: number) => n * 2);
    const sel = withDeps(fn, (s) => [s.clock]);
    for (let i = 0; i <= DECLARED_CACHE_ARGS; i++) memoSelDeps(sel, s0, i);
    expect(fn).toHaveBeenCalledTimes(DECLARED_CACHE_ARGS + 1);
    // The newest are kept; the oldest (0) went first.
    memoSelDeps(sel, s0, DECLARED_CACHE_ARGS);
    expect(fn).toHaveBeenCalledTimes(DECLARED_CACHE_ARGS + 1);
    memoSelDeps(sel, s0, 0);
    expect(fn).toHaveBeenCalledTimes(DECLARED_CACHE_ARGS + 2);
  });
});
