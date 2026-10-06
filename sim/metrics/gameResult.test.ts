// The observer's timeline: year ends at week 52, a run that ends early carries its last state forward, a liquidation
// records its cause, and stops and minimum cash are counted by week.
import { describe, expect, it } from 'vitest';
import { advanceWeek, newGame, type GameState, type StopReason } from '../../src/engine';
import { setupForCell } from '../setup';
import { GameObserver } from './gameResult';
import { bN, bkN, liquidationCauseBy, sN } from './survival';

const CELL = { start: 'bootstrapper', difficulty: 'standard', background: 'none', entity: 'llc' } as const;
const identity = (years: number) => ({
  index: 0,
  seed: '1',
  bot: 'passive',
  ...CELL,
  rules: 0 as const,
  years,
  startNwCents: 52_000_000,
});

function withCash(state: GameState, cents: number): GameState {
  const s = JSON.parse(JSON.stringify(state)) as GameState;
  const company = s.finance.books.company;
  company.balances['cash.operating'] = cents as never;
  return s;
}

describe('GameObserver', () => {
  it('closes each year at week 52 and records a quiet P0 year', () => {
    let s = newGame(setupForCell(CELL), '1');
    const obs = new GameObserver(identity(2), s);
    for (let w = 0; w < 103; w++) {
      s = advanceWeek(s).state;
      obs.week(s, []);
    }
    const r = obs.finish(s, null);
    expect(r.byYear.map((y) => [y.year, y.turn, y.carried])).toEqual([
      [1, 51, false],
      [2, 103, false],
    ]);
    expect(r.byYear[0]).toMatchObject({
      ownerNwCents: 52_000_000,
      cashCents: 40_000_000,
      netIncomeCents: 0,
      washedBcy: null,
      stops: 0,
    });
    expect(r).toMatchObject({
      finalTurn: 103,
      runStatus: 'active',
      lossCause: null,
      minCashCents: 40_000_000,
      minCashTurn: 0,
      longestQuietWeeks: 103,
    });
    expect(r.reorg.filedTurn).toBeNull();
    expect([bN(r, 1), bN(r, 2), sN(r, 2)]).toEqual([true, true, false]);
  });

  it('counts stops, kinds and the longest quiet run, and tracks minimum cash', () => {
    let s = newGame(setupForCell(CELL), '1');
    const obs = new GameObserver(identity(1), s);
    const stop: StopReason[] = [{ kind: 'rule', rule: 'monthStart', label: 'x' }];
    for (let w = 1; w <= 51; w++) {
      s = advanceWeek(s).state;
      const shown = w === 10 ? withCash(s, 1_000) : s;
      obs.week(shown, w % 13 === 0 ? stop : []);
    }
    const r = obs.finish(s, null);
    expect(r.byYear[0]?.stops).toBe(3);
    expect(r.stopsByKind.rule).toBe(3);
    expect(r.longestQuietWeeks).toBe(12);
    expect(r).toMatchObject({ minCashCents: 1_000, minCashTurn: 10 });
  });

  it('records a liquidation by its cause and carries the last state through the remaining years', () => {
    let s = newGame(setupForCell(CELL), '1');
    const obs = new GameObserver(identity(3), s);
    for (let w = 1; w <= 60; w++) {
      s = advanceWeek(s).state;
      obs.week(s, []);
    }
    const lost = JSON.parse(JSON.stringify(s)) as GameState;
    lost.company.runStatus = 'lost';
    lost.company.endReason = 'liquidated';
    lost.company.liquidationPath = 'p1Counter';
    const r = obs.finish(lost, null);
    expect(r).toMatchObject({
      lostTurn: 60,
      lossCause: 'liquidated',
      liquidationCause: 'p1Counter',
      runStatus: 'lost',
    });
    expect(r.byYear.map((y) => [y.year, y.turn, y.carried, y.netIncomeCents])).toEqual([
      [1, 51, false, 0],
      [2, 60, true, null],
      [3, 60, true, null],
    ]);
    expect([bN(r, 1), bN(r, 2), bN(r, 3)]).toEqual([true, false, false]);
    expect([bkN(r, 1), bkN(r, 2)]).toEqual([false, true]);
    expect(liquidationCauseBy(r, 2)).toBe('p1Counter');
  });

  it('marks a harness abort and leaves later years unmeasured', () => {
    let s = newGame(setupForCell(CELL), '1');
    const obs = new GameObserver(identity(2), s);
    for (let w = 1; w <= 20; w++) {
      s = advanceWeek(s).state;
      obs.week(s, []);
    }
    obs.rejected('OPTION_INVALID');
    const r = obs.finish(s, { reason: 'blockingDecisionUnanswered', turn: 20 });
    expect(r).toMatchObject({
      abortReason: 'blockingDecisionUnanswered',
      abortedTurn: 20,
      rejectedActions: 1,
      rejectionsByCode: { OPTION_INVALID: 1 },
    });
    expect([bN(r, 1), bN(r, 2)]).toEqual([null, null]);
  });
});
