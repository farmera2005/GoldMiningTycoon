// §11 finance actions (DESIGN §11.21, §2.2; P1 contract §5): this folder's action composition file. actions/catalog.ts
// registers FINANCE_ACTIONS, and actions/types.ts folds the action union and the code lists into `Action`,
// `ActionErrorCode` and `ActionWarningCode` (s02 #11). Wave 0 registers every row as a stub (NOT_IMPLEMENTED, no-op
// handler, P1 contract §0.2). P1 rules: every pipeline bill is `allowPartial: true`; settlement walks past an unfundable
// non-partial bill (S11-24); bills are due the week issued (S11-20); owner-category items never open the counter (S11-8).
import { stubActionDef } from '../../actions/stub';
import type { ActionDef } from '../../actions/types';
import type { BillId, LoanId } from '../../core/ids';

export type FinanceAction =
  | { type: 'finance/payBill'; billId: BillId; amountUsd?: number }
  | { type: 'finance/prepay'; loanId: LoanId; amount: { usd: number } | 'payoff' };

export const FINANCE_ACTIONS: readonly ActionDef[] = [
  stubActionDef('finance/payBill', 11, { reveals: false, commits: false }),
  stubActionDef('finance/prepay', 11, { reveals: false, commits: false }),
];

export const FINANCE_ERROR_CODES = [
  'BILL_NOT_FOUND',
  'AMOUNT_INVALID',
  'LOAN_CLOSED',
  'INSUFFICIENT_FUNDS',
] as const satisfies readonly string[];

export const FINANCE_WARNING_CODES = [] as const satisfies readonly string[];
