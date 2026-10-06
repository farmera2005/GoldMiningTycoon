// The observer's timeline: year ends at week 52, a run that ends early carries its last state forward, a liquidation
// records its cause, and stops and minimum cash are counted by week.
import { describe, expect, it } from 'vitest';
import { advanceWeek, newGame, type GameState, type StopReason } from '../../src/engine';
import { setupForCell } from '../setup';
import { FirstClaimTracker, GameObserver, type YearEnd } from './gameResult';
import { aggregateCell } from './aggregate';
import { bN, bkN, firstSeasonProfit, liquidationCauseBy, sN } from './survival';

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

/** A P0-rules game (the P0 measurement contract) and the build's P1 game. */
const p0Game = (seed: string): GameState => newGame(setupForCell(CELL), seed, undefined, { rulesPhase: 0 });

function withCash(state: GameState, cents: number): GameState {
  const s = JSON.parse(JSON.stringify(state)) as GameState;
  const company = s.finance.books.company;
  company.balances['cash.operating'] = cents as never;
  return s;
}

describe('GameObserver', () => {
  it('closes each year at week 52 and records a quiet P0 year', () => {
    let s = p0Game('1');
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

  it('records a quiet P1 year: production measured as zero, net income before the rollup is written (s02 #9)', () => {
    let s = newGame(setupForCell(CELL), '1');
    expect(s.meta.rulesPhase).toBe(1);
    const obs = new GameObserver({ ...identity(1), rules: 1 }, s);
    for (let w = 0; w < 51; w++) {
      s = advanceWeek(s).state;
      obs.week(s, []);
    }
    const r = obs.finish(s, null);
    expect(s.history.annual).toHaveLength(0);
    expect(r.byYear[0]).toMatchObject({
      year: 1,
      turn: 51,
      ownerNwCents: 52_000_000,
      netIncomeCents: 0,
      washedBcy: 0,
      weighedRawOz: 0,
      fineOz: 0,
      claimsHeld: 0,
      fleetWashBcyHr: 0,
    });
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
    let s = p0Game('1');
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
    // Year 2 is measured through the loss (turns 52…60: no P&L postings in P0); year 3 was never reached.
    expect(r.byYear.map((y) => [y.year, y.turn, y.carried, y.netIncomeCents])).toEqual([
      [1, 51, false, 0],
      [2, 60, true, 0],
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

  /** A company-book posting in the journal (P0 has no income or expense postings of its own). */
  function withPnlTxn(state: GameState, date: number, account: string, cents: number): GameState {
    const s = JSON.parse(JSON.stringify(state)) as GameState;
    const book = s.finance.books.company;
    const income = !account.startsWith('exp.');
    book.txns.push({
      book: 'company',
      date,
      lines: income
        ? [
            { account: 'cash.operating', debit: cents },
            { account, credit: cents },
          ]
        : [
            { account, debit: cents },
            { account: 'cash.operating', credit: cents },
          ],
      memo: 'test',
      refs: [],
      source: 'test',
      id: `txn_9${book.txns.length}`,
      seq: book.txns.length + 1,
    } as never);
    return s;
  }

  function lostAt(turn: number, edit: (s: GameState) => GameState = (s) => s): ReturnType<GameObserver['finish']> {
    let s = newGame(setupForCell(CELL), '1');
    const obs = new GameObserver(identity(2), s);
    for (let w = 1; w <= turn; w++) {
      s = advanceWeek(s).state;
      obs.week(s, []);
    }
    const lost = JSON.parse(JSON.stringify(edit(s))) as GameState;
    lost.company.runStatus = 'lost';
    lost.company.endReason = 'liquidated';
    lost.company.liquidationPath = 'p1Counter';
    return obs.finish(lost, null);
  }

  it('measures a run liquidated in year 1 through the loss, so FSP is a boolean (BALANCE §5.6)', () => {
    const loss = lostAt(30, (s) => withPnlTxn(s, 20, 'exp.fuel', 250_000));
    expect(loss.byYear[0]).toMatchObject({ year: 1, turn: 30, carried: true, netIncomeCents: -250_000 });
    expect(loss.byYear[1]).toMatchObject({ year: 2, carried: true, netIncomeCents: null });
    expect(loss.unsoldGoldChangeY1Cents).toBe(0);
    expect(firstSeasonProfit(loss)).toBe(false);
    // Income and expense both count.
    const gain = lostAt(30, (s) => withPnlTxn(withPnlTxn(s, 25, 'rev.gold', 400_000), 28, 'exp.camp', 100_000));
    expect(gain.byYear[0]?.netIncomeCents).toBe(300_000);
    expect(firstSeasonProfit(gain)).toBe(true);
    // In a cell, the loss stays in FSP's denominator next to a profitable survivor.
    const survivor = { ...loss, runStatus: 'active' as const, lossCause: null, lostTurn: null, finalTurn: 103 };
    survivor.byYear = [{ ...(loss.byYear[0] as YearEnd), carried: false, turn: 51, netIncomeCents: 1 }];
    expect(aggregateCell([loss, survivor], 2, { cellKey: 'fsp', resamples: 20 }).fsp).toMatchObject({ k: 1, n: 2 });
  });

  it('leaves a year-1 harness abort unmeasured', () => {
    let s = newGame(setupForCell(CELL), '1');
    const obs = new GameObserver(identity(1), s);
    for (let w = 1; w <= 12; w++) {
      s = advanceWeek(s).state;
      obs.week(s, []);
    }
    const r = obs.finish(s, { reason: 'blockingDecisionUnanswered', turn: 12 });
    expect(r.byYear[0]?.netIncomeCents).toBeNull();
    expect(r.unsoldGoldChangeY1Cents).toBeNull();
    expect(firstSeasonProfit(r)).toBeNull();
  });

  it('observes holdings after actions and weeks; a P0 game holds no claim, so its district is null', () => {
    let s = newGame(setupForCell(CELL), '1');
    const obs = new GameObserver(identity(1), s);
    obs.actionApplied(s);
    s = advanceWeek(s).state;
    obs.week(s, []);
    expect(obs.finish(s, null).district).toBeNull();
  });
});

describe('FirstClaimTracker (BALANCE O-16, §6.6 district)', () => {
  const N = 'dst_000001';
  const A = 'dst_000002';

  it('records the district of the first claim acquired during play, not the turn-0 holdings', () => {
    const t = new FirstClaimTracker();
    t.observe([]); // setup: a Bootstrapper holds nothing
    t.observe([]);
    expect(t.districtId).toBeNull();
    t.observe([{ claimId: 'clm_000040', districtId: A }]); // week 3: leases an arid claim
    t.observe([
      { claimId: 'clm_000040', districtId: A },
      { claimId: 'clm_000007', districtId: N },
    ]); // later buys a northern one (lower id)
    t.observe([{ claimId: 'clm_000007', districtId: N }]); // and surrenders the arid lease
    t.observe([]);
    expect(t.districtId).toBe(A);
  });

  it('takes an Inheritor’s inherited claim at setup', () => {
    const t = new FirstClaimTracker();
    t.observe([{ claimId: 'clm_000011', districtId: N }]);
    t.observe([{ claimId: 'clm_000002', districtId: A }]);
    expect(t.districtId).toBe(N);
  });

  it('breaks a tie within one observation by claim id (§2.12.1)', () => {
    const t = new FirstClaimTracker();
    t.observe([
      { claimId: 'clm_000100', districtId: N },
      { claimId: 'clm_000099', districtId: A },
    ]);
    expect(t.districtId).toBe(A);
  });
});
