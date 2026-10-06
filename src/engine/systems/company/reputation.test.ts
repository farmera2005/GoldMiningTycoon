// recordReputation (DESIGN §1 1.12; P1 contract §4.2, §0.6 item 8): an input becomes a pending entry with the delta of
// `game.reputation.delta`, applied in step 16a. The table arrives with the parallel data package, so these tests patch
// a two-row table into the game's resolved tuning; a missing table fails loudly (TUNING_KEY_UNKNOWN).
import { describe, expect, it } from 'vitest';
import type { Id } from '../../core/ids';
import { produceState } from '../../state/immutability';
import { newGame } from '../../state/newGame';
import { defaultNewGameSetup } from '../../state/setup';
import { TuningError } from '../../state/tuning';
import type { GameState } from '../../state/types';
import { recordReputation, ReputationKindError } from './reputation';

const BASE = newGame(defaultNewGameSetup({ companyName: 'Reputation Test' }), 'reputation');
const TABLE = {
  missedPayroll: { delta: -8, cap: { amount: 8, period: 'week' } },
  dealClosed: { delta: 1, cap: { amount: 3, period: 'year' } },
};

const withTable = (table: unknown): GameState =>
  produceState(BASE, (d) => {
    (d.meta.tuning as Record<string, unknown>)['game.reputation.delta'] = table;
  });

describe('recordReputation (§1 1.12)', () => {
  it('appends the input with its table delta, turn and reference, for step 16a', () => {
    const s = produceState(withTable(TABLE), (d) => {
      recordReputation(d, 'missedPayroll', null);
      recordReputation(d, 'dealClosed', 'ten_000004' as Id);
    });
    expect(s.company.reputation.pending).toEqual([
      { turn: 0, kind: 'missedPayroll', delta: -8, ref: null },
      { turn: 0, kind: 'dealClosed', delta: 1, ref: 'ten_000004' },
    ]);
    expect(s.company.reputation.value).toBe(BASE.company.reputation.value);
  });

  it('refuses a kind the table does not list, and fails loudly without the table', () => {
    expect(() => produceState(withTable(TABLE), (d) => recordReputation(d, 'fatality', null))).toThrow(
      ReputationKindError,
    );
    const without = produceState(BASE, (d) => {
      delete (d.meta.tuning as Record<string, unknown>)['game.reputation.delta'];
    });
    expect(() => produceState(without, (d) => recordReputation(d, 'missedPayroll', null))).toThrow(TuningError);
  });
});
