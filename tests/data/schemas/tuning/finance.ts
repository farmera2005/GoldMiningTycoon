// Shapes and DESIGN-stated ranges of the `finance.*` keys (DESIGN §11 11.25). Owned by the §11 package after P1 Wave 0.
import type { z } from 'zod';
import { posInt, prob } from '../common';

export const FINANCE_TUNING_SCHEMAS: Readonly<Record<string, z.ZodType>> = {
  'finance.primeSpread': prob,
  'finance.p1PayrollTaxRate': prob,
  'finance.p1WcRate': prob,
  'finance.p1BankerLoanSpread': prob,
  'finance.p1BankerLoanTermMonths': posInt,
};
