// Period totals from the company journal (DESIGN §11 11.19, used by §2's annual rollup). P0 reads the detailed txns
// only; from P1, periods older than the 52-week detail window are read from the monthly summaries (§11 11.1).
import { cents, type Cents } from '../../core/money';
import { accountDef } from './accounts';
import type { FinanceSlice } from './types';

export interface PeriodTotals {
  /** Gold revenue (credit balance of rev.gold), positive. */
  revenueCents: Cents;
  /** Income minus expenses on the company book, positive for a profit. */
  netIncomeCents: Cents;
}

/** Totals of company txns dated fromTurn … toTurn inclusive. */
export function periodTotals(finance: FinanceSlice, fromTurn: number, toTurn: number): PeriodTotals {
  let revenue = 0;
  let net = 0;
  for (const txn of finance.books.company.txns) {
    if (txn.date < fromTurn || txn.date > toTurn) continue;
    for (const line of txn.lines) {
      const signed = (line.debit ?? 0) - (line.credit ?? 0);
      const cls = accountDef(line.account)?.cls;
      if (cls === 'income' || cls === 'expense') net -= signed;
      if (line.account === 'rev.gold') revenue -= signed;
    }
  }
  return { revenueCents: cents(revenue), netIncomeCents: cents(net) };
}
