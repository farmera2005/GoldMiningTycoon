// explain.cash (DESIGN §2.8, §13 13.24 P0 "minimal explain (cash → ledger)"): cash on hand as a sum over the cash
// accounts, each as a sum of the ledger postings that touched it (monthly summary rows first, then the detailed
// journal in posting order). Every leaf links to its transaction, so the explanation is the ledger itself.
import type { CalcNode } from '../core/calc';
import { centsToUsd, type Cents } from '../core/money';
import { turnToYearWeek } from '../core/calendar';
import type { GameState } from '../state/types';
import type { AccountCode } from '../systems/finance/accounts';
import { accountBalance } from '../systems/finance/ledger';
import { cashOnHandCents } from '../systems/finance/netWorth';
import type { LedgerBook } from '../systems/finance/types';

/** The cash accounts that make up cash on hand (§11 11.2: operating + reserve; restricted cash is excluded). */
export const CASH_ON_HAND_ACCOUNTS: readonly AccountCode[] = ['cash.operating', 'cash.reserve'];

function weekLabel(turn: number): string {
  const { year, week } = turnToYearWeek(turn);
  return `Y${year} Wk ${week}`;
}

/** One account's balance as the sum of its summary rows and postings (debit-positive, in USD). */
export function explainAccount(book: LedgerBook, account: AccountCode): CalcNode {
  const children: CalcNode[] = [];
  for (const summary of book.monthly) {
    let net = 0;
    for (const row of summary.rows) if (row.account === account) net += row.debitCents - row.creditCents;
    if (net !== 0) {
      children.push({
        label: `Summary ${summary.year}-${String(summary.month).padStart(2, '0')}`,
        value: centsToUsd(net as Cents),
        unit: 'usd',
        note: 'Balance-preserving monthly summary of older postings (§11 11.1)',
      });
    }
  }
  for (const txn of book.txns) {
    let net = 0;
    let touched = false;
    for (const line of txn.lines) {
      if (line.account !== account) continue;
      touched = true;
      net += (line.debit ?? 0) - (line.credit ?? 0);
    }
    if (!touched) continue;
    children.push({
      label: txn.memo,
      value: centsToUsd(net as Cents),
      unit: 'usd',
      source: { kind: 'entity', ref: { kind: 'ledgerTxn', id: txn.id } },
      note: `${txn.source} · ${weekLabel(txn.date)}`,
    });
  }
  const node: CalcNode = { label: account, value: centsToUsd(accountBalance(book, account)), unit: 'usd', op: 'sum' };
  if (children.length > 0) node.children = children;
  return node;
}

/** Cash on hand → cash accounts → ledger postings. */
export function explainCash(state: GameState): CalcNode {
  const book = state.finance.books.company;
  const children = CASH_ON_HAND_ACCOUNTS.filter(
    (a) => accountBalance(book, a) !== 0 || book.txns.some((t) => t.lines.some((l) => l.account === a)),
  ).map((a) => explainAccount(book, a));
  const node: CalcNode = {
    label: 'Cash on hand',
    value: centsToUsd(cashOnHandCents(state.finance)),
    unit: 'usd',
    op: 'sum',
    note: 'Operating and reserve accounts; restricted cash is excluded (§11 11.2)',
  };
  if (children.length > 0) node.children = children;
  return node;
}
