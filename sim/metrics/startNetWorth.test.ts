import { describe, expect, it } from 'vitest';
import { newGame, select, type Difficulty, type GameState } from '../../src/engine';
import { setupForCell } from '../setup';
import { startNetWorthCents } from './startNetWorth';

const cell = (difficulty: Difficulty) =>
  ({ start: 'bootstrapper', difficulty, background: 'none', entity: 'llc' }) as const;

// Through the real path: newGame resolves the difficulty rows of src/data/difficulty.ts (DESIGN §1 1.11).
const games: Partial<Record<Difficulty, GameState>> = {};
const game = (d: Difficulty): GameState => (games[d] ??= newGame(setupForCell(cell(d)), '1'));

describe('start NW (BALANCE §5.3)', () => {
  it('is $520,000 for the standard Bootstrapper ($400k company + $120k personal, DESIGN §1 1.8)', () => {
    expect(startNetWorthCents('bootstrapper', game('standard').meta.tuning)).toBe(52_000_000);
  });

  it('equals the turn-0 scoring NW the engine books at every difficulty, so the year-0 ratio is 1', () => {
    for (const d of ['easy', 'standard', 'hard'] as const) {
      expect(startNetWorthCents('bootstrapper', game(d).meta.tuning), d).toBe(select.netWorth(game(d), 'scoring'));
    }
  });

  it('scales with the difficulty cash multipliers (§1 1.11: 1.25 / 1.0 / 0.85 and 1.1 / 1.0 / 0.9)', () => {
    // Easy: 400,000 × 1.25 + 120,000 × 1.1 = 632,000. Hard: 400,000 × 0.85 + 120,000 × 0.9 = 448,000.
    expect(startNetWorthCents('bootstrapper', game('easy').meta.tuning)).toBe(63_200_000);
    expect(startNetWorthCents('bootstrapper', game('hard').meta.tuning)).toBe(44_800_000);
    const hashes = (['easy', 'standard', 'hard'] as const).map((d) => game(d).meta.tuningHash);
    expect(new Set(hashes).size).toBe(3);
  });

  it('follows a --tuning override of a multiplier too', () => {
    // 400,000 × 1.5 + 120,000 × 1.0 = 720,000.
    const s = newGame(setupForCell(cell('standard')), '1', { 'game.startCompanyCashMult': 1.5 });
    expect(startNetWorthCents('bootstrapper', s.meta.tuning)).toBe(72_000_000);
    expect(select.netWorth(s, 'scoring')).toBe(72_000_000);
  });

  it('is not derivable for the starts whose tables arrive in P1', () => {
    for (const start of ['backedEquity', 'backedRoyalty', 'inheritor'] as const) {
      expect(startNetWorthCents(start, game('standard').meta.tuning)).toBeNull();
    }
  });
});
