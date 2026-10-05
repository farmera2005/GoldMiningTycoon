// A small key-value interface over the browser's save storage (DESIGN §2.9: IndexedDB through a thin idb-keyval-style
// wrapper). Writes go through `setMany`/`delMany` so a slot's text and its index entry change in one transaction:
// a failed write leaves the previous slot intact rather than half-replaced.

export interface KvStore {
  /** The stored value, or undefined when the key is absent. */
  get(key: string): Promise<unknown>;
  /** Writes every entry atomically. */
  setMany(entries: readonly (readonly [string, unknown])[]): Promise<void>;
  /** Deletes every key atomically; absent keys are ignored. */
  delMany(keys: readonly string[]): Promise<void>;
  /** All keys, in no particular order. */
  keys(): Promise<string[]>;
}

/** Stored values are plain JSON data (strings and records); copying keeps callers from sharing mutable objects. */
function copy<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}

export interface MemoryKv extends KvStore {
  /** A deep copy of the whole store, for tests that assert a failed operation changed nothing. */
  snapshot(): Record<string, unknown>;
}

/** In-memory implementation for tests and for environments without IndexedDB. */
export function createMemoryKv(initial: Readonly<Record<string, unknown>> = {}): MemoryKv {
  const data: Record<string, unknown> = copy({ ...initial });
  return {
    get: (key) => Promise.resolve(Object.hasOwn(data, key) ? copy(data[key]) : undefined),
    setMany(entries) {
      for (const [key, value] of entries) data[key] = copy(value);
      return Promise.resolve();
    },
    delMany(keys) {
      for (const key of keys) delete data[key];
      return Promise.resolve();
    },
    keys: () => Promise.resolve(Object.keys(data)),
    snapshot: () => copy(data),
  };
}
