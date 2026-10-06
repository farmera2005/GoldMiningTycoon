// The effect-hook registry (src/data/events/hooks.ts; DESIGN §2.10, §12 12.3, D-12.53, D-12.54; S12-5, S12-14). The row
// schema (shape, ops from the name, bounds around neutral) is tests/data/schemas/hooks.ts; this file adds the checks
// that need the tuning tables: owners by namespace, tuning bases that exist once their consumer ships, and neutral
// bases that do not collide with a tuning key (effective() would read the tuning value instead of the neutral one).
// The union with each owner's published list (systems/<folder>/hooks.ts) is tests/contracts/hooks.test.ts.
import { describe, expect, it } from 'vitest';
import { hookRegistry, type HookDef } from '../../src/data/events/hooks';
import { baseTuning, type TuningValue } from '../../src/data/tuning';
import { BUILD_RULES_PHASE, defaultNewGameSetup, effective, newGame, qDistrict } from '../../src/engine';
import { hookRegistrySchema } from './schemas';

const BASE: Readonly<Record<string, TuningValue>> = baseTuning;
const has = (rec: object, key: string): boolean => Object.prototype.hasOwnProperty.call(rec, key);

/** The section that reads a hook, by its key's first segment (12.3's owner column). */
const OWNER_BY_PREFIX: Readonly<Record<string, number>> = {
  season: 1,
  access: 1,
  geology: 3,
  prospect: 4,
  land: 5,
  permits: 6,
  ops: 7,
  staff: 8,
  fleet: 9,
  market: 10,
  finance: 11,
  hardrock: 14,
};

/**
 * The rules phase whose tuning bases must exist. P1 Wave 0 writes the P1 rows before the build switches to rules
 * phase 1 (contracts-engine flips BUILD_RULES_PHASE), so phase-1 bases are checked from now on.
 */
const CHECKED_PHASE = Math.max(BUILD_RULES_PHASE, 1);

function problems(value: unknown): string[] {
  const r = hookRegistrySchema.safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
}

const ROW: HookDef = {
  key: 'ops.thawMult',
  ownerSection: 7,
  unit: '×',
  neutral: 1,
  ops: ['mul'],
  scopeDims: ['district', 'claim'],
  base: 'neutral',
  consumerPhase: 1,
};

describe('hook registry rows (§12 12.3)', () => {
  it('passes the row schema: unique keys, ops from the name, bounds around neutral', () => {
    expect(problems(hookRegistry)).toEqual([]);
  });

  it('the schema has teeth', () => {
    expect(problems([ROW])).toEqual([]);
    expect(problems([ROW, ROW])).not.toEqual([]);
    expect(problems([{ ...ROW, ops: [] }])).not.toEqual([]);
    expect(problems([{ ...ROW, ops: ['mul', 'mul'] }])).not.toEqual([]);
    expect(problems([{ ...ROW, ops: ['div'] }])).not.toEqual([]);
    expect(problems([{ ...ROW, neutral: 0 }])).not.toEqual([]);
    expect(problems([{ ...ROW, mulBounds: [2, 5] }])).not.toEqual([]);
    expect(problems([{ ...ROW, addBounds: [0, 1] }])).not.toEqual([]);
    expect(problems([{ ...ROW, scopeDims: ['parish'] }])).not.toEqual([]);
    expect(problems([{ ...ROW, consumerPhase: 0 }])).not.toEqual([]);
    expect(problems([{ ...ROW, baseKey: 'ops.thawK' }])).not.toEqual([]);
    const add = { ...ROW, key: 'land.sellerMotivationAdd', neutral: 0, ops: ['add'] };
    expect(problems([add])).toEqual([]);
    expect(problems([{ ...add, ops: ['add', 'set'] }])).not.toEqual([]);
    const flag = { ...ROW, key: 'ops.blockLocked', neutral: 0, ops: ['set'] };
    expect(problems([{ ...flag, setBounds: [0.5, 1] }])).not.toEqual([]);
  });

  it('holds every 12.3 row: 76 hooks across ten owners, each registered whatever its consumer phase (D-12.54)', () => {
    expect(hookRegistry).toHaveLength(76);
    const byOwner: Record<number, number> = {};
    for (const h of hookRegistry) byOwner[h.ownerSection] = (byOwner[h.ownerSection] ?? 0) + 1;
    // §7's 15 (s07 #14), §8's six (S08-1), §10's five (S10-10).
    expect(byOwner).toEqual({ 1: 4, 3: 2, 4: 7, 5: 6, 6: 11, 7: 15, 8: 6, 9: 13, 10: 5, 11: 7 });
    // Read from P1: §1 4, §3 2, §4 6, §5 3, §7 12, §8 5, §9 5, §10 1.
    expect(hookRegistry.filter((h) => h.consumerPhase === 1)).toHaveLength(38);
  });

  it('every row is owned by the section its namespace names', () => {
    for (const h of hookRegistry) {
      const prefix = h.key.split('.')[0] as string;
      expect(OWNER_BY_PREFIX[prefix], `${h.key}: unknown hook namespace`).toBeDefined();
      expect(h.ownerSection, h.key).toBe(OWNER_BY_PREFIX[prefix]);
    }
  });

  it(`a tuning base exists, is a number and equals neutral at standard once its consumer ships (rules ≤ ${CHECKED_PHASE})`, () => {
    for (const h of hookRegistry.filter((x) => x.base === 'tuning')) {
      const key = h.baseKey ?? h.key;
      if (h.consumerPhase > CHECKED_PHASE) continue;
      expect(has(BASE, key), `${h.key}: tuning base ${key} is missing`).toBe(true);
      expect(typeof BASE[key], key).toBe('number');
      // `neutral` documents the standard base; difficulty moves the resolved value (§1 1.11), events scale it.
      expect(BASE[key], key).toBe(h.neutral);
    }
    // The P1 difficulty-scaled hooks (S08-1): the three §8 labor-market keys.
    const p1Tuning = hookRegistry.filter((h) => h.base === 'tuning' && h.consumerPhase <= 1).map((h) => h.key);
    expect(p1Tuning.sort()).toEqual(['staff.poolSizeMult', 'staff.quitHazardMult', 'staff.wageAskMult']);
  });

  it('a later phase’s tuning base, when its key already ships, is still a number', () => {
    for (const h of hookRegistry.filter((x) => x.base === 'tuning')) {
      const key = h.baseKey ?? h.key;
      if (has(BASE, key)) expect(typeof BASE[key], key).toBe('number');
    }
  });

  it('a neutral-base hook is not also a tuning key (effective() would read the tuning value)', () => {
    const clashes = hookRegistry.filter((h) => h.base === 'neutral' && has(BASE, h.key)).map((h) => h.key);
    expect(clashes).toEqual([]);
  });

  it('effective() resolves every P1 hook on a fresh game to its base: the difficulty value or neutral', () => {
    for (const difficulty of ['easy', 'standard', 'hard'] as const) {
      const state = newGame(defaultNewGameSetup({ companyName: 'Hooks', difficulty }), 'hooks-seed');
      const tuning = state.meta.tuning as Readonly<Record<string, TuningValue>>;
      const district = state.world.districtIds[0];
      if (district === undefined) throw new Error('no district');
      for (const h of hookRegistry.filter((x) => x.consumerPhase <= 1)) {
        const expected = h.base === 'tuning' ? tuning[h.baseKey ?? h.key] : h.neutral;
        expect(effective(state, h.key, qDistrict(district)), `${h.key} on ${difficulty}`).toBe(expected);
      }
    }
  });
});
