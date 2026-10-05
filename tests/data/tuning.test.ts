import { describe, expect, it } from 'vitest';
import { tuningNamespaces } from '../../src/data/tuning';

// DESIGN §2.10: every key is namespaced and appears in exactly one namespace file.
describe('tuning tables', () => {
  it('prefixes every key with its namespace and never repeats a key', () => {
    const seen = new Set<string>();
    for (const [ns, table] of Object.entries(tuningNamespaces)) {
      for (const key of Object.keys(table)) {
        expect(key.startsWith(`${ns}.`), `${key} must start with ${ns}.`).toBe(true);
        expect(seen.has(key), `${key} appears twice`).toBe(false);
        seen.add(key);
      }
    }
  });
});
