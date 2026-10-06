// The observer's journal read for a run's partial last year (BALANCE §5.6) must agree with the engine's own §11
// period totals: the same accounts, the same sign. This test may read engine internals to check the adapter against
// them; the adapter itself stays on the public surface (sim/architecture.test.ts).
import { describe, expect, it } from 'vitest';
import { defaultNewGameSetup, newGame, type GameState } from '../../src/engine';
import { produceState } from '../../src/engine/state/immutability';
import { ACCOUNT_FAMILIES, ACCOUNTS } from '../../src/engine/systems/finance/accounts';
import { postInto } from '../../src/engine/systems/finance/ledger';
import { periodTotals } from '../../src/engine/systems/finance/periods';
import { EXPENSE_CODE_PREFIXES, INCOME_CODE_PREFIXES, netIncomeThroughCents } from './observe';

const isIncome = (code: string) => INCOME_CODE_PREFIXES.some((p) => code.startsWith(p));
const isExpense = (code: string) => EXPENSE_CODE_PREFIXES.some((p) => code.startsWith(p));

describe('netIncomeThroughCents (BALANCE §5.6 partial year)', () => {
  it('classifies exactly the chart’s company income and expense accounts (§11 11.2)', () => {
    for (const [code, def] of Object.entries(ACCOUNTS)) {
      if (def.book !== 'company') {
        expect(isIncome(code) || isExpense(code), code).toBe(false);
        continue;
      }
      expect(isIncome(code), code).toBe(def.cls === 'income');
      expect(isExpense(code), code).toBe(def.cls === 'expense');
    }
    for (const [family, def] of Object.entries(ACCOUNT_FAMILIES)) {
      expect(def.cls === 'income' || def.cls === 'expense', family).toBe(false);
      expect(isIncome(`${family}.x`) || isExpense(`${family}.x`), family).toBe(false);
    }
  });

  it('equals the engine’s period totals over any window', () => {
    let s: GameState = newGame(defaultNewGameSetup({ companyName: 'Journal Test' }), '9');
    const post = (date: number, debit: string, credit: string, cents: number) => {
      s = produceState(s, (draft) => {
        postInto(draft, {
          date,
          lines: [
            { account: debit, debit: cents as never },
            { account: credit, credit: cents as never },
          ],
          memo: 'test',
          refs: [],
          source: 'test',
        });
      });
    };
    post(3, 'cash.operating', 'rev.gold', 900_000);
    post(5, 'exp.fuel', 'cash.operating', 120_000);
    post(9, 'exp.depreciation', 'ppe.accumDep', 40_000);
    post(12, 'cash.operating', 'gain.assetSale', 15_000);
    post(14, 'exp.wages', 'cash.operating', 333_333);
    for (const [from, to] of [
      [0, 51],
      [0, 8],
      [4, 12],
      [10, 30],
    ] as const) {
      const engine = periodTotals(s.finance, from, to).netIncomeCents;
      expect(netIncomeThroughCents(s, from, to), `${from}…${to}`).toBe(engine);
    }
    expect(netIncomeThroughCents(s, 0, 51)).toBe(900_000 - 120_000 - 40_000 + 15_000 - 333_333);
  });
});
