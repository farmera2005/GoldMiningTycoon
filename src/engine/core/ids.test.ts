import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  COUNTER_ENTITY_KINDS,
  EMP_OWNER,
  ID_PREFIXES,
  type IdPrefix,
  compareIds,
  formatId,
  isIdOf,
  isIdPrefix,
  modifierId,
  nextClaimListingId,
  nextEquipListingId,
  nextId,
  parseId,
  plantLineRefId,
  type ClaimId,
  type EvtId,
} from './ids';

const prefixes = Object.keys(ID_PREFIXES) as IdPrefix[];

describe('ID_PREFIXES registry (DESIGN §2.4)', () => {
  it('uses lowercase letter prefixes, each with one owner except lst (§5 and §9)', () => {
    for (const p of prefixes) {
      expect(p).toMatch(/^[a-z]+$/);
      const owners = ID_PREFIXES[p].owners;
      if (p === 'lst') expect([...owners]).toEqual([5, 9]);
      else expect(owners).toHaveLength(1);
      for (const o of owners) expect(o).toBeGreaterThanOrEqual(1);
      for (const o of owners) expect(o).toBeLessThanOrEqual(14);
    }
  });

  it('registers the resolved collisions as D-2.8 decided', () => {
    for (const p of ['ord', 'insp', 'auc', 'ctr'] as const) expect(ID_PREFIXES[p].owners).not.toContain(9);
    for (const p of ['fo', 'mi', 'aev', 'rct'] as const) expect([...ID_PREFIXES[p].owners]).toEqual([9]);
    expect([...ID_PREFIXES.ivr.owners]).toEqual([1]);
    expect([...ID_PREFIXES.reo.owners]).toEqual([11]);
    expect(isIdPrefix('inv')).toBe(false);
  });

  it('maps every counter entity kind to a registered prefix, with lst backing exactly two kinds', () => {
    const byPrefix = new Map<string, string[]>();
    for (const [kind, prefix] of Object.entries(COUNTER_ENTITY_KINDS)) {
      expect(isIdPrefix(prefix)).toBe(true);
      byPrefix.set(prefix, [...(byPrefix.get(prefix) ?? []), kind]);
    }
    expect(byPrefix.get('lst')?.sort()).toEqual(['claimListing', 'equipListing']);
    for (const p of prefixes) expect(byPrefix.has(p), `prefix ${p} has an entity kind`).toBe(true);
    for (const [p, kinds] of byPrefix) if (p !== 'lst') expect(kinds).toHaveLength(1);
  });
});

describe('formatId / parseId / nextId', () => {
  it('zero-pads to six digits and widens past 999,999', () => {
    expect(formatId('clm', 1)).toBe('clm_000001');
    expect(formatId('txn', 123)).toBe('txn_000123');
    expect(formatId('clm', 999999)).toBe('clm_999999');
    expect(formatId('clm', 1000000)).toBe('clm_1000000');
    expect(() => formatId('clm', 1.5)).toThrow(RangeError);
    expect(() => formatId('clm', -1)).toThrow(RangeError);
    expect(() => formatId('nope' as IdPrefix, 1)).toThrow(/unregistered prefix/);
  });

  it('parses exactly the canonical forms', () => {
    expect(parseId('clm_000042')).toEqual({ prefix: 'clm', num: 42 });
    expect(parseId('clm_1000000')).toEqual({ prefix: 'clm', num: 1000000 });
    expect(parseId(EMP_OWNER)).toEqual({ prefix: 'emp', num: null });
    for (const bad of ['clm_42', 'clm_0000042', 'xyz_000001', 'clm-000001', 'CLM_000001', 'clm_000042/L2', '']) {
      expect(parseId(bad), bad).toBeNull();
    }
    expect(isIdOf('mch_000007', 'mch')).toBe(true);
    expect(isIdOf('mch_000007', 'clm')).toBe(false);
    expect(isIdOf(EMP_OWNER, 'emp')).toBe(true);
  });

  it('round-trips every prefix', () => {
    fc.assert(
      fc.property(fc.constantFrom(...prefixes), fc.integer({ min: 0, max: 2 ** 40 }), (p, n) => {
        expect(parseId(formatId(p, n))).toEqual({ prefix: p, num: n });
      }),
    );
  });

  it('draws from per-prefix counters, mutating the record; lst is one counter for both listing kinds', () => {
    const counters: Partial<Record<IdPrefix, number>> = { clm: 41 };
    expect(nextId(counters, 'clm')).toBe('clm_000042');
    expect(nextId(counters, 'mch')).toBe('mch_000001');
    expect(nextId(counters, 'mch')).toBe('mch_000002');
    expect(counters).toEqual({ clm: 42, mch: 2 });
    expect(nextClaimListingId(counters)).toBe('lst_000001');
    expect(nextEquipListingId(counters)).toBe('lst_000002');
    expect(nextClaimListingId(counters)).toBe('lst_000003');
  });

  it('builds plant-line and modifier ids (not counter ids)', () => {
    expect(plantLineRefId('clm_000042' as ClaimId, 'L2')).toBe('clm_000042/L2');
    expect(modifierId('evt_000007' as EvtId, 3)).toBe('evt_000007/m3');
    expect(() => modifierId('evt_000007' as EvtId, -1)).toThrow(RangeError);
  });
});

describe('compareIds', () => {
  const sorted = (xs: string[]) => [...xs].sort(compareIds);

  it('puts emp_owner before every numbered emp_ and orders numerically, not lexically', () => {
    expect(sorted(['emp_000002', 'emp_000001', EMP_OWNER, 'emp_1000000'])).toEqual([
      EMP_OWNER,
      'emp_000001',
      'emp_000002',
      'emp_1000000',
    ]);
    expect(compareIds('clm_1000000', 'clm_999999')).toBeGreaterThan(0);
    expect(compareIds('clm_999999', 'clm_1000000')).toBeLessThan(0);
  });

  it('orders by prefix first, then number', () => {
    expect(sorted(['mch_000001', 'clm_000010', 'clm_000002', 'blk_999999', 'cand_000001', 'card_000001'])).toEqual([
      'blk_999999',
      'cand_000001',
      'card_000001',
      'clm_000002',
      'clm_000010',
      'mch_000001',
    ]);
    // a prefix that is a prefix of another sorts first (lo < loan < loc < lod < loss < lot)
    expect(sorted(['lot_000001', 'loan_000001', 'loss_000001', 'loc_000001', 'lod_000001'])).toEqual([
      'loan_000001',
      'loc_000001',
      'lod_000001',
      'loss_000001',
      'lot_000001',
    ]);
  });

  it('orders composite ids by base id, then tail naturally (plant lines, modifiers)', () => {
    expect(sorted(['clm_000042/L2', 'clm_000042/L1', 'clm_000041/L3', 'clm_000042'])).toEqual([
      'clm_000041/L3',
      'clm_000042',
      'clm_000042/L1',
      'clm_000042/L2',
    ]);
    expect(sorted(['evt_000002/m10', 'evt_000002/m2', 'evt_1000000/m0', 'evt_999999/m0', 'prp_000001/m0'])).toEqual([
      'evt_000002/m2',
      'evt_000002/m10',
      'evt_999999/m0',
      'evt_1000000/m0',
      'prp_000001/m0',
    ]);
  });

  it('falls back to UTF-16 code-unit order for other strings', () => {
    expect(sorted(['northernFederal', 'aridFederal', 'Z', 'a10', 'a9'])).toEqual([
      'Z',
      'a10',
      'a9',
      'aridFederal',
      'northernFederal',
    ]);
    // a plain string equal to an id prefix sorts before that prefix's ids
    expect(sorted(['clm_000001', 'clm', 'clm_x', 'cl'])).toEqual(['cl', 'clm', 'clm_000001', 'clm_x']);
  });

  it('is a total order over arbitrary strings (antisymmetric, transitive, zero only for equal strings)', () => {
    const idLike = fc.oneof(
      fc
        .constantFrom(...prefixes)
        .chain((p) =>
          fc.tuple(
            fc.constant(p),
            fc.nat({ max: 2_000_000 }),
            fc.constantFrom('', '/L1', '/L2', '/m2', '/m10', '/m02'),
          ),
        )
        .map(([p, n, tail]) => `${formatId(p, n)}${tail}`),
      fc.constant(EMP_OWNER),
      fc.constantFrom('clm_1', 'clm_01', 'emp', 'emp_', 'clm', 'a', 'Z', ''),
      fc.string({ maxLength: 8 }),
    );
    fc.assert(
      fc.property(idLike, idLike, idLike, (a, b, c) => {
        const ab = Math.sign(compareIds(a, b));
        expect(Math.sign(compareIds(b, a))).toBe(-ab || 0);
        expect(ab === 0).toBe(a === b);
        if (compareIds(a, b) <= 0 && compareIds(b, c) <= 0) expect(compareIds(a, c)).toBeLessThanOrEqual(0);
      }),
      { numRuns: 5000 },
    );
  });
});
