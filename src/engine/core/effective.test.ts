import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { HookDef } from '../../data/events/hooks';
import {
  activeModifiers,
  effectQueryKey,
  effectiveValue,
  scopeMatches,
  type EffectModifier,
  type EffectQuery,
} from './effective';
import type { BlockId, ClaimId, DistrictId, EvtId } from './ids';

const PERMANENT = Number.MAX_SAFE_INTEGER;

function mod(id: string, partial: Partial<EffectModifier> & Pick<EffectModifier, 'op' | 'value'>): EffectModifier {
  return {
    id,
    target: 'fleet.partsLeadTimeMult',
    scope: {},
    startTurn: 0,
    untilTurn: PERMANENT,
    visibleFromTurn: 0,
    sourceEvtId: id.split('/')[0] as EvtId,
    ...partial,
  };
}

const partsLead: HookDef = { key: 'fleet.partsLeadTimeMult', ownerSection: 9, neutral: 1, unit: 'mult' };

describe('effectiveValue (DESIGN §2.10 = §12 12.3)', () => {
  it('reproduces the §12 worked example: brand disruption × world disruption', () => {
    const mods = [
      mod('evt_000004/m0', { op: 'mul', value: 2.0, scope: { brandId: 'tianlong' }, untilTurn: 40 }),
      mod('evt_000005/m0', { op: 'mul', value: 1.5 }),
    ];
    expect(effectiveValue(1, partsLead, mods, 30, { brandId: 'tianlong' })).toBe(3.0);
    expect(effectiveValue(1, partsLead, mods, 30, { brandId: 'other' })).toBe(1.5);
    expect(effectiveValue(1, partsLead, mods, 41, { brandId: 'tianlong' })).toBe(1.5); // brand modifier expired
  });

  it('multiplies a difficulty-scaled base rather than replacing it (easy pool 1.3 × gold rush 0.85)', () => {
    const hook: HookDef = { key: 'staff.poolSizeMult', ownerSection: 8, neutral: 1, unit: 'mult' };
    const rush = mod('evt_000009/m1', { target: 'staff.poolSizeMult', op: 'mul', value: 0.85 });
    expect(effectiveValue(1.3, hook, [rush], 5, {})).toBeCloseTo(1.105, 15);
  });

  it('returns the base when no modifier is active (time window inclusive at both ends)', () => {
    const m = mod('evt_000001/m0', { op: 'mul', value: 2, startTurn: 10, untilTurn: 12 });
    expect(effectiveValue(7, partsLead, [m], 9, {})).toBe(7);
    expect(effectiveValue(7, partsLead, [m], 10, {})).toBe(14);
    expect(effectiveValue(7, partsLead, [m], 12, {})).toBe(14);
    expect(effectiveValue(7, partsLead, [m], 13, {})).toBe(7);
  });

  it('adds sums on top of the scaled base: v = base × Πmul + Σadd', () => {
    const hook: HookDef = { key: 'season.breakupShiftWeeks', ownerSection: 1, neutral: 0, unit: 'weeks' };
    const mods = [
      mod('evt_000002/m0', { target: hook.key, op: 'add', value: 2 }),
      mod('evt_000003/m0', { target: hook.key, op: 'add', value: -0.5 }),
    ];
    expect(effectiveValue(0, hook, mods, 1, {})).toBe(1.5);
  });

  it('lets the latest set win (tie: lowest id), clamped to the set bounds', () => {
    const hook: HookDef = { key: 'ops.fuelSupplyFrac', ownerSection: 7, neutral: 1, unit: 'frac' };
    const mods = [
      mod('evt_000010/m0', { target: hook.key, op: 'set', value: 0.2, startTurn: 3 }),
      mod('evt_000002/m0', { target: hook.key, op: 'set', value: 0.6, startTurn: 5 }),
      mod('evt_000011/m0', { target: hook.key, op: 'set', value: 0.4, startTurn: 5 }),
      mod('evt_000001/m0', { target: hook.key, op: 'mul', value: 3 }),
    ];
    expect(effectiveValue(1, hook, mods, 6, {})).toBe(0.6); // startTurn 5 ties; evt_000002 < evt_000011
    const over = mod('evt_000020/m0', { target: hook.key, op: 'set', value: 7, startTurn: 6 });
    expect(effectiveValue(1, hook, [...mods, over], 6, {})).toBe(1); // default set bounds [0, 1]
    const wide: HookDef = { ...hook, setBounds: [0, 160] };
    expect(effectiveValue(5, wide, [over], 6, {})).toBe(7);
  });

  it('clamps products to [0, 5] and sums to ±10 by default, or to the hook’s own bounds', () => {
    const mods = [mod('evt_000001/m0', { op: 'mul', value: 4 }), mod('evt_000002/m0', { op: 'mul', value: 3 })];
    expect(effectiveValue(2, partsLead, mods, 0, {})).toBe(10); // 2 × clamp(12) = 2 × 5
    const fuel: HookDef = {
      key: 'fleet.partsLeadTimeMult',
      ownerSection: 7,
      neutral: 1,
      unit: 'mult',
      mulBounds: [1, 4],
    };
    expect(effectiveValue(2, fuel, mods, 0, {})).toBe(8);
    const adds = [mod('evt_000001/m0', { op: 'add', value: 8 }), mod('evt_000002/m0', { op: 'add', value: 8 })];
    expect(effectiveValue(0, partsLead, adds, 0, {})).toBe(10);
    const fee: HookDef = { ...partsLead, addBounds: [0, 300] };
    expect(effectiveValue(200, fee, adds, 0, {})).toBe(216);
  });

  it('ignores modifiers on other hooks when the hook is known', () => {
    const other = mod('evt_000001/m0', { target: 'ops.hoursMult', op: 'mul', value: 0 });
    expect(effectiveValue(1, partsLead, [other], 0, {})).toBe(1);
  });

  it('is independent of the order the modifiers are stored in (bit-exact)', () => {
    const arbMod = fc.record({
      n: fc.integer({ min: 1, max: 30 }),
      op: fc.constantFrom('mul' as const, 'add' as const),
      value: fc.double({ min: 0.1, max: 3, noNaN: true }),
    });
    fc.assert(
      fc.property(fc.uniqueArray(arbMod, { selector: (m) => m.n, maxLength: 8 }), (specs) => {
        const mods = specs.map((s) => mod(`evt_${String(s.n).padStart(6, '0')}/m0`, { op: s.op, value: s.value }));
        const forward = effectiveValue(1.7, partsLead, mods, 0, {});
        const backward = effectiveValue(1.7, partsLead, [...mods].reverse(), 0, {});
        expect(Object.is(forward, backward)).toBe(true);
      }),
    );
  });
});

describe('scope matching', () => {
  const claim = 'clm_000007' as ClaimId;
  const district = 'dst_000001' as DistrictId;
  const blk = (n: number) => `blk_${String(n).padStart(6, '0')}` as BlockId;

  it('requires every scope field set on the modifier to equal the query’s', () => {
    expect(scopeMatches({}, {})).toBe(true);
    expect(scopeMatches({ claimId: claim }, { districtId: district, claimId: claim })).toBe(true);
    expect(scopeMatches({ claimId: claim }, { districtId: district })).toBe(false);
    expect(scopeMatches({ districtId: district, claimId: claim }, { claimId: claim })).toBe(false);
    expect(scopeMatches({ regime: 'usFederal' }, { regime: 'usFederal' })).toBe(true);
  });

  it('matches block lists by membership of the queried block', () => {
    const scope = { claimId: claim, blockIds: [blk(3), blk(4)] };
    expect(scopeMatches(scope, { claimId: claim, blockId: blk(4) })).toBe(true);
    expect(scopeMatches(scope, { claimId: claim, blockId: blk(5) })).toBe(false);
    expect(scopeMatches(scope, { claimId: claim })).toBe(false);
    expect(scopeMatches({ blockIds: [] }, { blockId: blk(1) })).toBe(false);
  });

  it('returns the active set in id order', () => {
    const mods = [
      mod('evt_000010/m0', { op: 'mul', value: 1 }),
      mod('evt_000002/m1', { op: 'mul', value: 1 }),
      mod('evt_000002/m0', { op: 'mul', value: 1, scope: { claimId: claim } }),
    ];
    expect(activeModifiers(partsLead, mods, 0, { claimId: claim }).map((m) => m.id)).toEqual([
      'evt_000002/m0',
      'evt_000002/m1',
      'evt_000010/m0',
    ]);
    expect(activeModifiers(partsLead, mods, 0, {}).map((m) => m.id)).toEqual(['evt_000002/m1', 'evt_000010/m0']);
  });

  it('builds a canonical memo key for a query', () => {
    const q: EffectQuery = { claimId: claim, districtId: district };
    const same: EffectQuery = { districtId: district, claimId: claim };
    expect(effectQueryKey(q)).toBe(effectQueryKey(same));
    expect(effectQueryKey(q)).not.toBe(effectQueryKey({ claimId: claim }));
  });
});
