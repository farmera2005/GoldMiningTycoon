// §12 events slice of GameState (DESIGN §12 12.1 `EventsSlice`). P0 carries the modifier store that effective() reads
// (D-2.28): the modifiers, their per-target index and the version counter in effective()'s memo key. Instances,
// history, cooldowns, the director, scheduled effects and preparations arrive with §12 (P3/P5).
import type { EffectModifier, HookKey } from '../../core/effective';

export type { EffectModifier, EffectQuery, EffectScope, HookKey } from '../../core/effective';

export interface EventsSlice {
  modifiers: Record<string, EffectModifier>;
  /** Modifier ids per target hook, ascending compareIds order; mirrors `modifiers` exactly. */
  modifierIdsByTarget: Record<HookKey, string[]>;
  /** Bumps on every add or remove (§12 12.1); part of effective()'s memo key. */
  modifiersVersion: number;
}

export function emptyEventsSlice(): EventsSlice {
  return { modifiers: {}, modifierIdsByTarget: {}, modifiersVersion: 0 };
}
