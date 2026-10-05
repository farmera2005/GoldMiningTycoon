// §11 finance slice of GameState (DESIGN §11 11.1, 11.23 `FinanceSlice`). P0 carries the two double-entry books and
// the liquidation flag that step 16d reads; bills, payroll, loans, credit, insurance, tax and the rest of the frame
// arrive with §11's phases (11.24). P0 saves are not loaded by later phases (D-2.34), so the slice grows freely.
import type { Cents } from '../../core/money';
import type { ClaimId, EmployeeId, EntityRef, LoanId, LotId, MachineId, TxnId } from '../../core/ids';
import type { AccountCode, Book } from './accounts';

export type { AccountCode, Book } from './accounts';

export type CostCenter = 'site' | 'ga' | 'prospecting' | 'reclaim' | 'capital';

export interface PostingDims {
  claimId?: ClaimId;
  machineId?: MachineId;
  employeeId?: EmployeeId;
  lotId?: LotId;
  loanId?: LoanId;
  costCenter?: CostCenter;
}

/** One line of a posting: exactly one of debit or credit, a positive integer number of cents (§11 11.1). */
export interface PostingLine {
  account: AccountCode;
  debit?: Cents;
  credit?: Cents;
  dims?: PostingDims;
}

export interface PostingEntry {
  /** Default 'company'. */
  book?: Book;
  /** The turn the entry is dated. */
  date: number;
  lines: PostingLine[];
  memo: string;
  refs: EntityRef[];
  /** '§7/fuel', '§11/payroll', … */
  source: string;
  counterparty?: string;
}

/** A posted transaction. `seq` is the txn counter value (the numeric part of `id`), unique across both books. */
export interface Txn extends PostingEntry {
  id: TxnId;
  seq: number;
}

/** §11 11.1 balance-preserving month summary of compacted detail (compaction ships in P1 with 52 weeks of detail). */
export interface MonthlySummary {
  year: number;
  month: number;
  rows: {
    account: AccountCode;
    costCenter?: CostCenter;
    claimId?: ClaimId;
    cf: 'O' | 'I' | 'F' | 'X';
    debitCents: Cents;
    creditCents: Cents;
  }[];
}

/** One book. `balances` are signed debit-positive cents (Σ debits − Σ credits) per account. */
export interface LedgerBook {
  txns: Txn[];
  balances: Record<AccountCode, Cents>;
  monthly: MonthlySummary[];
}

/** §11 `queryLedger` filter (P0 subset; §13's `ledger` ExplainRef carries one). Every field set must match. */
export interface LedgerFilter {
  book?: Book;
  /** Exact account codes, or family prefixes ending in '.' (e.g. 'cash.', 'debt.'). */
  accounts?: AccountCode[];
  fromTurn?: number;
  toTurn?: number;
  claimId?: ClaimId;
}

/** §11 `distress.liquidation`: set by step 15 (or a filing); §1 step 16d ends the run on it. */
export interface LiquidationFlag {
  cause: 'filed' | 'involuntary' | 'converted' | 'p1Counter';
  turn: number;
}

/** P0 subset of §11 `DistressState`. */
export interface DistressState {
  liquidation: LiquidationFlag | null;
}

export interface FinanceSlice {
  books: Record<Book, LedgerBook>;
  distress: DistressState;
}

export function emptyLedgerBook(): LedgerBook {
  return { txns: [], balances: {}, monthly: [] };
}

export function emptyFinanceSlice(): FinanceSlice {
  return { books: { company: emptyLedgerBook(), owner: emptyLedgerBook() }, distress: { liquidation: null } };
}
