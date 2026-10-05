import { describe, expect, it } from 'vitest';
import { baseTuning, type TuningResolved } from '../../../data/tuning';
import type { Cents } from '../../core/money';
import { postInto, type LedgerHost } from './ledger';
import {
  bookNetWorthCents,
  cashOnHandCents,
  companyLiabilitiesCents,
  companyNetWorthCents,
  netWorthCents,
  ownerNetWorthCents,
} from './netWorth';
import { emptyFinanceSlice, type PostingLine } from './types';

const tuning = baseTuning as unknown as TuningResolved;
const c = (n: number): Cents => n as Cents;

function post(h: LedgerHost, lines: PostingLine[], book: 'company' | 'owner' = 'company'): void {
  postInto(h, { book, date: 0, lines, memo: 'fixture', refs: [], source: 'test' });
}

/**
 * Hand-computed fixture (§1 1.13, P0 form; amounts in dollars):
 *   cash.operating 292,000 · cash.reserve 8,000 · cash.restricted.bond 6,000 · prepaid 1,500 · inv.parts 10,000 (× 0.6)
 *   · inv.fuel 2,000 · mineral.properties 15,000 · ppe.equipment 231,000 (book; resale is §9's, not in P0)
 *   − ap.vendors 11,000 − liab.reclamation 9,000 − debt.loan_000001 50,000
 *   companyNW = 292,000 + 8,000 + 6,000 + 1,500 + 6,000 + 2,000 + 15,000 − 70,000 = 260,500
 *   owner: own.cash 120,000 − own.personalDebt 3,000 ⇒ ownerNW = 260,500 + 117,000 = 377,500
 */
function fixture(): LedgerHost {
  const h: LedgerHost = { ids: {}, finance: emptyFinanceSlice() };
  post(h, [
    { account: 'cash.operating', debit: c(29_200_000) },
    { account: 'cash.reserve', debit: c(800_000) },
    { account: 'cash.restricted.bond', debit: c(600_000) },
    { account: 'prepaid', debit: c(150_000) },
    { account: 'inv.parts', debit: c(1_000_000) },
    { account: 'inv.fuel', debit: c(200_000) },
    { account: 'mineral.properties', debit: c(1_500_000) },
    { account: 'ppe.equipment', debit: c(23_100_000) },
    { account: 'ap.vendors', credit: c(1_100_000) },
    { account: 'liab.reclamation', credit: c(900_000) },
    { account: 'debt.loan_000001', credit: c(5_000_000) },
    { account: 'eq.ownerCapital', credit: c(49_550_000) },
  ]);
  post(
    h,
    [
      { account: 'own.cash', debit: c(12_000_000) },
      { account: 'own.personalDebt', credit: c(300_000) },
      { account: 'own.equity', credit: c(11_700_000) },
    ],
    'owner',
  );
  return h;
}

describe('cash and net worth from the ledger (DESIGN §11 11.20, §1 1.13)', () => {
  const { finance } = fixture();

  it('cash on hand is operating + reserve; restricted cash is excluded', () => {
    expect(cashOnHandCents(finance)).toBe(30_000_000);
  });

  it('liabilities are the credit balances of every liability account, as an amount owed', () => {
    expect(companyLiabilitiesCents(finance)).toBe(7_000_000);
  });

  it('company NW reproduces the hand computation (parts at 60%, equipment left to §9)', () => {
    expect(companyNetWorthCents(finance, tuning)).toBe(26_050_000);
  });

  it('owner NW adds personal cash and subtracts personal debt', () => {
    expect(ownerNetWorthCents(finance, tuning)).toBe(37_750_000);
    expect(netWorthCents(finance, tuning, 'scoring')).toBe(37_750_000);
    expect(netWorthCents(finance, tuning, 'appraised')).toBe(37_750_000);
  });

  it("book NW is assets − liabilities on both books at book value (equals the books' equity)", () => {
    // Company assets 292,000 + 8,000 + 6,000 + 1,500 + 10,000 + 2,000 + 15,000 + 231,000 = 565,500;
    // + owner cash 120,000 − liabilities 70,000 − personal debt 3,000 = 612,500.
    expect(bookNetWorthCents(finance)).toBe(61_250_000);
    expect(netWorthCents(finance, tuning, 'book')).toBe(61_250_000);
  });
});
