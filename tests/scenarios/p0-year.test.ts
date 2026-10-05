// P0 scenario (DESIGN §2.15 P0 exit): a P0 game advances 52 weeks; the frame holds its invariants all year.
import { describe, expect, it } from 'vitest';
import {
  advanceWeek,
  canAdvance,
  defaultNewGameSetup,
  defaultStopRules,
  newGame,
  runToNextDecision,
  select,
  type GameState,
} from '../../src/engine';
import { ledgerProblem } from '../../src/engine/systems/finance/ledger';

describe('a P0 Bootstrapper year', () => {
  const start = newGame(defaultNewGameSetup({ companyName: 'Year One Placers' }), 'p0-year');

  it('advances 52 weeks to year 2 week 1 with the frame intact every week', () => {
    let s: GameState = start;
    for (let w = 1; w <= 52; w++) {
      s = advanceWeek(s).state;
      expect(s.clock.turn).toBe(w);
      expect(canAdvance(s)).toBeNull();
      expect(select.cashOnHand(s)).toBe(40_000_000);
      expect(s.history.weekly).toHaveLength(157);
      expect(s.history.weekly[156]?.turn).toBe(w);
    }
    expect(s.clock).toMatchObject({ turn: 52, year: 2, week: 1 });
    expect(select.dateView(s)).toMatchObject({ displayYear: 2028, start: { month: 1, day: 1 } });
    expect(s.history.annual).toEqual([
      {
        year: 1,
        cashEndCents: 40_000_000,
        ownerNwEndCents: 52_000_000,
        companyNwEndCents: 40_000_000,
        payWashedBcy: 0,
        weighedRawOz: 0,
        soldFineOz: 0,
        revenueCents: 0,
        netIncomeCents: 0,
        claimsHeld: 0,
      },
    ]);
    expect(ledgerProblem(s.finance)).toBeNull();
    // Turns −104…52 remain: the pre-history scrolls out of the ring as play weeks arrive.
    expect(s.history.weekly[0]?.turn).toBe(-104);
    expect(s.history.weekly.filter((x) => x.company !== undefined)).toHaveLength(53);
  });

  it('runs to the next decision under the default stop rules: a quiet P0 year stops only at maxWeeks', () => {
    const r = runToNextDecision(start, { maxWeeks: 52, stopRules: defaultStopRules() });
    expect(r.state.clock.turn).toBe(52);
    expect(r.stoppedBecause.map((x) => x.kind)).toEqual(['maxWeeks']);
  });
});
