// `useSel` (DESIGN §13.18 Selectors, D-13.98; S13-19): selectors memoized per selector and arguments. Two forms:
//  - a plain selector is cached on the GameState reference: engine states are immutable and Immer keeps an unchanged
//    state reference-equal, so a cached value is valid exactly as long as its state;
//  - a declared selector (`withDeps(fn, s => [s.finance, s.clock])`) is cached on the slices it declares, so a week
//    or an action that leaves those slices untouched (Immer's structural sharing keeps them reference-equal) is a
//    cache hit. Heavy selectors (forecast, statements, the dashboard's tiles) take this form; the declared slices must
//    cover everything the selector reads, which each declaration's test checks against a cold call.
// Owners' engine memos (`engine/core/memo.ts`, §11 D-11.93) still apply underneath; this layer only saves the call.
import type { GameState } from '../../engine';
import { useUi } from './store';

type Selector<A extends readonly unknown[], R> = (state: GameState, ...args: A) => R;

/** A selector with the state slices it depends on (S13-19's declared-deps form). */
export interface DeclaredSelector<A extends readonly unknown[], R> {
  readonly fn: Selector<A, R>;
  /** The values the result depends on, compared by identity (slices, or fields of them). */
  readonly deps: (state: GameState) => readonly unknown[];
}

export function withDeps<A extends readonly unknown[], R>(
  fn: Selector<A, R>,
  deps: (state: GameState) => readonly unknown[],
): DeclaredSelector<A, R> {
  return { fn, deps };
}

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

interface DepsEntry {
  readonly deps: readonly unknown[];
  readonly value: unknown;
}

/** Distinct argument sets kept per declared selector; the oldest goes first (a screen uses a handful). */
export const DECLARED_CACHE_ARGS = 64;

const declaredCaches = new WeakMap<object, Map<string, DepsEntry>>();

function sameDeps(a: readonly unknown[], b: readonly unknown[]): boolean {
  return a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
}

/** A declared selector's value, recomputed only when one of its declared dependencies changed identity. */
export function memoSelDeps<A extends readonly unknown[], R>(
  sel: DeclaredSelector<A, R>,
  state: GameState,
  ...args: A
): R {
  let byArgs = declaredCaches.get(sel);
  if (byArgs === undefined) {
    byArgs = new Map();
    declaredCaches.set(sel, byArgs);
  }
  const key = JSON.stringify(args);
  const deps = sel.deps(state);
  const hit = byArgs.get(key);
  if (hit !== undefined && sameDeps(hit.deps, deps)) return hit.value as R;
  const value = sel.fn(state, ...args);
  byArgs.delete(key);
  byArgs.set(key, { deps, value });
  if (byArgs.size > DECLARED_CACHE_ARGS) {
    const oldest = byArgs.keys().next().value;
    if (oldest !== undefined) byArgs.delete(oldest);
  }
  return value;
}

function isDeclared<A extends readonly unknown[], R>(
  sel: Selector<A, R> | DeclaredSelector<A, R>,
): sel is DeclaredSelector<A, R> {
  return typeof sel === 'object';
}

/** The selector's value for the loaded game, or null when no game is loaded. */
export function useSel<A extends readonly unknown[], R>(
  sel: Selector<A, R> | DeclaredSelector<A, R>,
  ...args: A
): R | null {
  const state = useUi((s) => s.game.state);
  if (state === null) return null;
  return isDeclared(sel) ? memoSelDeps(sel, state, ...args) : memoSel(sel, state, ...args);
}
