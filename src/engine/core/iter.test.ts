import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { EMP_OWNER, compareIds, formatId } from './ids';
import {
  idsMatchRecord,
  insertSortedId,
  isSortedIds,
  recordSize,
  removeSortedId,
  sortIds,
  sortedEntries,
  sortedKeys,
  sortedKeysByCodeUnit,
  sortedValues,
} from './iter';

function build(keys: readonly string[]): Record<string, number> {
  const rec: Record<string, number> = {};
  keys.forEach((k, i) => (rec[k] = i));
  return rec;
}

describe('sorted Record iteration (DESIGN §2.3 item 3)', () => {
  it('iterates ids in compareIds order regardless of insertion order', () => {
    const rec = build(['clm_000010', 'clm_000002', 'clm_1000000', 'clm_999999']);
    expect(sortedKeys(rec)).toEqual(['clm_000002', 'clm_000010', 'clm_999999', 'clm_1000000']);
    expect(sortedValues(rec)).toEqual([1, 0, 3, 2]);
    expect(sortedEntries(rec)).toEqual([
      ['clm_000002', 1],
      ['clm_000010', 0],
      ['clm_999999', 3],
      ['clm_1000000', 2],
    ]);
  });

  it('puts emp_owner first and sorts non-id keys by code units', () => {
    expect(sortedKeys(build(['emp_000003', EMP_OWNER, 'emp_000001']))).toEqual([EMP_OWNER, 'emp_000001', 'emp_000003']);
    expect(sortedKeys(build(['northernFederal', 'aridFederal', 'Alaska']))).toEqual([
      'Alaska',
      'aridFederal',
      'northernFederal',
    ]);
  });

  it('gives the same order for every permutation of insertion (fast-check)', () => {
    const keyArb = fc.uniqueArray(
      fc.oneof(
        fc.nat({ max: 3_000_000 }).map((n) => formatId('clm', n)),
        fc.nat({ max: 50 }).map((n) => formatId('mch', n)),
        fc.constant(EMP_OWNER),
        fc.string({ maxLength: 6 }),
      ),
      { maxLength: 40 },
    );
    fc.assert(
      fc.property(keyArb, fc.nat(), (keys, seed) => {
        const shuffled = [...keys];
        let s = seed;
        for (let i = shuffled.length - 1; i > 0; i--) {
          s = (s * 1103515245 + 12345) % 2147483648;
          const j = s % (i + 1);
          [shuffled[i], shuffled[j]] = [shuffled[j] as string, shuffled[i] as string];
        }
        const a = sortedKeys(build(keys));
        expect(sortedKeys(build(shuffled))).toEqual(a);
        expect(a).toEqual([...keys].sort(compareIds));
        expect(isSortedIds(a)).toBe(true);
      }),
      { numRuns: 300 },
    );
  });

  it('sortedKeysByCodeUnit is pure code-unit order (canonical JSON)', () => {
    expect(sortedKeysByCodeUnit(build(['clm_000010', 'clm_000009', 'b', 'A']))).toEqual([
      'A',
      'b',
      'clm_000009',
      'clm_000010',
    ]);
    expect(sortedKeysByCodeUnit(build(['clm_9', 'clm_10']))).toEqual(['clm_10', 'clm_9']);
  });

  it('sortIds copies and handles tiny inputs', () => {
    const input = ['b', 'a'] as const;
    expect(sortIds(input)).toEqual(['a', 'b']);
    expect(input).toEqual(['b', 'a']);
    expect(sortIds([])).toEqual([]);
    expect(sortIds(['x'])).toEqual(['x']);
    expect(recordSize({ a: 1, b: 2 })).toBe(2);
  });
});

describe('sorted …Ids arrays', () => {
  it('insertSortedId / removeSortedId keep the array sorted and mirror the Record', () => {
    fc.assert(
      fc.property(fc.array(fc.tuple(fc.boolean(), fc.nat({ max: 1_200_000 }))), (ops) => {
        const ids: string[] = [];
        const rec: Record<string, true> = {};
        for (const [add, n] of ops) {
          const id = formatId('lot', n);
          if (add) {
            insertSortedId(ids, id);
            rec[id] = true;
          } else {
            expect(removeSortedId(ids, id)).toBe(id in rec);
            delete rec[id];
          }
          expect(isSortedIds(ids)).toBe(true);
        }
        expect(idsMatchRecord(ids, rec)).toBe(true);
      }),
    );
  });

  it('detects unsorted, duplicated and mismatched arrays', () => {
    expect(isSortedIds(['clm_000002', 'clm_000001'])).toBe(false);
    expect(isSortedIds(['clm_000001', 'clm_000001'])).toBe(false);
    expect(idsMatchRecord(['clm_000001'], { clm_000001: 1, clm_000002: 2 })).toBe(false);
    expect(idsMatchRecord(['clm_000002', 'clm_000001'], { clm_000001: 1, clm_000002: 2 })).toBe(false);
    expect(insertSortedId(['a', 'c'], 'c')).toBe(1);
  });
});
