// The Wave-0 payment API (DESIGN §11.4; S11-7; P1 contract §0.6 item 8): pay (whole or pro-rata partial), receive, bill
// and billBatch on hand-computed fixtures. The Bootstrapper opens with $400,000 in `cash.operating`.
import { describe, expect, it } from 'vitest';
import type { ObligationId } from '../../core/ids';
import type { Cents } from '../../core/money';
import { produceState } from '../../state/immutability';
import { newGame } from '../../state/newGame';
import { defaultNewGameSetup } from '../../state/setup';
import type { GameState } from '../../state/types';
import { accountBalance } from './ledger';
import { bill, billBatch, obligationPayCategory, pay, PaymentError, receive } from './payments';
import type { NewBill, PayResult, PaymentRequest } from './types';

const BASE = newGame(defaultNewGameSetup({ companyName: 'Payments Test' }), 'payments');
const c = (n: number): Cents => n as Cents;
const cash = (s: GameState): number => accountBalance(s.finance.books.company, 'cash.operating');
const vendor = { kind: 'vendor', name: 'Fuel Co' } as const;

function request(amount: number, lines: [string, number][], allowPartial = false): PaymentRequest {
  return {
    payee: vendor,
    category: 'vendor.other',
    amountCents: c(amount),
    allowPartial,
    origin: 'player',
    lines: lines.map(([account, debit]) => ({ account, debit: c(debit) })),
    refs: [],
    memo: 'test payment',
  };
}

function paying(s: GameState, req: PaymentRequest): { state: GameState; result: PayResult } {
  let result: PayResult | null = null;
  const state = produceState(s, (d) => {
    result = pay(d, req);
  });
  if (result === null) throw new Error('no result');
  return { state, result };
}

function newBill(amount: number, over: Partial<NewBill> = {}): NewBill {
  return {
    payee: vendor,
    category: 'vendor.other',
    amountCents: c(amount),
    dueTurn: 0,
    allowPartial: true,
    accrual: [{ account: 'exp.fuel', debit: c(amount) }],
    payableAccount: 'ap.vendors',
    refs: [],
    memo: 'fuel',
    source: '§7/test',
    ...over,
  };
}

describe('pay (§11.4)', () => {
  it('pays in full from cash: Dr the lines, Cr cash.operating', () => {
    expect(cash(BASE)).toBe(40_000_000);
    const { state, result } = paying(BASE, request(120_000, [['exp.fuel', 120_000]]));
    expect(result).toMatchObject({ status: 'paid', paidCents: 120_000, shortfallCents: 0 });
    expect(cash(state)).toBe(39_880_000);
    expect(accountBalance(state.finance.books.company, 'exp.fuel')).toBe(120_000);
  });

  it('fails a payment cash cannot cover unless partial is allowed, and posts nothing', () => {
    const { state, result } = paying(BASE, request(50_000_000, [['exp.fuel', 50_000_000]]));
    expect(result).toEqual({ status: 'failed', paidCents: 0, shortfallCents: 50_000_000, txnIds: [] });
    expect(state).toBe(BASE);
  });

  it('pays a partial pro rata over its lines, the remainder on the largest', () => {
    const low = paying(BASE, request(39_900_000, [['exp.fuel', 39_900_000]])).state;
    expect(cash(low)).toBe(100_000);
    const { state, result } = paying(
      low,
      request(
        300_000,
        [
          ['exp.fuel', 200_000],
          ['exp.parts', 100_000],
        ],
        true,
      ),
    );
    expect(result).toMatchObject({ status: 'partial', paidCents: 100_000, shortfallCents: 200_000 });
    expect(cash(state)).toBe(0);
    // 100,000 × 2/3 = 66,666.67 → 66,667; × 1/3 = 33,333.33 → 33,333.
    expect(accountBalance(state.finance.books.company, 'exp.parts')).toBe(33_333);
    expect(accountBalance(state.finance.books.company, 'exp.fuel')).toBe(39_900_000 + 66_667);
  });

  it('refuses lines that do not net to the amount', () => {
    expect(() => paying(BASE, request(100, [['exp.fuel', 99]]))).toThrow(PaymentError);
    expect(() => paying(BASE, request(0, [['exp.fuel', 0]]))).toThrow(PaymentError);
  });
});

describe('receive (§11.4)', () => {
  it('posts Dr cash / Cr the lines', () => {
    const s = produceState(BASE, (d) => {
      receive(d, {
        payer: { kind: 'buyer', name: 'Local buyer' },
        amountCents: c(250_000),
        lines: [{ account: 'rev.gold', credit: c(250_000) }],
        refs: [],
        memo: 'gold sale',
        goldSale: true,
      });
    });
    expect(cash(s)).toBe(40_250_000);
    expect(accountBalance(s.finance.books.company, 'rev.gold')).toBe(-250_000);
  });
});

describe('bill and billBatch (§11.4, S11-7)', () => {
  it('accrues a payable and stores an open bill linked to its obligation', () => {
    const obl = 'obl_000001' as ObligationId;
    const s = produceState(BASE, (d) => {
      bill(d, newBill(80_000, { obligationId: obl }));
    });
    const id = s.finance.billIds[0];
    expect(id).toBeDefined();
    const b = s.finance.bills[id!];
    expect(b).toMatchObject({ amountCents: 80_000, paidCents: 0, status: 'open', closedTurn: null, obligationId: obl });
    expect(b?.accrualTxnId).not.toBeNull();
    expect(s.finance.obligationsByBill[id!]).toBe(obl);
    expect(accountBalance(s.finance.books.company, 'ap.vendors')).toBe(-80_000);
    expect(cash(s)).toBe(40_000_000);
  });

  it('posts one accrual txn for a batch and keeps input order; a loan payment accrues nothing', () => {
    const before = BASE.finance.books.company.txns.length;
    let ids: string[] = [];
    const s = produceState(BASE, (d) => {
      ids = billBatch(d, '§7/costs', [
        newBill(10_000),
        newBill(20_000, { accrual: null, payableAccount: 'ap.vendors', category: 'debt.secured' }),
        newBill(30_000),
      ]);
    });
    expect(s.finance.books.company.txns.length).toBe(before + 1);
    expect(ids.map((id) => s.finance.bills[id as never]?.amountCents)).toEqual([10_000, 20_000, 30_000]);
    expect(s.finance.bills[ids[1] as never]?.accrualTxnId).toBeNull();
    expect(accountBalance(s.finance.books.company, 'ap.vendors')).toBe(-40_000);
  });
});

describe('obligationPayCategory (§11.4)', () => {
  it('maps each P1 obligation kind, an override winning', () => {
    expect(obligationPayCategory({ kind: 'loanPayment', category: 'finance' as never })).toBe('debt.secured');
    expect(obligationPayCategory({ kind: 'leaseAdvanceRoyalty', category: 'land' as never })).toBe('royalty.cash');
    expect(obligationPayCategory({ kind: 'leaseCure', category: 'land' as never })).toBe('vendor.critical');
    expect(
      obligationPayCategory({ kind: 'loanPayment', category: 'finance' as never, payCategory: 'debt.unsecured' }),
    ).toBe('debt.unsecured');
  });
});
