// IndexedDB implementation of KvStore (DESIGN §2.9) on idb-keyval. A dedicated database keeps the game's saves apart
// from anything else on the origin. `setMany` and `delMany` each run in one IndexedDB transaction.
import { createStore, delMany, get, keys, setMany } from 'idb-keyval';
import type { KvStore } from './kv';

export const SAVE_DB_NAME = 'gold-mining-tycoon';
export const SAVE_STORE_NAME = 'saves';

export function createIdbKv(dbName: string = SAVE_DB_NAME, storeName: string = SAVE_STORE_NAME): KvStore {
  const store = createStore(dbName, storeName);
  return {
    get: (key) => get<unknown>(key, store),
    setMany: (entries) =>
      setMany(
        entries.map(([k, v]) => [k, v] as [string, unknown]),
        store,
      ),
    delMany: (ks) => delMany([...ks], store),
    keys: async () => (await keys(store)).filter((k): k is string => typeof k === 'string'),
  };
}
