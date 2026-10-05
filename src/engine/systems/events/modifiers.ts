// Adding and removing effect modifiers (DESIGN §12 12.1, 12.3). §12's pipeline and one-shot hooks are the writers
// from P3; P0 ships the store operations so effective() and its memo can be exercised. Both mutate an Immer draft.
import { insertSortedId, removeSortedId } from '../../core/iter';
import type { EffectModifier, EventsSlice } from './types';

export class ModifierError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ModifierError';
  }
}

function checkModifier(m: EffectModifier): void {
  if (!Number.isFinite(m.value)) throw new ModifierError(`modifier ${m.id}: value must be finite`);
  if (!Number.isSafeInteger(m.startTurn) || !Number.isSafeInteger(m.untilTurn) || m.untilTurn < m.startTurn) {
    throw new ModifierError(`modifier ${m.id}: needs integer startTurn ≤ untilTurn`);
  }
  if (!Number.isSafeInteger(m.visibleFromTurn)) throw new ModifierError(`modifier ${m.id}: visibleFromTurn`);
}

/** Adds a modifier (its id must be new), indexes it under its target and bumps modifiersVersion. */
export function addModifier(events: EventsSlice, m: EffectModifier): void {
  checkModifier(m);
  if (Object.prototype.hasOwnProperty.call(events.modifiers, m.id)) {
    throw new ModifierError(`modifier ${m.id} already exists`);
  }
  events.modifiers[m.id] = JSON.parse(JSON.stringify(m)) as EffectModifier;
  const ids = events.modifierIdsByTarget[m.target] ?? [];
  insertSortedId(ids, m.id);
  events.modifierIdsByTarget[m.target] = ids;
  events.modifiersVersion += 1;
}

/** Removes a modifier by id (a no-op returning false when absent); bumps modifiersVersion when it removed one. */
export function removeModifier(events: EventsSlice, id: string): boolean {
  const m = events.modifiers[id];
  if (m === undefined) return false;
  delete events.modifiers[id];
  const ids = events.modifierIdsByTarget[m.target];
  if (ids !== undefined) {
    removeSortedId(ids, id);
    if (ids.length === 0) delete events.modifierIdsByTarget[m.target];
  }
  events.modifiersVersion += 1;
  return true;
}
