// The action registry (DESIGN §2.2): one row per action type with its validator, handler and declared flags. Rows
// register at module load from catalog.ts; tests may register test-only rows (registerAction returns the
// unregister function). The table is looked up by type only, never iterated, so registration order cannot matter.
import type { GameState } from '../state/types';
import type { ActionDef, ActionError, AnyAction } from './types';

const registry: Record<string, ActionDef> = {};
const hasOwn = (obj: object, key: string): boolean => Object.prototype.hasOwnProperty.call(obj, key);

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

/** Shape check shared by every entry point: a plain object with a string `type`. */
export function malformed(action: unknown): ActionError | null {
  if (typeof action !== 'object' || action === null || Array.isArray(action)) {
    return { code: 'ACTION_MALFORMED', message: 'an action must be a plain object' };
  }
  const type = (action as { type?: unknown }).type;
  if (typeof type !== 'string') return { code: 'ACTION_MALFORMED', message: 'an action needs a string type' };
  return null;
}

/** The registry's part of validation: shape, a known type, then the row's own validator. */
export function validateWithRegistry(state: GameState, action: unknown): ActionError | null {
  const bad = malformed(action);
  if (bad !== null) return bad;
  const a = action as AnyAction;
  const def = getActionDef(a.type);
  if (def === undefined) return { code: 'ACTION_UNKNOWN', message: `no action type '${a.type}'` };
  return def.validate(state, a);
}
