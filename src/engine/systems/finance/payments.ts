// §11 the payment API (DESIGN §11.4; S11-7, S11-18, S11-20; P1 contract §4.11, §0.6 item 8). Wave 0 writes the real P1
// bodies, because every section that moves money builds against them and a stub would break the ledger invariants:
//   pay      immediate cash out of `cash.operating` (player actions, COD deliveries, closings): Dr the request's lines /
//            Cr cash. A request that cash cannot cover fails whole when `allowPartial` is false (nothing posts); a
//            partial payment scales the lines pro rata (the rounding remainder on the largest line). §11's package adds
//            the pipeline priority reserve.
//   receive  every cash receipt: Dr cash / Cr the request's lines (the gold-sale flag is kept for §11's sweep, P4).
//   bill     a payable now: the record plus its accrual (Dr the bill's lines / Cr its payable account); §11's step 14
//            settles it. billBatch posts one accrual txn per call (S11-7).
import { nextId, type BillId, type TxnId } from '../../core/ids';
import { allocateCents, cents, ZERO_CENTS, type Cents } from '../../core/money';
import { insertSortedId } from '../../core/iter';
import { cloneJson } from '../../state/immutability';
import type { GameState } from '../../state/types';
import type { Obligation } from '../permits/types';
import { accountBalance, LedgerError, postInto } from './ledger';
import type { NewBill, PayCategory, PayResult, PaymentRequest, PostingLine, ReceiptRequest } from './types';

export class PaymentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PaymentError';
  }
}

/** Σ debits − credits of a set of lines (the non-cash side of a payment is net debit). */
function netDebit(lines: readonly PostingLine[]): number {
  let net = 0;
  for (const l of lines) net += (l.debit ?? 0) - (l.credit ?? 0);
  return net;
}

function checkAmount(amountCents: Cents, lines: readonly PostingLine[], what: string): void {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) {
    throw new PaymentError(`${what}: amount must be a positive integer of cents, got ${amountCents}`);
  }
  if (lines.length === 0) throw new PaymentError(`${what}: no lines`);
}

/** Debit lines scaled to `paid` cents, pro rata (every line of a payment's non-cash side is a debit). */
function scaleDebits(lines: readonly PostingLine[], paid: Cents): PostingLine[] {
  const weights = lines.map((l) => l.debit ?? 0);
  const parts = allocateCents(paid, weights);
  const out: PostingLine[] = [];
  lines.forEach((l, i) => {
    const amount = parts[i] as Cents;
    if (amount > 0) out.push(l.dims === undefined ? { account: l.account, debit: amount } : { account: l.account, debit: amount, dims: l.dims });
  });
  return out;
}

/** Pays now from `cash.operating` (company book). */
export function pay(draft: GameState, req: PaymentRequest): PayResult {
  checkAmount(req.amountCents, req.lines, 'pay');
  if (netDebit(req.lines) !== req.amountCents) {
    throw new PaymentError(`pay "${req.memo}": lines net ${netDebit(req.lines)} cents, amount ${req.amountCents}`);
  }
  const available = Math.max(0, accountBalance(draft.finance.books.company, 'cash.operating'));
  const failed: PayResult = { status: 'failed', paidCents: ZERO_CENTS, shortfallCents: req.amountCents, txnIds: [] };
  let paid: Cents = req.amountCents;
  let lines: PostingLine[] = cloneJson(req.lines);
  if (available < req.amountCents) {
    if (!req.allowPartial || available <= 0) return failed;
    if (req.lines.some((l) => l.credit !== undefined)) {
      throw new PaymentError(`pay "${req.memo}": a partial payment needs debit-only lines`);
    }
    paid = cents(available);
    lines = scaleDebits(req.lines, paid);
  }
  const txnId = postInto(draft, {
    book: 'company',
    date: draft.clock.turn,
    lines: [...lines, { account: 'cash.operating', credit: paid }],
    memo: req.memo,
    refs: cloneJson(req.refs),
    source: `§11/pay/${req.category}`,
    counterparty: req.payee.name,
  });
  const short = cents(req.amountCents - paid);
  return { status: short > 0 ? 'partial' : 'paid', paidCents: paid, shortfallCents: short, txnIds: [txnId] };
}

/** Receives cash into `cash.operating`; returns the txn id. */
export function receive(draft: GameState, req: ReceiptRequest): TxnId {
  checkAmount(req.amountCents, req.lines, 'receive');
  if (-netDebit(req.lines) !== req.amountCents) {
    throw new PaymentError(`receive "${req.memo}": lines net ${-netDebit(req.lines)} cents, amount ${req.amountCents}`);
  }
  return postInto(draft, {
    book: 'company',
    date: draft.clock.turn,
    lines: [{ account: 'cash.operating', debit: req.amountCents }, ...cloneJson(req.lines)],
    memo: req.memo,
    refs: cloneJson(req.refs),
    source: req.goldSale ? '§11/receive/goldSale' : '§11/receive',
    counterparty: req.payer.name,
  });
}

function storeBill(draft: GameState, b: NewBill, source: string, accrualTxnId: TxnId | null): BillId {
  const id = nextId(draft.ids, 'bill');
  draft.finance.bills[id] = {
    id,
    payee: cloneJson(b.payee),
    category: b.category,
    amountCents: b.amountCents,
    paidCents: ZERO_CENTS,
    issuedTurn: draft.clock.turn,
    dueTurn: b.dueTurn,
    allowPartial: b.allowPartial,
    method: 'cash',
    ...(b.loanId === undefined ? {} : { loanId: b.loanId }),
    ...(b.obligationId === undefined ? {} : { obligationId: b.obligationId }),
    source,
    accrualTxnId,
    closedTurn: null,
    status: 'open',
    weeksLate: 0,
    feesCents: ZERO_CENTS,
  };
  insertSortedId(draft.finance.billIds, id);
  if (b.obligationId !== undefined) draft.finance.obligationsByBill[id] = b.obligationId;
  return id;
}

function checkBill(b: NewBill): void {
  checkAmount(b.amountCents, b.accrual ?? [{ account: b.payableAccount, credit: b.amountCents }], 'bill');
  if (b.accrual !== null && netDebit(b.accrual) !== b.amountCents) {
    throw new PaymentError(`bill "${b.memo}": accrual nets ${netDebit(b.accrual)} cents, amount ${b.amountCents}`);
  }
}

/** Accrues a payable now and stores the bill; returns its id. */
export function bill(draft: GameState, b: NewBill): BillId {
  checkBill(b);
  let accrualTxnId: TxnId | null = null;
  if (b.accrual !== null) {
    accrualTxnId = postInto(draft, {
      book: 'company',
      date: draft.clock.turn,
      lines: [...cloneJson(b.accrual), { account: b.payableAccount, credit: b.amountCents }],
      memo: b.memo,
      refs: cloneJson(b.refs),
      source: b.source,
      counterparty: b.payee.name,
    });
  }
  return storeBill(draft, b, b.source, accrualTxnId);
}

/** Bills several payables with one accrual txn (S11-7); returns the bill ids in input order. */
export function billBatch(draft: GameState, source: string, bills: readonly NewBill[]): BillId[] {
  for (const b of bills) checkBill(b);
  const accruing = bills.filter((b) => b.accrual !== null);
  let accrualTxnId: TxnId | null = null;
  if (accruing.length > 0) {
    const lines: PostingLine[] = [];
    for (const b of accruing) {
      lines.push(...cloneJson(b.accrual as PostingLine[]), { account: b.payableAccount, credit: b.amountCents });
    }
    try {
      accrualTxnId = postInto(draft, {
        book: 'company',
        date: draft.clock.turn,
        lines,
        memo: `${source}: ${accruing.length} bill${accruing.length === 1 ? '' : 's'}`,
        refs: accruing.flatMap((b) => cloneJson(b.refs)),
        source,
      });
    } catch (e) {
      if (e instanceof LedgerError) throw new PaymentError(`billBatch ${source}: ${e.message}`);
      throw e;
    }
  }
  return bills.map((b) => storeBill(draft, b, source, b.accrual === null ? null : accrualTxnId));
}

/** §11.4's category of an obligation (the obligation's own override wins). */
export function obligationPayCategory(obl: Pick<Obligation, 'kind' | 'category' | 'payCategory'>): PayCategory {
  if (obl.payCategory !== undefined) return obl.payCategory;
  switch (obl.kind) {
    case 'loanPayment':
      return 'debt.secured';
    case 'leaseAdvanceRoyalty':
    case 'leaseShortfallRoyalty':
    case 'minimumRoyaltyShortfall':
      return 'royalty.cash';
    case 'workInLieu':
    case 'leaseCure':
      return 'vendor.critical';
  }
}
