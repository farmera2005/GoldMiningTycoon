// Sorted iteration over Records (DESIGN §2.3 item 3, D-2.20). JavaScript iterates string keys in insertion order, which
// depends on the path a game took, so the engine never iterates a Record directly: ids come out in compareIds order
// and other string keys in UTF-16 code-unit order. This is the only engine file allowed to call
// Object.keys/values/entries (ESLint enforces it).
//
// Cost: sortedKeys is O(n) for the common case (one id prefix, keys already in id order) but Object.keys itself costs
// ~3 ms on a 20,000-key object in V8. Owners of very large collections iterated every week (blocks, ledger lines) should
// keep a sorted `…Ids` array beside the Record (§2.3 allows it; insertSortedId/removeSortedId maintain it).
import { compareIds, compareShaped, idShape, type IdShape } from './ids';

/**
 * True when every string is `prefix_digits` with one shared a–z prefix and one shared length. compareIds order then
 * equals plain code-unit order (same prefix, same digit count), so the native sort can be used. This is the common
 * case: one Record holds one kind of entity, and counters stay below 1,000,000.
 */
function isUniformIdSet(ids: readonly string[]): boolean {
  const first = ids[0] as string;
  const us = first.indexOf('_');
  if (us <= 0) return false;
  for (let i = 0; i < us; i++) {
    const c = first.charCodeAt(i);
    if (c < 97 || c > 122) return false;
  }
  const len = first.length;
  if (len === us + 1) return false;
  for (const s of ids) {
    if (s.length !== len || s.charCodeAt(us) !== 95) return false;
    for (let i = 0; i < us; i++) if (s.charCodeAt(i) !== first.charCodeAt(i)) return false;
    for (let i = us + 1; i < len; i++) {
      const c = s.charCodeAt(i);
      if (c < 48 || c > 57) return false;
    }
  }
  return true;
}

/** Sorts strings in compareIds order (ids by prefix then number; other strings by code units). Returns a new array. */
export function sortIds<T extends string>(ids: readonly T[]): T[] {
  const n = ids.length;
  if (n < 2) return ids.slice();
  if (isUniformIdSet(ids)) {
    // Records are usually filled in id order, so the keys often arrive sorted already.
    let ascending = true;
    for (let i = 1; i < n && ascending; i++) ascending = (ids[i - 1] as T) < (ids[i] as T);
    return ascending ? ids.slice() : ids.slice().sort(); // the default sort compares UTF-16 code units
  }
  // General case: parse each string once, then sort on the decomposed keys (a Schwartzian transform).
  const decorated: { s: T; k: IdShape | null }[] = new Array<{ s: T; k: IdShape | null }>(n);
  for (let i = 0; i < n; i++) {
    const s = ids[i] as T;
    decorated[i] = { s, k: idShape(s) };
  }
  decorated.sort((x, y) => compareShaped(x.s, x.k, y.s, y.k));
  const out = new Array<T>(n);
  for (let i = 0; i < n; i++) out[i] = (decorated[i] as { s: T }).s;
  return out;
}

/** Own enumerable keys in compareIds order. */
export function sortedKeys<K extends string>(rec: Readonly<Record<K, unknown>>): K[] {
  return sortIds(Object.keys(rec) as K[]);
}

/** Values in compareIds order of their keys. */
export function sortedValues<K extends string, V>(rec: Readonly<Record<K, V>>): V[] {
  const keys = sortedKeys(rec);
  const out = new Array<V>(keys.length);
  for (let i = 0; i < keys.length; i++) out[i] = rec[keys[i] as K];
  return out;
}

/** [key, value] pairs in compareIds order of the keys. */
export function sortedEntries<K extends string, V>(rec: Readonly<Record<K, V>>): [K, V][] {
  const keys = sortedKeys(rec);
  const out = new Array<[K, V]>(keys.length);
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i] as K;
    out[i] = [k, rec[k]];
  }
  return out;
}

/** Own enumerable keys in pure UTF-16 code-unit order (canonical JSON, non-id group keys that must not be id-aware). */
export function sortedKeysByCodeUnit<K extends string>(rec: Readonly<Record<K, unknown>>): K[] {
  // The default sort compares strings by UTF-16 code units (ECMAScript SortCompare), with no locale involved.
  return (Object.keys(rec) as K[]).sort();
}

/** Number of own enumerable keys, without exposing their (insertion) order. */
export function recordSize(rec: Readonly<Record<string, unknown>>): number {
  return Object.keys(rec).length;
}

/** True when `ids` is strictly ascending in compareIds order (no duplicates): the invariant of every `…Ids` array. */
export function isSortedIds(ids: readonly string[]): boolean {
  for (let i = 1; i < ids.length; i++) {
    if (compareIds(ids[i - 1] as string, ids[i] as string) >= 0) return false;
  }
  return true;
}

/** True when `ids` equals the Record's key set in compareIds order (§2.3: a `…Ids` array must mirror its Record). */
export function idsMatchRecord(ids: readonly string[], rec: Readonly<Record<string, unknown>>): boolean {
  const keys = sortedKeys(rec);
  if (keys.length !== ids.length) return false;
  for (let i = 0; i < keys.length; i++) if (keys[i] !== ids[i]) return false;
  return true;
}

/**
 * Inserts `id` into an ascending `…Ids` array in place (binary search), keeping it sorted; a no-op when present.
 * Intended for Immer drafts. Returns the index of `id`.
 */
export function insertSortedId<T extends string>(ids: T[], id: T): number {
  let lo = 0;
  let hi = ids.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const c = compareIds(ids[mid] as T, id);
    if (c === 0) return mid;
    if (c < 0) lo = mid + 1;
    else hi = mid;
  }
  ids.splice(lo, 0, id);
  return lo;
}

/** Removes `id` from an ascending `…Ids` array in place; returns whether it was present. */
export function removeSortedId<T extends string>(ids: T[], id: T): boolean {
  let lo = 0;
  let hi = ids.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    const c = compareIds(ids[mid] as T, id);
    if (c === 0) {
      ids.splice(mid, 1);
      return true;
    }
    if (c < 0) lo = mid + 1;
    else hi = mid;
  }
  return false;
}
