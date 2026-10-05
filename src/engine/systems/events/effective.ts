// effective(state, key, q) (DESIGN §2.10 = §12 12.3, D-2.28): every value an event may change is read through it.
// Core holds the pure resolution (core/effective.ts); this wrapper supplies the base (the game's resolved tuning, or
// the hook's neutral value), the hook's bounds and the game's modifiers, and memoizes the result.
//
// Memo (§2.3 item 6). DESIGN keys it on (turn, events.modifiersVersion, key, q). A version counter alone cannot tell
// two games apart (the simulator plays many in one process) nor an undone branch from a redone one (undo restores
// the version number while a different action may add different modifiers), so the cache is scoped to the identity of
// the immutable `events.modifiers` Record: Immer gives it a new identity whenever a modifier changes and keeps it
// when nothing does. Within that scope the key is (tuningHash, turn, modifiersVersion, key, q). A hook with no
// modifiers returns its base without touching the cache, so a P1 game (no events) never grows it.
import { hookRegistry, type HookDef } from '../../../data/events/hooks';
import { createWeakMemo } from '../../core/memo';
import {
  effectQueryKey,
  effectiveValue,
  type EffectModifier,
  type EffectQuery,
  type HookKey,
} from '../../core/effective';
import type { GameState } from '../../state/types';

export class EffectiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EffectiveError';
  }
}

const hooksByKey: Readonly<Record<string, HookDef>> = (() => {
  const out: Record<string, HookDef> = {};
  for (const h of hookRegistry) out[h.key] = h;
  return out;
})();

const hasOwn = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);

/** The registered hook for a key, or undefined. */
export function hookFor(key: HookKey): HookDef | undefined {
  return hasOwn(hooksByKey, key) ? hooksByKey[key] : undefined;
}

/** Base value: TuningResolved[key] for a tuning key (difficulty and scenario already applied), else hook.neutral. */
export function effectiveBase(state: GameState, key: HookKey): number {
  const tuning = state.meta.tuning as Readonly<Record<string, unknown>>;
  if (hasOwn(tuning, key)) {
    const v = tuning[key];
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      throw new EffectiveError(`effective: tuning key ${key} is not a finite number`);
    }
    return v;
  }
  const hook = hookFor(key);
  if (hook === undefined) throw new EffectiveError(`effective: ${key} is neither a registered hook nor a tuning key`);
  return hook.neutral;
}

/** Cache per modifiers-Record identity (see the header): resolved numbers, emptied when it reaches MAX_SCOPED. */
interface ScopedCache {
  size: number;
  values: Record<string, number>;
}
const MAX_SCOPED = 50_000;
const effectiveMemo = createWeakMemo<Readonly<Record<string, EffectModifier>>, ScopedCache>('effective');

function modifiersOn(state: GameState, key: HookKey): EffectModifier[] {
  const ids = state.events.modifierIdsByTarget[key];
  if (ids === undefined || ids.length === 0) return [];
  const out: EffectModifier[] = [];
  for (const id of ids) {
    const m = state.events.modifiers[id];
    if (m !== undefined) out.push(m);
  }
  return out;
}

/** The effective value of a hook or tuning key for the query's scope, at the state's current turn. */
export function effective(state: GameState, key: HookKey, q: EffectQuery): number {
  const base = effectiveBase(state, key);
  const mods = modifiersOn(state, key);
  if (mods.length === 0) return base;
  const scoped = effectiveMemo.getOrCompute(state.events.modifiers, () => ({ size: 0, values: {} }));
  const memoKey = [
    state.meta.tuningHash,
    String(state.clock.turn),
    String(state.events.modifiersVersion),
    key,
    effectQueryKey(q),
  ].join('\u001e');
  const hit = scoped.values[memoKey];
  if (hit !== undefined) return hit;
  const value = effectiveValue(base, hookFor(key), mods, state.clock.turn, q);
  if (scoped.size >= MAX_SCOPED) {
    scoped.values = {};
    scoped.size = 0;
  }
  scoped.values[memoKey] = value;
  scoped.size += 1;
  return value;
}
