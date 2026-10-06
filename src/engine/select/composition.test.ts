// Per-folder composition (s02 #11, S13-5; P1 contract §1.1): `select`, `explain`, the action registry and the part
// table spread every folder's file, so a name defined twice would silently shadow another owner's. These tests fail on
// any collision, and check that the composed objects hold exactly their sources.
import { describe, expect, it } from 'vitest';
import { ACTION_SOURCES, ENGINE_ACTION_TYPES } from '../actions/catalog';
import { isRegisteredAction, registeredActionTypes } from '../actions/registry';
import { EXPLAINER_SOURCES, explain } from '../explain';
import type { ExplainerName } from '../explain/types';
import { newGame } from '../state/newGame';
import { defaultNewGameSetup } from '../state/setup';
import { PART_SOURCES } from '../turn/parts';
import { SELECTOR_SOURCES, select } from '.';

/** Names defined by more than one source. */
function collisions(sources: Readonly<Record<string, readonly string[]>>): string[] {
  const seen: Record<string, string> = {};
  const out: string[] = [];
  for (const [source, names] of Object.entries(sources)) {
    for (const n of names) {
      if (seen[n] !== undefined) out.push(`${n} (${seen[n]} and ${source})`);
      else seen[n] = source;
    }
  }
  return out;
}

const keysOf = (rec: Readonly<Record<string, object>>): Record<string, string[]> =>
  Object.fromEntries(Object.entries(rec).map(([k, v]) => [k, Object.keys(v)]));

const STATE = newGame(defaultNewGameSetup({ companyName: 'Composition Test' }), 'composition');

describe('per-folder composition (s02 #11)', () => {
  it('select: no name in two sources, and select is exactly their union', () => {
    expect(collisions(keysOf(SELECTOR_SOURCES))).toEqual([]);
    const union = Object.values(keysOf(SELECTOR_SOURCES)).flat().sort();
    expect(Object.keys(select).sort()).toEqual(union);
  });

  it('keeps the P0 selector names, now owned by their sections', () => {
    expect(Object.keys(SELECTOR_SOURCES.finance)).toEqual(['cashOnHand', 'netWorth', 'companyNetWorth']);
    expect(Object.keys(SELECTOR_SOURCES.gold)).toEqual(['market', 'spotUsdPerFineOz']);
    expect(Object.keys(SELECTOR_SOURCES.land)).toContain('heldDistrictIds');
    expect(Object.keys(SELECTOR_SOURCES.history)).toEqual(['weeklyHistory', 'annualHistory']);
    expect(select.cashOnHand(STATE)).toBe(40_000_000);
    expect(select.netWorth(STATE, 'scoring')).toBe(52_000_000);
    expect(select.heldDistrictIds(STATE)).toEqual([]);
  });

  it('select.tuning reads the game’s resolved tuning (s02 #13)', () => {
    expect(select.tuning(STATE, 'game.startCalendarYear')).toBe(STATE.meta.tuning['game.startCalendarYear']);
    expect(select.tuning(STATE, 'market.openingSpotUsdPerFineOz')).toBe(select.spotUsdPerFineOz(STATE));
  });

  it('explain: no name in two folders, every name callable on a fresh state (S13-5)', () => {
    expect(collisions(keysOf(EXPLAINER_SOURCES))).toEqual([]);
    const names = Object.keys(explain) as ExplainerName[];
    expect(names.sort()).toEqual(Object.values(keysOf(EXPLAINER_SOURCES)).flat().sort());
    for (const name of names) {
      const fn = explain[name] as (s: typeof STATE) => { label: string; value: number };
      expect(typeof fn, name).toBe('function');
      if (fn.length > 1) continue; // explainers with arguments are exercised by their owners' tests
      const tree = fn(STATE);
      expect(typeof tree.label, name).toBe('string');
      expect(Number.isFinite(tree.value), name).toBe(true);
    }
  });

  it('actions: every source row registered once under a unique type', () => {
    const types: Record<string, string[]> = Object.fromEntries(
      Object.entries(ACTION_SOURCES).map(([k, rows]) => [k, rows.map((r) => r.type)]),
    );
    expect(collisions(types)).toEqual([]);
    for (const t of ENGINE_ACTION_TYPES) expect(isRegisteredAction(t), t).toBe(true);
    expect(registeredActionTypes()).toEqual(expect.arrayContaining([...ENGINE_ACTION_TYPES]));
    expect(ENGINE_ACTION_TYPES).toContain('decision/answer');
  });

  it('parts: no id in two folders', () => {
    const ids: Record<string, string[]> = Object.fromEntries(
      Object.entries(PART_SOURCES).map(([k, parts]) => [k, parts.map((p) => p.id)]),
    );
    expect(collisions(ids)).toEqual([]);
  });
});
