// Adding and removing effect modifiers (DESIGN §12 12.1, 12.3; P1 contract §4.12). §12's pipeline and one-shot hooks
// are the writers from P3; P0 ships the store operations so effective() and its memo can be exercised. Both mutate an
// Immer draft. A modifier on a registered hook must use one of the hook's ops, be scoped only by the hook's scope
// dimensions and keep its value inside the op's bounds (the registry is the contract with the reading formula); a
// modifier on a plain tuning key (no registry row) passes, as effective() resolves those too.
import { insertSortedId, removeSortedId } from '../../core/iter';
import { hookFor } from './effective';
import type { EffectModifier, EffectScope, EventsSlice } from './types';

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
  checkAgainstRegistry(m);
}

/** EffectScope field → the registry's scope dimension. */
const SCOPE_DIM: Readonly<Record<keyof EffectScope, string>> = {
  districtId: 'district',
  claimId: 'claim',
  machineId: 'machine',
  employeeId: 'employee',
  lenderId: 'lender',
  modelId: 'model',
  brandId: 'brand',
  regime: 'regime',
  blockIds: 'block',
};
const SCOPE_FIELDS = Object.freeze([
  'districtId',
  'claimId',
  'machineId',
  'employeeId',
  'lenderId',
  'modelId',
  'brandId',
  'regime',
  'blockIds',
] as const satisfies readonly (keyof EffectScope)[]);

function checkAgainstRegistry(m: EffectModifier): void {
  const hook = hookFor(m.target);
  if (hook === undefined) return;
  if (!hook.ops.includes(m.op)) throw new ModifierError(`modifier ${m.id}: ${m.target} does not allow '${m.op}'`);
  const dims: readonly string[] = hook.scopeDims;
  for (const field of SCOPE_FIELDS) {
    if (m.scope[field] !== undefined && !dims.includes(SCOPE_DIM[field])) {
      throw new ModifierError(`modifier ${m.id}: ${m.target} cannot be scoped by ${SCOPE_DIM[field]}`);
    }
  }
  const bounds = m.op === 'mul' ? hook.mulBounds : m.op === 'add' ? hook.addBounds : hook.setBounds;
  if (bounds !== undefined && (m.value < bounds[0] || m.value > bounds[1])) {
    throw new ModifierError(
      `modifier ${m.id}: ${m.op} ${m.value} outside ${m.target}'s bounds [${bounds[0]}, ${bounds[1]}]`,
    );
  }
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
