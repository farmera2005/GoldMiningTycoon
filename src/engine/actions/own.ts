// Own-property lookups for Records indexed by ids that arrive from outside the engine (an action, a replayed log, a
// save's actionLog, a bot). A plain `rec[id]` returns an inherited value for 'constructor', 'toString', '__proto__'
// and the like, so validation would read a function as a record and throw instead of returning its typed error
// (DESIGN §2.2: validation is total).

export function hasOwn(rec: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(rec, key);
}

/** The Record's own value at `key`, or undefined when `key` is not one of its own properties. */
export function ownValue<V>(rec: Readonly<Record<string, V>>, key: string): V | undefined {
  return hasOwn(rec, key) ? rec[key] : undefined;
}
