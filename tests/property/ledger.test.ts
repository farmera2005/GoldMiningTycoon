// Ledger properties (DESIGN §11 11.1, §2.14): the ledger always balances, cached balances equal the journal, cash only
// changes through postings, and no posting can overdraw a cash account (it is refused and nothing changes).
import fc from 'fast-check';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { select, type Cents } from '../../src/engine';
import { registerTestActions } from '../../src/engine/actions/testActions';
import {
  LedgerError,
  ledgerProblem,
  postInto,
  recomputeBalances,
  type LedgerHost,
} from '../../src/engine/systems/finance/ledger';
import { emptyFinanceSlice, type PostingLine } from '../../src/engine/systems/finance/types';
import { WORLD_TIMEOUT_MS, fcParams, newP0, play, seedArb, weekPlanArb } from './helpers';

let unregister: () => void;
beforeAll(() => {
  unregister = registerTestActions();
});
afterAll(() => unregister());

const COMPANY = [
  'cash.operating',
  'cash.reserve',
  'cash.restricted.bond',
  'exp.fuel',
  'exp.wages',
  'rev.gold',
  'ap.vendors',
  'debt.loan_000001',
  'eq.ownerCapital',
];
const OWNER = ['own.cash', 'own.personalDebt', 'own.exp.living', 'own.equity'];

/** A balanced entry: random debit lines, and credit lines that split the same total. */
const entryArb = fc
  .record({
    owner: fc.boolean(),
    debits: fc.array(fc.record({ a: fc.nat(100), cents: fc.integer({ min: 1, max: 5_000_000 }) }), {
      minLength: 1,
      maxLength: 3,
    }),
    creditSplit: fc.array(fc.integer({ min: 1, max: 100 }), { minLength: 1, maxLength: 3 }),
    creditAccounts: fc.array(fc.nat(100), { minLength: 3, maxLength: 3 }),
  })
  .map(({ owner, debits, creditSplit, creditAccounts }) => {
    const accounts = owner ? OWNER : COMPANY;
    const pick = (i: number): string => accounts[i % accounts.length] as string;
    const total = debits.reduce((t, d) => t + d.cents, 0);
    const weights = creditSplit.reduce((t, w) => t + w, 0);
    const credits = creditSplit.map((w) => Math.floor((total * w) / weights));
    credits[0] = (credits[0] as number) + total - credits.reduce((t, x) => t + x, 0);
    const lines: PostingLine[] = [
      ...debits.map((d) => ({ account: pick(d.a), debit: d.cents as Cents })),
      ...credits.filter((c) => c > 0).map((c, i) => ({ account: pick(creditAccounts[i] ?? 0), credit: c as Cents })),
    ];
    return { book: owner ? ('owner' as const) : ('company' as const), lines };
  });

describe('ledger', () => {
  it('always balances and matches its journal; overdrafts are refused without side effects', () => {
    fc.assert(
      fc.property(fc.array(entryArb, { maxLength: 40 }), (entries) => {
        const host: LedgerHost = { ids: {}, finance: emptyFinanceSlice() };
        for (const e of entries) {
          const before = JSON.stringify(host);
          try {
            postInto(host, { book: e.book, date: 0, lines: e.lines, memo: 'p', refs: [], source: 'property' });
          } catch (err) {
            expect(err).toBeInstanceOf(LedgerError);
            expect((err as LedgerError).code).toBe('CASH_NEGATIVE');
            expect(JSON.stringify(host)).toBe(before);
          }
          expect(ledgerProblem(host.finance)).toBeNull();
        }
        for (const book of ['company', 'owner'] as const) {
          const b = host.finance.books[book];
          expect(recomputeBalances(b)).toEqual(b.balances);
        }
      }),
      fcParams(11_2025, 200),
    );
  });

  it(
    'cash only changes through postings during play',
    () => {
      fc.assert(
        fc.property(seedArb, weekPlanArb(8), (seed, plan) => {
          const p = play(newP0(seed), plan);
          expect(ledgerProblem(p.state.finance)).toBeNull();
          const journalCash = p.state.finance.books.company.txns
            .flatMap((t) => t.lines)
            .filter((l) => l.account === 'cash.operating' || l.account === 'cash.reserve')
            .reduce((t, l) => t + (l.debit ?? 0) - (l.credit ?? 0), 0);
          expect(select.cashOnHand(p.state)).toBe(journalCash);
          // P0 has no cash flows beyond the opening capital: transfers only move it between the two accounts.
          expect(journalCash).toBe(40_000_000);
        }),
        fcParams(9001, 30),
      );
    },
    WORLD_TIMEOUT_MS,
  );
});
