import { describe, expect, it } from 'vitest';
import type { Cents } from '../../core/money';
import { accountDef, accountFamilyOf, normalSign } from './accounts';
import { LedgerError, entryDeltas, ledgerProblem, post, postInto, recomputeBalances, type LedgerHost } from './ledger';
import { periodTotals } from './periods';
import { emptyFinanceSlice, type PostingEntry } from './types';

const c = (n: number): Cents => n as Cents;

function host(): LedgerHost {
  return { ids: {}, finance: emptyFinanceSlice() };
}

function entry(lines: PostingEntry['lines'], over: Partial<PostingEntry> = {}): PostingEntry {
  return { date: 0, lines, memo: 'test', refs: [], source: '§11/test', ...over };
}

function errorCode(f: () => unknown): string {
  try {
    f();
  } catch (e) {
    if (e instanceof LedgerError) return e.code;
    throw e;
  }
  return 'no error';
}

const capital = entry([
  { account: 'cash.operating', debit: c(40_000_000) },
  { account: 'eq.ownerCapital', credit: c(40_000_000) },
]);

describe('chart of accounts (DESIGN §11 11.2)', () => {
  it('resolves exact codes and sub-ledger families', () => {
    expect(accountDef('cash.operating')).toMatchObject({ book: 'company', cls: 'asset', cf: 'C', cash: true });
    expect(accountDef('own.cash')).toMatchObject({ book: 'owner', cls: 'asset', cash: true });
    expect(accountDef('debt.loan_000004')).toMatchObject({ cls: 'liability', cf: 'F' });
    expect(accountDef('debt.ownerLoan')).toMatchObject({ cls: 'liability' });
    expect(accountFamilyOf('cash.restricted.bond')).toBe('cash.restricted');
    expect(accountDef('cash.restricted.bond')).toMatchObject({ cash: true, cf: 'I' });
    expect(accountDef('cash.restricted.lunch')).toBeNull();
    expect(accountDef('deferred.revenue.ivr_000001')).toMatchObject({ cls: 'liability' });
    expect(accountDef('debt.')).toBeNull();
    expect(accountDef('cash.petty')).toBeNull();
  });

  it('gives debit-normal signs to assets and expenses only', () => {
    expect(normalSign('asset')).toBe(1);
    expect(normalSign('expense')).toBe(1);
    expect(normalSign('contraAsset')).toBe(-1);
    expect(normalSign('liability')).toBe(-1);
    expect(normalSign('equity')).toBe(-1);
    expect(normalSign('income')).toBe(-1);
  });
});

describe('posting (DESIGN §11 11.1)', () => {
  it('posts a balanced entry: txn id from the counter, seq = its number, debit-positive balances', () => {
    const h = host();
    const id = postInto(h, capital);
    expect(id).toBe('txn_000001');
    expect(h.ids.txn).toBe(1);
    const txn = h.finance.books.company.txns[0];
    expect(txn).toMatchObject({ id: 'txn_000001', seq: 1, book: 'company', memo: 'test' });
    expect(h.finance.books.company.balances).toEqual({ 'cash.operating': 40_000_000, 'eq.ownerCapital': -40_000_000 });
    expect(ledgerProblem(h.finance)).toBeNull();
  });

  it('nets several lines on one account and keeps the entry as given', () => {
    const h = host();
    postInto(h, capital);
    postInto(
      h,
      entry([
        { account: 'exp.fuel', debit: c(80_861), dims: { costCenter: 'site' } },
        { account: 'exp.camp', debit: c(26_950) },
        { account: 'cash.operating', credit: c(100_000) },
        { account: 'cash.operating', credit: c(7_811) },
      ]),
    );
    expect(h.finance.books.company.balances['cash.operating']).toBe(40_000_000 - 107_811);
    expect(h.finance.books.company.txns[1]?.lines[0]?.dims).toEqual({ costCenter: 'site' });
    expect(recomputeBalances(h.finance.books.company)).toEqual(h.finance.books.company.balances);
  });

  it('rejects unbalanced, empty, zero, fractional, two-sided, unknown-account and wrong-book entries', () => {
    const h = host();
    expect(errorCode(() => postInto(h, entry([{ account: 'cash.operating', debit: c(5) }])))).toBe('LEDGER_UNBALANCED');
    expect(errorCode(() => postInto(h, entry([])))).toBe('LEDGER_EMPTY');
    expect(
      errorCode(() =>
        postInto(
          h,
          entry([
            { account: 'cash.operating', debit: c(0) },
            { account: 'eq.ownerCapital', credit: c(0) },
          ]),
        ),
      ),
    ).toBe('AMOUNT_INVALID');
    expect(
      errorCode(() =>
        postInto(
          h,
          entry([
            { account: 'cash.operating', debit: c(1.5) },
            { account: 'eq.ownerCapital', credit: c(1.5) },
          ]),
        ),
      ),
    ).toBe('AMOUNT_INVALID');
    expect(
      errorCode(() =>
        postInto(
          h,
          entry([
            { account: 'cash.operating', debit: c(5), credit: c(5) },
            { account: 'eq.ownerCapital', credit: c(5) },
          ]),
        ),
      ),
    ).toBe('AMOUNT_INVALID');
    expect(
      errorCode(() =>
        postInto(
          h,
          entry([
            { account: 'cash.mattress', debit: c(5) },
            { account: 'eq.ownerCapital', credit: c(5) },
          ]),
        ),
      ),
    ).toBe('ACCOUNT_UNKNOWN');
    expect(
      errorCode(() =>
        postInto(
          h,
          entry([
            { account: 'own.cash', debit: c(5) },
            { account: 'eq.ownerCapital', credit: c(5) },
          ]),
        ),
      ),
    ).toBe('ACCOUNT_BOOK_MISMATCH');
    expect(errorCode(() => postInto(h, { ...capital, date: 0.5 }))).toBe('DATE_INVALID');
    expect(h.finance.books.company.txns).toHaveLength(0);
    expect(h.ids.txn).toBeUndefined();
  });

  it('refuses to take any cash account below zero and leaves the host untouched (CASH_NEGATIVE is a bug)', () => {
    const h = host();
    postInto(h, capital);
    const overdraw = entry([
      { account: 'exp.ga', debit: c(40_000_001) },
      { account: 'cash.operating', credit: c(40_000_001) },
    ]);
    expect(errorCode(() => postInto(h, overdraw))).toBe('CASH_NEGATIVE');
    expect(h.finance.books.company.txns).toHaveLength(1);
    expect(h.ids.txn).toBe(1);
    const personal = entry(
      [
        { account: 'own.exp.living', debit: c(1) },
        { account: 'own.cash', credit: c(1) },
      ],
      {
        book: 'owner',
      },
    );
    expect(errorCode(() => postInto(h, personal))).toBe('CASH_NEGATIVE');
  });

  it('does not alias the caller entry', () => {
    const h = host();
    const e = entry([
      { account: 'cash.operating', debit: c(10) },
      { account: 'eq.ownerCapital', credit: c(10) },
    ]);
    postInto(h, e);
    (e.lines[0] as { debit?: Cents }).debit = c(99);
    expect(h.finance.books.company.txns[0]?.lines[0]?.debit).toBe(10);
  });

  it('post() is pure: the input state is unchanged and the result carries the txn', () => {
    const before = host();
    const { state, txnId } = post(before, capital);
    expect(txnId).toBe('txn_000001');
    expect(before.finance.books.company.txns).toHaveLength(0);
    expect(state.finance.books.company.txns).toHaveLength(1);
  });

  it('entryDeltas reports the per-account effect without touching state', () => {
    expect(entryDeltas(capital)).toEqual({
      book: 'company',
      deltas: { 'cash.operating': 40_000_000, 'eq.ownerCapital': -40_000_000 },
    });
  });

  it('ledgerProblem catches a tampered balance, an unbalanced book and out-of-order txns', () => {
    const h = host();
    postInto(h, capital);
    h.finance.books.company.balances['cash.operating'] = c(1);
    expect(ledgerProblem(h.finance)).toMatch(/cash.operating: cached 1/);
    const h2 = host();
    postInto(h2, capital);
    postInto(h2, capital);
    const [a, b] = h2.finance.books.company.txns;
    h2.finance.books.company.txns = [b as never, a as never];
    expect(ledgerProblem(h2.finance)).toMatch(/out of order/);
  });
});

describe('period totals (DESIGN §11 11.19)', () => {
  it('sums revenue and net income for txns dated in the period', () => {
    const h = host();
    postInto(h, capital);
    postInto(
      h,
      entry(
        [
          { account: 'cash.operating', debit: c(164_200_00) },
          { account: 'rev.gold', credit: c(164_200_00) },
        ],
        { date: 30 },
      ),
    );
    postInto(
      h,
      entry(
        [
          { account: 'exp.wages', debit: c(19_951_00) },
          { account: 'cash.operating', credit: c(19_951_00) },
        ],
        { date: 30 },
      ),
    );
    postInto(
      h,
      entry(
        [
          { account: 'exp.fuel', debit: c(1_000_00) },
          { account: 'cash.operating', credit: c(1_000_00) },
        ],
        { date: 60 },
      ),
    );
    expect(periodTotals(h.finance, 0, 51)).toEqual({
      revenueCents: 164_200_00,
      netIncomeCents: 164_200_00 - 19_951_00,
    });
    expect(periodTotals(h.finance, 52, 103)).toEqual({ revenueCents: 0, netIncomeCents: -1_000_00 });
  });
});
