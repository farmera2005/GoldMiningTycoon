import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyAction } from '../actions/apply';
import { asAction, registerTestActions } from '../actions/testActions';
import type { CalcNode } from '../core/calc';
import { explain } from '../explain';
import { newGame } from '../state/newGame';
import { defaultNewGameSetup } from '../state/setup';
import type { GameState } from '../state/types';
import { select } from '.';

let unregister: () => void;
beforeAll(() => {
  unregister = registerTestActions();
});
afterAll(() => unregister());

// newGame is deterministic and states are immutable, so one start state serves every test (world generation is slow).
const BASE = newGame(defaultNewGameSetup({ companyName: 'Select Test' }), 'select');
const fresh = (): GameState => BASE;

function sumChildren(n: CalcNode): number {
  return (n.children ?? []).reduce((a, c) => a + c.value, 0);
}

describe('selectors (DESIGN §2.11)', () => {
  it('dateView follows §1 1.3: turn 28 → Y1 Wk 29 · Jul 16–22, 2027; turn 60 → Y2 Wk 9 · Feb 26–Mar 4, 2028', () => {
    const s = fresh();
    expect(select.dateView(s, 28)).toEqual({
      turn: 28,
      year: 1,
      week: 29,
      displayYear: 2027,
      start: { month: 7, day: 16 },
      end: { month: 7, day: 22 },
    });
    expect(select.dateView(s, 60)).toMatchObject({
      year: 2,
      week: 9,
      displayYear: 2028,
      start: { month: 2, day: 26 },
      end: { month: 3, day: 4 },
    });
    expect(select.dateView(s)).toMatchObject({
      turn: 0,
      year: 1,
      week: 1,
      start: { month: 1, day: 1 },
      end: { month: 1, day: 7 },
    });
  });

  it('cash on hand, scoring and company net worth for a fresh Bootstrapper', () => {
    const s = fresh();
    expect(select.cashOnHand(s)).toBe(40_000_000);
    expect(select.companyNetWorth(s)).toBe(40_000_000);
    expect(select.netWorth(s, 'scoring')).toBe(52_000_000);
    expect(select.spotUsdPerFineOz(s)).toBe(4200);
    expect(select.runStatus(s)).toBe('active');
    expect(select.canAdvance(s)).toBeNull();
    expect(select.weeklyHistory(s)).toHaveLength(157);
  });
});

describe('explainers (DESIGN §2.8; §13 P0 "explain cash → ledger")', () => {
  it('explains cash as cash accounts over their postings, each leaf linked to its transaction', () => {
    let s = fresh();
    const r = applyAction(s, asAction({ type: 'test/transfer', cents: 2_500_000 }));
    if (!r.ok) throw new Error(r.error.code);
    s = r.state;
    const tree = explain.cash(s);
    expect(tree).toMatchObject({ label: 'Cash on hand', value: 400_000, unit: 'usd', op: 'sum' });
    expect(tree.children?.map((c) => [c.label, c.value])).toEqual([
      ['cash.operating', 375_000],
      ['cash.reserve', 25_000],
    ]);
    expect(sumChildren(tree)).toBe(tree.value);
    const operating = tree.children?.[0] as CalcNode;
    expect(sumChildren(operating)).toBe(operating.value);
    expect(operating.children?.map((c) => [c.label, c.value, c.source])).toEqual([
      ['Owner capital contribution', 400_000, { kind: 'entity', ref: { kind: 'ledgerTxn', id: 'txn_000001' } }],
      ['Test transfer', -25_000, { kind: 'entity', ref: { kind: 'ledgerTxn', id: 'txn_000003' } }],
    ]);
  });

  it('explains scoring net worth with the same total as the selector', () => {
    const s = fresh();
    const tree = explain.netWorth(s);
    expect(tree.value * 100).toBe(select.netWorth(s, 'scoring'));
    expect(sumChildren(tree)).toBe(tree.value);
    const company = tree.children?.[0] as CalcNode;
    expect(company.label).toBe('Company net worth');
    expect(sumChildren(company)).toBe(company.value);
  });
});

describe('run outcome and annual history (DESIGN §1 1.14, §2.5)', () => {
  it('an active new game has no end reason or liquidation path and no completed year', () => {
    expect(select.runOutcome(fresh())).toEqual({ runStatus: 'active', endReason: null, liquidationPath: null });
    expect(select.annualHistory(fresh())).toEqual([]);
  });
  it('reads the company slice as stored', () => {
    const s = {
      ...BASE,
      company: { ...BASE.company, runStatus: 'lost', endReason: 'liquidated', liquidationPath: 'p1Counter' },
    } as GameState;
    expect(select.runOutcome(s)).toEqual({ runStatus: 'lost', endReason: 'liquidated', liquidationPath: 'p1Counter' });
  });
});
