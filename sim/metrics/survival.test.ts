import { describe, expect, it } from 'vitest';
import type { LiquidationPath } from '../../src/engine';
import {
  bkN,
  bN,
  firstSeasonProfit,
  liquidationCauseBy,
  nwRatioBy,
  ownerAheadBy,
  productionAttemptIn,
  reorgSplitBy,
  reorgStatusAt,
  retreatedN,
  rsN,
  sN,
  yearEndTurn,
} from './survival';
import { operating, syntheticResult } from './testing';

const years = (f: (n: number) => boolean | null | string, upTo = 5): (boolean | null | string)[] =>
  Array.from({ length: upTo }, (_, i) => f(i + 1));

describe('BALANCE §5.1–5.2 windows', () => {
  it('year N ends at turn 52N − 1 (turn 0 is year 1 week 1)', () => {
    expect(yearEndTurn(1)).toBe(51);
    expect(yearEndTurn(5)).toBe(259);
  });

  it('a P0 passive run is never lost and never washes: B_N = 1, S_N = 0, all retreated', () => {
    const r = syntheticResult({ rules: 0 }, 5, () => ({ washedBcy: null, claimsHeld: null, fleetWashBcyHr: null }));
    expect(years((n) => bN(r, n))).toEqual([true, true, true, true, true]);
    expect(years((n) => sN(r, n))).toEqual([false, false, false, false, false]);
    expect(years((n) => retreatedN(r, n))).toEqual([true, true, true, true, true]);
    expect(years((n) => rsN(r, n))).toEqual([false, false, false, false, false]);
    expect(years((n) => bkN(r, n))).toEqual([false, false, false, false, false]);
    expect(productionAttemptIn(r, 1)).toBeNull();
  });

  it('a going concern survives every window', () => {
    const r = syntheticResult({}, 5, operating);
    expect(years((n) => sN(r, n))).toEqual([true, true, true, true, true]);
    expect(productionAttemptIn(r, 3)).toBe(true);
  });

  for (const cause of ['filed', 'involuntary', 'converted', 'p1Counter'] as LiquidationPath[]) {
    it(`liquidation (${cause}) in year 2 fails B_N and S_N from year 2 and counts in BK_N and L_N`, () => {
      const lostTurn = 70; // year 2 week 19
      const r = syntheticResult(
        {
          runStatus: 'lost',
          endReason: 'liquidated',
          lossCause: 'liquidated',
          liquidationCause: cause,
          lostTurn,
          finalTurn: lostTurn,
          reorg:
            cause === 'converted'
              ? { filedTurn: 30, confirmedTurn: null, completedTurn: null, convertedTurn: lostTurn, consensual: null }
              : { filedTurn: null, confirmedTurn: null, completedTurn: null, convertedTurn: null, consensual: null },
        },
        5,
        (n) => (n === 1 ? operating() : { carried: true, washedBcy: 0, cashCents: 0 }),
      );
      const filedInY1 = cause === 'converted';
      expect(years((n) => bN(r, n))).toEqual([!filedInY1, false, false, false, false]);
      expect(years((n) => sN(r, n))).toEqual([!filedInY1, false, false, false, false]);
      expect(years((n) => bkN(r, n))).toEqual([filedInY1, true, true, true, true]);
      expect(years((n) => liquidationCauseBy(r, n))).toEqual([null, cause, cause, cause, cause]);
      expect(rsN(r, 1)).toBe(filedInY1);
    });
  }

  it('an ousted owner loses B_N but made no bankruptcy filing (BK_N = 1 − B_N fails only with an investor)', () => {
    const r = syntheticResult(
      { start: 'backedEquity', runStatus: 'lost', endReason: 'ousted', lossCause: 'ousted', lostTurn: 100 },
      5,
      (n) => (n === 1 ? operating() : { carried: true }),
    );
    expect(years((n) => bN(r, n))).toEqual([true, false, false, false, false]);
    expect(years((n) => bkN(r, n))).toEqual([false, false, false, false, false]);
    expect(liquidationCauseBy(r, 2)).toBeNull();
  });

  it('a scenario lost by a missed deadline is a loss with cause scenario', () => {
    const r = syntheticResult(
      { runStatus: 'lost', endReason: 'deadline', lossCause: 'scenario', lostTurn: 51 },
      3,
      operating,
    );
    expect(years((n) => bN(r, n), 3)).toEqual([false, false, false]);
    expect(years((n) => bkN(r, n), 3)).toEqual([false, false, false]);
  });

  it('reorganized in year 2, then converted in year 3: fails both windows from the filing, counts once in BK_N', () => {
    const reorg = { filedTurn: 60, confirmedTurn: 80, completedTurn: null, convertedTurn: 120, consensual: false };
    const r = syntheticResult(
      {
        rules: 4,
        runStatus: 'lost',
        endReason: 'liquidated',
        lossCause: 'liquidated',
        liquidationCause: 'converted',
        lostTurn: 120,
        reorg,
      },
      5,
      (n) => (n <= 2 ? operating() : { carried: true }),
    );
    expect(years((n) => bN(r, n))).toEqual([true, false, false, false, false]);
    expect(years((n) => sN(r, n))).toEqual([true, false, false, false, false]);
    expect(years((n) => rsN(r, n))).toEqual([false, true, true, true, true]);
    expect(years((n) => bkN(r, n))).toEqual([false, true, true, true, true]);
    expect(years((n) => liquidationCauseBy(r, n))).toEqual([null, null, 'converted', 'converted', 'converted']);
    expect(years((n) => reorgSplitBy(r, n))).toEqual([null, 'open', 'converted', 'converted', 'converted']);
    expect(reorgStatusAt(r, 70)).toBe('filed');
    expect(reorgStatusAt(r, 90)).toBe('confirmed');
  });

  it('reorganized in year 1 and completed in year 4: keeps playing, fails every window, measured normally', () => {
    const reorg = { filedTurn: 30, confirmedTurn: 45, completedTurn: 200, convertedTurn: null, consensual: true };
    const r = syntheticResult({ rules: 4, reorg }, 5, (n) => ({ ...operating(), ownerNwCents: 52_000_000 + n * 1e6 }));
    expect(years((n) => bN(r, n))).toEqual([false, false, false, false, false]);
    expect(years((n) => sN(r, n))).toEqual([false, false, false, false, false]);
    expect(years((n) => rsN(r, n))).toEqual([true, true, true, true, true]);
    expect(years((n) => bkN(r, n))).toEqual([true, true, true, true, true]);
    expect(years((n) => reorgSplitBy(r, n))).toEqual(['open', 'open', 'open', 'completed', 'completed']);
    expect(years((n) => liquidationCauseBy(r, n))).toEqual([null, null, null, null, null]);
    expect(nwRatioBy(r, 3)).toBeCloseTo(55 / 52, 12);
    expect(ownerAheadBy(r, 3)).toBe(true);
  });

  it('retreated: no bankruptcy, but no claim and fleet and too little cash at the year end', () => {
    const r = syntheticResult({}, 2, (n) =>
      n === 1 ? operating() : { washedBcy: 0, claimsHeld: 0, fleetWashBcyHr: 0, cashCents: 14_999_999 },
    );
    expect(sN(r, 1)).toBe(true);
    expect(sN(r, 2)).toBe(false);
    expect(retreatedN(r, 2)).toBe(true);
  });

  it('cash ≥ $150,000 × cpiIndex keeps a run without a claim a going concern', () => {
    const at = (cashCents: number, cpiIndex: number) =>
      sN(
        syntheticResult({}, 2, (n) =>
          n === 1 ? operating() : { washedBcy: 0, claimsHeld: 0, fleetWashBcyHr: 0, cashCents, cpiIndex },
        ),
        2,
      );
    expect(at(15_000_000, 1)).toBe(true);
    expect(at(16_000_000, 1.1)).toBe(false); // needs $165,000
    expect(at(16_500_000, 1.1)).toBe(true);
  });

  it('a claim with a fleet under 20 bcy/hr is not an operation', () => {
    const r = syntheticResult({}, 1, () => ({ washedBcy: 10, claimsHeld: 1, fleetWashBcyHr: 19.9, cashCents: 0 }));
    expect(sN(r, 1)).toBe(false);
  });

  it('a distress fleet sale fails S_N from its year on', () => {
    const r = syntheticResult({ distressFleetSaleTurn: 60 }, 3, operating);
    expect(years((n) => sN(r, n), 3)).toEqual([true, false, false]);
    expect(years((n) => bN(r, n), 3)).toEqual([true, true, true]);
  });

  it('a game the harness aborted has no measured years after the abort', () => {
    const r = syntheticResult({ abortReason: 'blockingDecisionUnanswered', abortedTurn: 60 }, 3, operating);
    expect(years((n) => bN(r, n), 3)).toEqual([true, null, null]);
    expect(years((n) => sN(r, n), 3)).toEqual([true, null, null]);
    expect(nwRatioBy(r, 2)).toBeNull();
  });
});

describe('BALANCE §5.3 NW ratio and §5.6 FSP', () => {
  it('divides owner NW by the start NW, real from P5', () => {
    const r = syntheticResult({ startNwCents: 52_000_000 }, 1, () => ({ ownerNwCents: 26_000_000 }));
    expect(nwRatioBy(r, 1)).toBe(0.5);
    expect(ownerAheadBy(r, 1)).toBe(false);
    const p5 = syntheticResult({ rules: 5 }, 1, () => ({ ownerNwCents: 57_200_000, cpiIndex: 1.1 }));
    expect(nwRatioBy(p5, 1)).toBeCloseTo(1, 12);
    expect(nwRatioBy(syntheticResult({ startNwCents: null }), 1)).toBeNull();
  });

  it('FSP is net income plus the unsold-gold change, strictly positive', () => {
    expect(firstSeasonProfit(syntheticResult({}, 1, () => ({ netIncomeCents: 0 })))).toBe(false);
    expect(firstSeasonProfit(syntheticResult({}, 1, () => ({ netIncomeCents: 1 })))).toBe(true);
    expect(
      firstSeasonProfit(syntheticResult({ unsoldGoldChangeY1Cents: 500 }, 1, () => ({ netIncomeCents: -400 }))),
    ).toBe(true);
    expect(firstSeasonProfit(syntheticResult({}, 1, () => ({ netIncomeCents: null })))).toBeNull();
    expect(firstSeasonProfit(syntheticResult({ unsoldGoldChangeY1Cents: null }))).toBeNull();
  });
});
