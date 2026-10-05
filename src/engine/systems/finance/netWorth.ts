// Cash and net worth from the ledger (DESIGN §11 11.20, §1 1.13). Only player-visible marks: ledger balances here; the
// lot, metal-account, machine-resale and forward-MTM terms of §1 1.13 come from §9 and §10 selectors once those
// systems hold state (P1+), and the equity waterfall from §1 once investors exist. Until then they are zero, which is
// exact for a P0 game (no lots, machines, forwards or investors exist).
import { assertNever } from '../../core/assert';
import { cents, roundHalfAway, type Cents } from '../../core/money';
import type { TuningResolved } from '../../../data/tuning';
import { accountDef, accountFamilyOf, type AccountCode } from './accounts';
import { accountBalance, sumBalances } from './ledger';
import type { FinanceSlice } from './types';

export type NetWorthMode = 'scoring' | 'book' | 'appraised';

/** Company accounts that §1 1.13 adds to companyNW at book value (cash, deposits, receivables, claims at cost). */
const SCORING_ASSETS_AT_BOOK: readonly AccountCode[] = [
  'cash.operating',
  'cash.reserve',
  'deposits.bonds',
  'prepaid',
  'ar.refinery',
  'ar.insurance',
  'ar.other',
  'inv.fuel',
  'mineral.properties',
  'mineral.accumDepletion',
];

/** §11 11.2: cash on hand = operating + reserve; restricted cash is excluded. */
export function cashOnHandCents(finance: FinanceSlice): Cents {
  const company = finance.books.company;
  return cents(accountBalance(company, 'cash.operating') + accountBalance(company, 'cash.reserve'));
}

/** Every company liability at carrying value (credit balances, returned as a positive amount owed). */
export function companyLiabilitiesCents(finance: FinanceSlice): Cents {
  return cents(-sumBalances(finance.books.company, (a) => accountDef(a)?.cls === 'liability'));
}

/**
 * §1 1.13 companyNW at player-visible marks, P0 form: cash (incl. restricted) + deposits + prepaid + receivables
 * + fuel at cost + parts × game.nw.partsResaleFactor + claims at cost − every liability.
 */
export function companyNetWorthCents(finance: FinanceSlice, tuning: TuningResolved): Cents {
  const company = finance.books.company;
  let total = 0;
  for (const account of SCORING_ASSETS_AT_BOOK) total += accountBalance(company, account);
  total += sumBalances(company, (a) => accountFamilyOf(a) === 'cash.restricted');
  const partsFactor = tuning['game.nw.partsResaleFactor'];
  total += roundHalfAway(accountBalance(company, 'inv.parts') * (typeof partsFactor === 'number' ? partsFactor : 0));
  total -= companyLiabilitiesCents(finance);
  return cents(total);
}

/** §11 11.20 owner NW: ownerShare (= companyNW with no equity holder) + own.cash − personal debts + loan to company. */
export function ownerNetWorthCents(finance: FinanceSlice, tuning: TuningResolved): Cents {
  const owner = finance.books.owner;
  const personal =
    accountBalance(owner, 'own.cash') +
    accountBalance(owner, 'own.loanToCompany') +
    accountBalance(owner, 'own.personalDebt') + // credit balances are negative, so adding subtracts the debt
    accountBalance(owner, 'own.guaranteeDue') +
    accountBalance(owner, 'own.taxDue');
  return cents(companyNetWorthCents(finance, tuning) + personal);
}

/** Total assets − liabilities on both books at book value (§11 11.20 'book': statement equity + owner equity). */
export function bookNetWorthCents(finance: FinanceSlice): Cents {
  let total = 0;
  for (const name of ['company', 'owner'] as const) {
    total += sumBalances(finance.books[name], (a) => {
      const cls = accountDef(a)?.cls;
      return cls === 'asset' || cls === 'contraAsset' || cls === 'liability';
    });
  }
  return cents(total);
}

/**
 * `netWorth(state, mode)` (§2.11, §11 11.20). 'scoring' is the owner's NW of §1 1.13; 'appraised' equals 'scoring'
 * until §4/§5 can mark claims at the player's P50 (P1); 'book' is assets − liabilities on both books.
 */
export function netWorthCents(finance: FinanceSlice, tuning: TuningResolved, mode: NetWorthMode): Cents {
  switch (mode) {
    case 'scoring':
    case 'appraised':
      return ownerNetWorthCents(finance, tuning);
    case 'book':
      return bookNetWorthCents(finance);
    default:
      return assertNever(mode, 'netWorth mode');
  }
}
