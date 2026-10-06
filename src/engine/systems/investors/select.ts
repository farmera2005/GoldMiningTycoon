// §1 investors selectors (DESIGN §2.11; P1 contract §4.2): pure readers over state, spread into `select` by
// select/index.ts. The visible agreement terms are `companySelectors.investorAgreements`. None reads a hidden field; a
// name already used by another folder fails the composition test.
import { deliveredValueCents } from './waterfall';

export const investorsSelectors = {
  deliveredValueCents,
} as const;
