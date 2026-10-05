// The posting core (DESIGN §11 11.1). Cash changes only through ledger postings; every posting balances in integer
// cents; no `cash.*` account (or the owner's personal cash) may go negative. A violation is an engine bug, never a game
// state, so it throws (§11: "sections must go through pay/bill"). Callers compute in floats and round each line with
// roundCents before posting (D-2.2).
import { produceState } from '../../state/immutability';
import { nextId, parseId, type IdPrefix, type TxnId } from '../../core/ids';
import { cents, type Cents } from '../../core/money';
import { sortedKeys } from '../../core/iter';
import { accountDef, type AccountCode, type Book } from './accounts';
import type { FinanceSlice, LedgerBook, PostingEntry, PostingLine, Txn } from './types';

export type LedgerErrorCode =
  | 'LEDGER_EMPTY'
  | 'LEDGER_UNBALANCED'
  | 'ACCOUNT_UNKNOWN'
  | 'ACCOUNT_BOOK_MISMATCH'
  | 'AMOUNT_INVALID'
  | 'DATE_INVALID'
  | 'CASH_NEGATIVE';

export class LedgerError extends Error {
  readonly code: LedgerErrorCode;

  constructor(code: LedgerErrorCode, message: string) {
    super(`${code}: ${message}`);
    this.name = 'LedgerError';
    this.code = code;
  }
}

/** The parts of GameState a posting touches (structural, so the ledger does not depend on the state module). */
export interface LedgerHost {
  ids: Partial<Record<IdPrefix, number>>;
  finance: FinanceSlice;
}

function isPositiveCents(v: unknown): v is Cents {
  return typeof v === 'number' && Number.isSafeInteger(v) && v > 0;
}

/** Signed debit-positive amount of a line, after checking it carries exactly one positive side. */
function lineAmount(line: PostingLine, index: number): number {
  const hasDebit = line.debit !== undefined;
  const hasCredit = line.credit !== undefined;
  if (hasDebit === hasCredit) {
    throw new LedgerError('AMOUNT_INVALID', `line ${index} (${line.account}) needs exactly one of debit or credit`);
  }
  const amount = hasDebit ? line.debit : line.credit;
  if (!isPositiveCents(amount)) {
    throw new LedgerError('AMOUNT_INVALID', `line ${index} (${line.account}) must be a positive integer of cents`);
  }
  return hasDebit ? amount : -amount;
}

/** Validates an entry and returns its net debit-positive delta per account (no state is touched). */
export function entryDeltas(e: PostingEntry): { book: Book; deltas: Record<AccountCode, number> } {
  const book: Book = e.book ?? 'company';
  if (!Number.isSafeInteger(e.date)) throw new LedgerError('DATE_INVALID', `date must be a turn, got ${e.date}`);
  if (e.lines.length === 0) throw new LedgerError('LEDGER_EMPTY', `"${e.memo}" has no lines`);
  const deltas: Record<AccountCode, number> = {};
  let net = 0;
  e.lines.forEach((line, i) => {
    const def = accountDef(line.account);
    if (def === null) throw new LedgerError('ACCOUNT_UNKNOWN', `line ${i}: ${line.account} is not in the chart`);
    if (def.book !== book) {
      throw new LedgerError('ACCOUNT_BOOK_MISMATCH', `line ${i}: ${line.account} belongs to the ${def.book} book`);
    }
    const amount = lineAmount(line, i);
    net += amount;
    deltas[line.account] = (deltas[line.account] ?? 0) + amount;
  });
  if (net !== 0) throw new LedgerError('LEDGER_UNBALANCED', `"${e.memo}" debits − credits = ${net} cents`);
  return { book, deltas };
}

function cloneEntry(e: PostingEntry, book: Book): PostingEntry {
  // A deep copy, so freezing the posted txn never freezes the caller's objects.
  const copy = JSON.parse(JSON.stringify(e)) as PostingEntry;
  copy.book = book;
  return copy;
}

/**
 * Posts an entry into a mutable host (an Immer draft of GameState, or a state under construction) and returns the
 * new txn id. Checks everything before mutating, so a throw leaves the host untouched.
 */
export function postInto(host: LedgerHost, e: PostingEntry): TxnId {
  const { book, deltas } = entryDeltas(e);
  const ledger = host.finance.books[book];
  for (const account of sortedKeys(deltas)) {
    const def = accountDef(account);
    const next = (ledger.balances[account] ?? 0) + (deltas[account] as number);
    if (def?.cash === true && next < 0) {
      throw new LedgerError('CASH_NEGATIVE', `"${e.memo}" would take ${account} to ${next} cents`);
    }
  }
  const id = nextId(host.ids, 'txn');
  const seq = (parseId(id) as { num: number }).num;
  const txn: Txn = { ...cloneEntry(e, book), id, seq };
  ledger.txns.push(txn);
  for (const account of sortedKeys(deltas)) {
    ledger.balances[account] = cents((ledger.balances[account] ?? 0) + (deltas[account] as number));
  }
  return id;
}

/** §11 `post`: the pure form. Returns the new state and the txn id. */
export function post<S extends LedgerHost>(state: S, e: PostingEntry): { state: S; txnId: TxnId } {
  let txnId: TxnId | null = null;
  const next = produceState(state, (draft) => {
    txnId = postInto(draft, e);
  });
  return { state: next, txnId: txnId as unknown as TxnId };
}

/** Balance of one account in debit-positive cents (0 when never posted). */
export function accountBalance(book: LedgerBook, account: AccountCode): Cents {
  return book.balances[account] ?? cents(0);
}

/** Σ balances over the accounts matching a predicate (debit-positive). */
export function sumBalances(book: LedgerBook, match: (account: AccountCode) => boolean): Cents {
  let total = 0;
  for (const account of sortedKeys(book.balances)) {
    if (match(account)) total += book.balances[account] as number;
  }
  return cents(total);
}

/** Recomputes a book's balances from its monthly summaries and detailed journal (§11: a test recomputes them). */
export function recomputeBalances(book: LedgerBook): Record<AccountCode, number> {
  const out: Record<AccountCode, number> = {};
  for (const summary of book.monthly) {
    for (const row of summary.rows) out[row.account] = (out[row.account] ?? 0) + row.debitCents - row.creditCents;
  }
  for (const txn of book.txns) {
    for (const line of txn.lines) {
      out[line.account] = (out[line.account] ?? 0) + (line.debit ?? 0) - (line.credit ?? 0);
    }
  }
  return out;
}

/**
 * The first integrity problem in the finance slice, or null: every book sums to zero, every cached balance equals the
 * recomputation, every txn balances, no cash account is negative, and txn ids ascend.
 */
export function ledgerProblem(finance: FinanceSlice): string | null {
  for (const bookName of ['company', 'owner'] as const) {
    const book = finance.books[bookName];
    if (book === undefined) return `finance.books.${bookName} is missing`;
    let lastSeq = 0;
    for (const txn of book.txns) {
      if (txn.seq <= lastSeq) return `${bookName} txn ${txn.id} is out of order`;
      lastSeq = txn.seq;
      try {
        const { book: txnBook } = entryDeltas(txn);
        if (txnBook !== bookName) return `${txn.id} is posted to the wrong book`;
      } catch (e) {
        return `${txn.id}: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
    const recomputed = recomputeBalances(book);
    let total = 0;
    for (const account of sortedKeys({ ...recomputed, ...book.balances })) {
      const cached = book.balances[account] ?? 0;
      const fresh = recomputed[account] ?? 0;
      if (cached !== fresh) return `${bookName} ${account}: cached ${cached} ≠ recomputed ${fresh}`;
      if (accountDef(account)?.cash === true && cached < 0) return `${bookName} ${account} is negative`;
      total += cached;
    }
    if (total !== 0) return `${bookName} book does not balance (Σ = ${total})`;
  }
  return null;
}
