// Pure, non-serialized memo caches (DESIGN §2.3 item 6, D-2.19). Rules every cache follows:
//  • the key covers everything the value depends on (a content hash, or a version counter that lives in state);
//  • the value is immutable, and the same key returns the same object;
//  • caches live here in module scope, never in GameState, and are never saved or hashed;
//  • eviction or a cold cache never changes a result: replays with caches disabled, enabled and cleared every week give
//    identical hashes (the memo-transparency property test drives setMemoEnabled / clearAllMemos).
// This is the only engine module allowed to use Map/WeakMap (ESLint exempts it).

export interface Memo<K extends string, V> {
  readonly name: string;
  readonly maxEntries: number;
  /** Cached value, or undefined on a miss (always undefined while memos are disabled). */
  get(key: K): V | undefined;
  /** Stores a value (ignored while memos are disabled); evicts the least recently used entry beyond maxEntries. */
  set(key: K, value: V): void;
  /** Returns the cached value or computes, stores and returns it. With memos disabled it always computes. */
  getOrCompute(key: K, compute: () => V): V;
  clear(): void;
  readonly size: number;
  readonly stats: MemoStats;
}

export interface MemoStats {
  hits: number;
  misses: number;
  evictions: number;
}

export interface WeakMemo<K extends object, V> {
  readonly name: string;
  get(key: K): V | undefined;
  set(key: K, value: V): void;
  getOrCompute(key: K, compute: () => V): V;
  clear(): void;
}

interface Clearable {
  clear(): void;
}

let enabled = true;
const registry = new Map<string, Clearable>();

/** Turns every memo on or off (off: get misses, set is ignored). Clears all caches either way. */
export function setMemoEnabled(on: boolean): void {
  enabled = on;
  clearAllMemos();
}

export function isMemoEnabled(): boolean {
  return enabled;
}

/** Empties every registered cache. */
export function clearAllMemos(): void {
  for (const memo of registry.values()) memo.clear();
}

/** Names of the registered caches (diagnostics). */
export function memoNames(): string[] {
  return [...registry.keys()].sort();
}

/**
 * A bounded LRU cache keyed by strings. `name` identifies it for clearAllMemos and diagnostics; re-creating a memo
 * with the same name (e.g. a hot-reloaded module) replaces the old registration. `undefined` means "miss", so V must
 * not include undefined (wrap optional results, e.g. `{ value: T | null }`).
 */
export function createMemo<K extends string, V>(name: string, maxEntries: number): Memo<K, V> {
  if (!Number.isSafeInteger(maxEntries) || maxEntries < 1) {
    throw new RangeError(`createMemo(${name}): maxEntries must be a positive integer`);
  }
  const map = new Map<K, V>();
  const stats: MemoStats = { hits: 0, misses: 0, evictions: 0 };

  const memo: Memo<K, V> = {
    name,
    maxEntries,
    get(key) {
      if (!enabled) return undefined;
      const v = map.get(key);
      if (v === undefined) {
        stats.misses++;
        return undefined;
      }
      stats.hits++;
      // Refresh recency: Map iterates in insertion order, so re-inserting moves the key to the young end.
      map.delete(key);
      map.set(key, v);
      return v;
    },
    set(key, value) {
      if (!enabled) return;
      map.delete(key);
      map.set(key, value);
      while (map.size > maxEntries) {
        const oldest = map.keys().next();
        if (oldest.done === true) break;
        map.delete(oldest.value);
        stats.evictions++;
      }
    },
    getOrCompute(key, compute) {
      const hit = memo.get(key);
      if (hit !== undefined) return hit;
      const value = compute();
      memo.set(key, value);
      return value;
    },
    clear() {
      map.clear();
    },
    get size() {
      return map.size;
    },
    stats,
  };
  registry.set(name, memo);
  return memo;
}

/**
 * A cache keyed by object identity (e.g. an immutable state slice). Entries vanish with their key object, so there is
 * no size bound; clear() swaps in a fresh WeakMap.
 */
export function createWeakMemo<K extends object, V>(name: string): WeakMemo<K, V> {
  let map = new WeakMap<K, V>();
  const memo: WeakMemo<K, V> = {
    name,
    get(key) {
      return enabled ? map.get(key) : undefined;
    },
    set(key, value) {
      if (enabled) map.set(key, value);
    },
    getOrCompute(key, compute) {
      const hit = memo.get(key);
      if (hit !== undefined) return hit;
      const value = compute();
      memo.set(key, value);
      return value;
    },
    clear() {
      map = new WeakMap<K, V>();
    },
  };
  registry.set(name, memo);
  return memo;
}
