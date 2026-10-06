// §11 the owner's personal balances (DESIGN §11.20, §1 1.9; D-1.73; s01 #6; P1 contract §4.11). They are not stored on
// §1's Owner: they are the owner book's balances, published here and re-exported by §1. Liabilities carry credit
// balances, returned as positive amounts owed.
import { cents, type Cents } from '../../core/money';
import type { GameState } from '../../state/types';
import { accountBalance } from './ledger';
import { cashOnHandCents } from './netWorth';

export function ownerPersonalCash(state: GameState): Cents {
  return accountBalance(state.finance.books.owner, 'own.cash');
}

export function ownerLoanToCompany(state: GameState): Cents {
  return accountBalance(state.finance.books.owner, 'own.loanToCompany');
}

export function ownerPersonalDebt(state: GameState): Cents {
  return cents(-accountBalance(state.finance.books.owner, 'own.personalDebt'));
}

export function ownerGuaranteeDue(state: GameState): Cents {
  return cents(-accountBalance(state.finance.books.owner, 'own.guaranteeDue'));
}

export function ownerTaxDue(state: GameState): Cents {
  return cents(-accountBalance(state.finance.books.owner, 'own.taxDue'));
}

/** P1: the company's available liquidity is its cash on hand (lines and revolvers arrive in P4). */
export function availableLiquidity(state: GameState): Cents {
  return cashOnHandCents(state.finance);
}
