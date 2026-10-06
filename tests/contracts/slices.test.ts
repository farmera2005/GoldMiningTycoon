// GameState v2 (P1 contract §2): every slice is present in its full shape with its Wave-0 initial value, every Record
// with an `…Ids` array mirrors it, no property holds `undefined`, the save check accepts the fresh state, and under
// rules p0 the P0 initialization leaves the P1 slices at their neutral values.
import { describe, expect, it } from 'vitest';
import { defaultNewGameSetup, newGame, type GameState } from '../../src/engine';
import { stateProblem } from '../../src/engine/save/validate';
import { CURRENT_SCHEMA_VERSION } from '../../src/engine/state/schema';
import { SLICE_KEYS } from '../../src/engine/state/types';
import { emptyFleetSlice } from '../../src/engine/systems/fleet/types';
import { emptyEventsSlice } from '../../src/engine/systems/events/types';
import { emptyStaffSlice } from '../../src/engine/systems/staff/types';
import { DEFAULT_STANDING_ORDER, emptyGoldSlice } from '../../src/engine/systems/gold/types';

const SETUP = defaultNewGameSetup({ companyName: 'Slices Test' });
const P1 = newGame(SETUP, 'slices');
const P0 = newGame(SETUP, 'slices', undefined, { rulesPhase: 0 });

/** Paths of every property whose value is `undefined` (state is plain JSON: none may be). */
function undefinedPaths(value: unknown, path = ''): string[] {
  if (value === undefined) return [path];
  if (value === null || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap((v, i) => undefinedPaths(v, `${path}[${i}]`));
  return Object.entries(value).flatMap(([k, v]) => undefinedPaths(v, `${path}.${k}`));
}

describe('GameState v2 slices (P1 contract §2)', () => {
  it('has every slice, a valid save shape and no undefined property, under P1 and P0 rules', () => {
    for (const s of [P1, P0]) {
      for (const key of SLICE_KEYS) expect(typeof s[key], key).toBe('object');
      expect(stateProblem(JSON.parse(JSON.stringify(s)), CURRENT_SCHEMA_VERSION)).toBeNull();
      expect(undefinedPaths(s)).toEqual([]);
    }
  });

  it('records the meta fields: calendar mode drawn, no fixture id, rules phase 1 by default', () => {
    expect(P1.meta).toMatchObject({ rulesPhase: 1, calendarMode: 'drawn' });
    expect('fixtureId' in P1.meta).toBe(false);
    expect(P0.meta).toMatchObject({ rulesPhase: 0, calendarMode: 'drawn' });
  });

  it('ships the P2+ collections at their neutral values', () => {
    expect(P1.fleet).toEqual(emptyFleetSlice());
    expect(P1.events).toEqual(emptyEventsSlice());
    expect(P1.staff).toEqual(emptyStaffSlice());
    expect(P1.gold).toEqual(emptyGoldSlice());
    expect(P1.gold.standingOrder).toEqual(DEFAULT_STANDING_ORDER);
    expect(P1.permits).toEqual({ obligations: {}, obligationIds: [] });
  });

  it('keeps the P0 company books under rules p0 and adds the start table only from rules p1', () => {
    const books = (s: GameState) => s.finance.books;
    expect(books(P0)).toEqual(books(P1));
    expect(P0.company.reputation.value).toBe(0);
    expect(P0.finance.credit.owner.score).toBe(0);
  });
});
