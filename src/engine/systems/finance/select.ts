// §11 finance selectors (DESIGN §2.11, §11.20, §11.23; P1 contract §4.11): pure readers over state, spread into `select`
// by select/index.ts. §11 holds no hidden field. A name already used by another folder fails the composition test.
import type { BillId, LoanId } from '../../core/ids';
import type { Cents } from '../../core/money';
import { sortedValues } from '../../core/iter';
import type { GameState } from '../../state/types';
import { distressStatus, dueThisWeek, forecast13Week, fundingPreview } from './forecast';
import { cashOnHandCents, companyNetWorthCents, netWorthCents, type NetWorthMode } from './netWorth';
import {
  availableLiquidity,
  ownerGuaranteeDue,
  ownerLoanToCompany,
  ownerPersonalCash,
  ownerPersonalDebt,
  ownerTaxDue,
} from './owner';
import {
  claimPnL,
  costPerOunce,
  incomeStatement,
  payrollSummary,
  periodNetIncome,
  queryLedger,
  spendByCategory,
} from './statements';
import type { Arrear, Bill, Loan, PayrollRegisterLine } from './types';

/** §11 cashOnHand: operating + reserve, excluding restricted cash. */
function cashOnHand(state: GameState): Cents {
  return cashOnHandCents(state.finance);
}

/**
 * §2.11 / §11 11.20 netWorth(state, mode); 'scoring' is §1 1.13's owner NW. Wave 0 keeps the P0 body: the P1 terms
 * (lots × netSalePerFineOz, Σ resaleEstimate, claims at cost, the §1 waterfall, the liquidated-run rule) come from
 * owners' readers that are 0 until they land, so the value is unchanged.
 */
function netWorth(state: GameState, mode: NetWorthMode): Cents {
  return netWorthCents(state.finance, state.meta.tuning, mode);
}

/** §1 1.13 companyNW. */
function companyNetWorth(state: GameState): Cents {
  return companyNetWorthCents(state.finance, state.meta.tuning);
}

/** Bills, all or one status, in id order. */
function bills(state: GameState, filter: { status?: Bill['status'] } = {}): Bill[] {
  return sortedValues(state.finance.bills).filter((b) => filter.status === undefined || b.status === filter.status);
}

function bill(state: GameState, billId: BillId): Bill | null {
  return state.finance.bills[billId] ?? null;
}

function arrears(state: GameState): Arrear[] {
  return sortedValues(state.finance.arrears);
}

function loans(state: GameState): Loan[] {
  return sortedValues(state.finance.loans);
}

function loan(state: GameState, loanId: LoanId): Loan | null {
  return state.finance.loans[loanId] ?? null;
}

/** The last 13 payroll runs (11.3). */
function payrollRegister(state: GameState): { turn: number; lines: PayrollRegisterLine[] }[] {
  return state.finance.payrollRegister.map((r) => ({ turn: r.turn, lines: [...r.lines] }));
}

export const financeSelectors = {
  cashOnHand,
  availableLiquidity,
  netWorth,
  companyNetWorth,
  dueThisWeek,
  periodNetIncome,
  forecast13Week,
  costPerOunce,
  claimPnL,
  incomeStatement,
  distressStatus,
  bills,
  bill,
  arrears,
  loans,
  loan,
  payrollSummary,
  payrollRegister,
  ownerPersonalCash,
  ownerLoanToCompany,
  ownerPersonalDebt,
  ownerGuaranteeDue,
  ownerTaxDue,
  fundingPreview,
  spendByCategory,
  queryLedger,
} as const;
