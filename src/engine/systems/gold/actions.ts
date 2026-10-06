// §10 gold actions (DESIGN §10 10.15, §2.2; P1 contract §5): this folder's action composition file. actions/catalog.ts
// registers GOLD_ACTIONS, and actions/types.ts folds the action union and the code lists into `Action`,
// `ActionErrorCode` and `ActionWarningCode` (s02 #11). Wave 0 registers every row as a stub (NOT_IMPLEMENTED, no-op
// handler, P1 contract §0.2). P5's gold actions are not registered in P1.
import { stubActionDef } from '../../actions/stub';
import type { ActionDef } from '../../actions/types';
import type { LocalBuyerId, LotId } from '../../core/ids';
import type { StandingSaleOrder } from './types';

export type GoldAction =
  /** Partial: one lot, a multiple of 0.001 raw oz. */
  | { type: 'gold/sellLocal'; lotIds: LotId[]; buyerId: LocalBuyerId; rawOz?: number }
  | { type: 'gold/setStandingOrder'; order: StandingSaleOrder };

/** Registry rows (contract §5.2 flags: R = reveals, C = commits; a local sale draws on `buyer`). */
export const GOLD_ACTIONS: readonly ActionDef[] = [
  stubActionDef('gold/sellLocal', 10, { reveals: false, commits: true }),
  stubActionDef('gold/setStandingOrder', 10, { reveals: false, commits: false }),
];

/** Error codes this folder's validators return (contract §5.2), beyond the framework's. */
export const GOLD_ERROR_CODES = [
  'LOT_NOT_HELD',
  'BUYER_NOT_IN_DISTRICT',
  'AMOUNT_INVALID',
  'BUYER_NOT_FOUND',
  'REFINERY_NOT_AVAILABLE',
] as const satisfies readonly string[];

/** Non-blocking warning codes (s07 #3, S13-3). */
export const GOLD_WARNING_CODES = [] as const satisfies readonly string[];
