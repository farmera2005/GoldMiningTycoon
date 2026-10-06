// §6 obligation actions (DESIGN §6.15, §2.2; P1 contract §5): this folder's action composition file. actions/catalog.ts
// registers PERMITS_ACTIONS, and actions/types.ts folds the action union and the code lists into `Action`,
// `ActionErrorCode` and `ActionWarningCode` (s02 #11). Wave 0 registers every row as a stub (NOT_IMPLEMENTED, no-op
// handler, P1 contract §0.2). An obligation that already has a §11 bill is paid as that bill (S11-18); a batch stops at
// the first payment that would fail and reports BATCH_PARTIAL (a warning, not an error).
import { stubActionDef } from '../../actions/stub';
import type { ActionDef } from '../../actions/types';
import type { ObligationId } from '../../core/ids';

export type PermitsAction =
  | { type: 'permits/payObligation'; obligationId: ObligationId }
  | { type: 'permits/payObligations'; obligationIds: ObligationId[] }
  | { type: 'permits/setAutoPay'; obligationId: ObligationId; on: boolean };

export const PERMITS_ACTIONS: readonly ActionDef[] = [
  stubActionDef('permits/payObligation', 6, { reveals: false, commits: false }),
  stubActionDef('permits/payObligations', 6, { reveals: false, commits: false }),
  stubActionDef('permits/setAutoPay', 6, { reveals: false, commits: false }),
];

export const PERMITS_ERROR_CODES = [
  'OBLIGATION_NOT_FOUND',
  'OBLIGATION_NOT_OPEN',
  'NOT_PAYABLE',
  'EMPTY_BATCH',
  'NOT_AUTOPAY_ELIGIBLE',
] as const satisfies readonly string[];

export const PERMITS_WARNING_CODES = ['BATCH_PARTIAL'] as const satisfies readonly string[];
