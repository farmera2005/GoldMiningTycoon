// §11 finance's week scratch and week record (P1 contract §1.3, s02 #10). The scratch carries step 14's payment events
// and the payroll run for the step-15 distress evaluation and §8's payroll outcomes; the record shows the week's
// settlement to the player.
import { ZERO_CENTS, type Cents } from '../../core/money';
import type { PaymentEvent, PayrollRunSummary } from './types';

export type { PaymentEvent, PayrollRunSummary } from './types';

export interface FinanceWeekScratch {
  paymentEvents: PaymentEvent[];
  payroll: PayrollRunSummary | null;
}

export interface FinanceWeekRecord {
  paymentsCents: Cents;
  shortCents: Cents;
  arrearsOpen: number;
  counterOpen: boolean;
}

export function emptyFinanceWeekScratch(): FinanceWeekScratch {
  return { paymentEvents: [], payroll: null };
}

export function emptyFinanceWeekRecord(): FinanceWeekRecord {
  return { paymentsCents: ZERO_CENTS, shortCents: ZERO_CENTS, arrearsOpen: 0, counterOpen: false };
}
