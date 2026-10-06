import { describe, expect, it } from 'vitest';
import { newGame, select } from '../../src/engine';
import { setupForCell } from '../setup';
import { startNetWorthCents } from './startNetWorth';

const CELL = { start: 'bootstrapper', difficulty: 'standard', background: 'none', entity: 'llc' } as const;

describe('start NW (BALANCE §5.3)', () => {
  it('is $520,000 for the Bootstrapper ($400k company + $120k personal, DESIGN §1 1.8)', () => {
    const s = newGame(setupForCell(CELL), '1');
    expect(startNetWorthCents('bootstrapper', s.meta.tuning)).toBe(52_000_000);
  });

  it('equals the turn-0 scoring NW the engine books, so the year-0 ratio is 1', () => {
    const s = newGame(setupForCell(CELL), '1');
    expect(startNetWorthCents('bootstrapper', s.meta.tuning)).toBe(select.netWorth(s, 'scoring'));
  });

  it('scales with the difficulty cash multipliers from the resolved tuning', () => {
    const s = newGame(setupForCell(CELL), '1', {
      'game.startCompanyCashMult': 1.25,
      'game.startPersonalCashMult': 1.1,
    });
    // 400,000 × 1.25 + 120,000 × 1.1 = 632,000.
    expect(startNetWorthCents('bootstrapper', s.meta.tuning)).toBe(63_200_000);
    expect(select.netWorth(s, 'scoring')).toBe(63_200_000);
  });

  it('is not derivable for the starts whose tables arrive in P1', () => {
    const s = newGame(setupForCell(CELL), '1');
    for (const start of ['backedEquity', 'backedRoyalty', 'inheritor'] as const) {
      expect(startNetWorthCents(start, s.meta.tuning)).toBeNull();
    }
  });
});
