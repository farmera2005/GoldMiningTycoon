import { describe, expect, it } from 'vitest';
import { nextId } from '../core/ids';
import { reserveIdsFrom } from './ids';
import type { IdCounters } from './types';

describe('reserveIdsFrom (DESIGN §2.4: generated ids never collide with later ones)', () => {
  it('raises counters to the highest canonical id found in keys and string values', () => {
    const world = {
      districts: { dst_000002: { id: 'dst_000002', creeks: ['crk_000007', 'crk_000003'] } },
      claims: { clm_000041: { blocks: ['blk_001200'] }, clm_000009: {} },
      notes: 'clm_999 is not canonical; emp_owner is not counted',
      owner: 'emp_owner',
      packed: 'AAECAwQ=',
    };
    const counters: IdCounters = { clm: 50 };
    reserveIdsFrom(world, counters);
    expect(counters).toEqual({ dst: 2, crk: 7, clm: 50, blk: 1200 });
    expect(nextId(counters, 'blk')).toBe('blk_001201');
  });

  it('ignores unregistered prefixes and numbers', () => {
    const counters: IdCounters = {};
    reserveIdsFrom({ zzz_000005: 1, n: 7, arr: [1, 'abc_000002'] }, counters);
    expect(counters).toEqual({});
  });
});
