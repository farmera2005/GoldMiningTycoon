// The minimal ledger view behind `ledger` ExplainRefs and ledger source chips (DESIGN §13.13 "ledger opens the
// filtered ledger", 13.24 P0 "cash → ledger"). A pure filter over the posted transactions, which are player-visible;
// amounts stay integer cents because the ledger is the record of account (D-13.13).
import { select, type Book, type GameState, type LedgerFilter, type Txn } from '../../engine';
import { yearWeek } from '../format';

export interface LedgerRow {
  readonly book: Book;
  readonly txnId: string;
  readonly turn: number;
  readonly memo: string;
  readonly source: string;
  readonly account: string;
  readonly debitCents: number;
  readonly creditCents: number;
}

/** Balance-preserving monthly summary rows (§11 11.1, from P1), matched by account only. */
export interface LedgerSummaryRow {
  readonly book: Book;
  readonly label: string;
  readonly account: string;
  readonly debitCents: number;
  readonly creditCents: number;
}

export interface LedgerQuery {
  readonly rows: readonly LedgerRow[];
  readonly summaries: readonly LedgerSummaryRow[];
  /** Σ debits − Σ credits of the matched lines (a cash account's movement, debit-positive). */
  readonly netCents: number;
}

/** §11 LedgerFilter account match: an exact code, or a family prefix ending in '.' (`cash.`, `debt.`). */
export function accountMatches(account: string, patterns: readonly string[] | undefined): boolean {
  if (patterns === undefined) return true;
  return patterns.some((p) => (p.endsWith('.') ? account.startsWith(p) : account === p));
}

function txnMatches(txn: Txn, filter: LedgerFilter): boolean {
  if (filter.fromTurn !== undefined && txn.date < filter.fromTurn) return false;
  if (filter.toTurn !== undefined && txn.date > filter.toTurn) return false;
  if (filter.claimId !== undefined && !txn.lines.some((l) => l.dims?.claimId === filter.claimId)) return false;
  return true;
}

const BOOKS: readonly Book[] = ['company', 'owner'];

/** The postings a filter selects, in posting order, with their net. A filter without `book` reads the company book. */
export function queryLedger(state: GameState, filter: LedgerFilter): LedgerQuery {
  const book: Book = filter.book ?? 'company';
  const ledger = state.finance.books[book];
  const rows: LedgerRow[] = [];
  for (const txn of ledger.txns) {
    if (!txnMatches(txn, filter)) continue;
    for (const line of txn.lines) {
      if (!accountMatches(line.account, filter.accounts)) continue;
      if (filter.claimId !== undefined && line.dims?.claimId !== filter.claimId) continue;
      rows.push({
        book,
        txnId: txn.id,
        turn: txn.date,
        memo: txn.memo,
        source: txn.source,
        account: line.account,
        debitCents: line.debit ?? 0,
        creditCents: line.credit ?? 0,
      });
    }
  }
  // Summaries cover whole months of older detail; with a turn window they are left out rather than guessed at.
  const summaries: LedgerSummaryRow[] = [];
  if (filter.fromTurn === undefined && filter.toTurn === undefined && filter.claimId === undefined) {
    for (const month of ledger.monthly) {
      for (const row of month.rows) {
        if (!accountMatches(row.account, filter.accounts)) continue;
        summaries.push({
          book,
          label: `Summary ${month.year}-${String(month.month).padStart(2, '0')}`,
          account: row.account,
          debitCents: row.debitCents,
          creditCents: row.creditCents,
        });
      }
    }
  }
  let net = 0;
  for (const r of [...summaries, ...rows]) net += r.debitCents - r.creditCents;
  return { rows, summaries, netCents: net };
}

/** The transaction behind a ledger source chip (`entity` ref of kind `ledgerTxn`), in either book. */
export function findTxn(state: GameState, txnId: string): { readonly book: Book; readonly txn: Txn } | null {
  for (const book of BOOKS) {
    const txn = state.finance.books[book].txns.find((t) => t.id === txnId);
    if (txn !== undefined) return { book, txn };
  }
  return null;
}

/** `Company ledger · cash.operating, cash.reserve · Y1 Wk 2`. */
export function describeLedgerFilter(state: GameState, filter: LedgerFilter): string {
  const parts = [`${filter.book === 'owner' ? 'Owner' : 'Company'} ledger`];
  if (filter.accounts !== undefined) parts.push(filter.accounts.join(', '));
  const week = (turn: number): string => {
    const v = select.dateView(state, turn);
    return yearWeek(v.year, v.week);
  };
  const { fromTurn, toTurn } = filter;
  if (fromTurn !== undefined && toTurn !== undefined) {
    parts.push(fromTurn === toTurn ? week(fromTurn) : `${week(fromTurn)}–${week(toTurn)}`);
  } else if (fromTurn !== undefined) {
    parts.push(`from ${week(fromTurn)}`);
  } else if (toTurn !== undefined) {
    parts.push(`to ${week(toTurn)}`);
  }
  if (filter.claimId !== undefined) parts.push(filter.claimId);
  return parts.join(' · ');
}
