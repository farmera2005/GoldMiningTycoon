// The action registry (DESIGN §2.2): one row per action type with its validator, optional warnings, handler, declared
// flags and first rules phase. Rows register at module load from catalog.ts; tests may register test-only rows
// (registerAction returns the unregister function). Validation and application look rows up by type only; only the
// test helpers list the table, in sorted order, so registration order can never matter.
import { sortedKeysByCodeUnit } from '../core/iter';
import { rulesAtLeast } from '../state/rules';
import type { GameState } from '../state/types';
import { hasOwn } from './own';
import type { ActionDef, ActionError, ActionWarning, AnyAction } from './types';

const registry: Record<string, ActionDef> = {};

export class ActionRegistryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActionRegistryError';
  }
}

/** `family/verb` with lowercase family and camelCase verb (§2.2). */
const ACTION_TYPE = /^[a-z][a-zA-Z0-9]*\/[a-z][a-zA-Z0-9]*$/;

/** Registers an action type. Throws on a malformed or duplicate type. Returns a function that unregisters it. */
export function registerAction<A extends AnyAction>(def: ActionDef<A>): () => void {
  if (!ACTION_TYPE.test(def.type)) throw new ActionRegistryError(`action type '${def.type}' is not family/verb`);
  if (hasOwn(registry, def.type)) throw new ActionRegistryError(`action type '${def.type}' is already registered`);
  registry[def.type] = def as unknown as ActionDef;
  return () => {
    delete registry[def.type];
  };
}

export function getActionDef(type: string): ActionDef | undefined {
  return hasOwn(registry, type) ? registry[type] : undefined;
}

export function isRegisteredAction(type: string): boolean {
  return hasOwn(registry, type);
}

/** Every registered type, sorted (tests and the contract checks). */
export function registeredActionTypes(): string[] {
  return sortedKeysByCodeUnit(registry);
}

/** Types whose row is still a Wave-0 stub (P1 contract §0.2: P1 exit requires none). */
export function stubbedActionTypes(): string[] {
  return registeredActionTypes().filter((t) => registry[t]?.stub === true);
}

/** Shape check shared by every entry point: a plain object with a string `type`. */
export function malformed(action: unknown): ActionError | null {
  if (typeof action !== 'object' || action === null || Array.isArray(action)) {
    return { code: 'ACTION_MALFORMED', message: 'an action must be a plain object' };
  }
  const type = (action as { type?: unknown }).type;
  if (typeof type !== 'string') return { code: 'ACTION_MALFORMED', message: 'an action needs a string type' };
  return null;
}

/**
 * The registry's part of validation: shape, a known type, the game's rules phase (an action that arrives with a later
 * phase is refused, so `--rules pN` games and replays cannot use later rules), then the row's own validator.
 */
export function validateWithRegistry(state: GameState, action: unknown): ActionError | null {
  const bad = malformed(action);
  if (bad !== null) return bad;
  const a = action as AnyAction;
  const def = getActionDef(a.type);
  if (def === undefined) return { code: 'ACTION_UNKNOWN', message: `no action type '${a.type}'` };
  if (!rulesAtLeast(state, def.fromPhase)) {
    return { code: 'ACTION_NOT_IN_PHASE', message: `${a.type} is available from P${def.fromPhase}` };
  }
  return def.validate(state, a);
}

/** The row's non-blocking warnings for an action that passed validation (copied, never aliased). */
export function warningsWithRegistry(state: GameState, action: AnyAction): ActionWarning[] {
  const def = getActionDef(action.type);
  if (def === undefined || def.warnings === undefined) return [];
  return def.warnings(state, action).map((w) => ({ ...w }));
}
