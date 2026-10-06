// `useSel` (DESIGN §13.18): selectors memoized on the GameState reference and their arguments. Engine states are
// immutable and Immer keeps an unchanged state reference-equal, so a cached value is valid exactly as long as the
// state it was computed from; a new week or action gives a new reference and a fresh computation.
import type { GameState } from '../../engine';
import { useUi } from './store';

type Selector<A extends readonly unknown[], R> = (state: GameState, ...args: A) => R;

const caches = new WeakMap<object, WeakMap<GameState, Map<string, unknown>>>();

/** `fn(state, ...args)`, computed once per (fn, state, args). Arguments must be JSON-serializable. */
export function memoSel<A extends readonly unknown[], R>(fn: Selector<A, R>, state: GameState, ...args: A): R {
  let byState = caches.get(fn);
  if (byState === undefined) {
    byState = new WeakMap();
    caches.set(fn, byState);
  }
  let byArgs = byState.get(state);
  if (byArgs === undefined) {
    byArgs = new Map();
    byState.set(state, byArgs);
  }
  const key = JSON.stringify(args);
  if (byArgs.has(key)) return byArgs.get(key) as R;
  const value = fn(state, ...args);
  byArgs.set(key, value);
  return value;
}

/** The selector's value for the loaded game, or null when no game is loaded. */
export function useSel<A extends readonly unknown[], R>(fn: Selector<A, R>, ...args: A): R | null {
  const state = useUi((s) => s.game.state);
  return state === null ? null : memoSel(fn, state, ...args);
}
