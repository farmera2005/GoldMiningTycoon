// §5 land and tenure actions (DESIGN §5.15, §2.2; P1 contract §5): this folder's action composition file.
// actions/catalog.ts registers LAND_ACTIONS, and actions/types.ts folds the action union and the code lists into
// `Action`, `ActionErrorCode` and `ActionWarningCode` (s02 #11). Wave 0 registers every row as a stub (NOT_IMPLEMENTED,
// no-op handler, P1 contract §0.2); §5's packages replace each row. Rules fixed by rulings: voluntary ends need a
// demobilized site (SITE_ACTIVE, s05 #13); lease signing pays the first AMR and any option fee at once (s05 #4); options
// exercise instantly (s05 #10); P1 generates in-kind leases only (s05 #23). Decision kind `land.leaseRenewal` is
// non-blocking with default `renew`.
import { stubActionDef } from '../../actions/stub';
import type { ActionDef } from '../../actions/types';
import type { ClaimListingId, ProductionInterestId, TenureId } from '../../core/ids';

export type LandAction =
  | { type: 'land/acceptAsk'; listingId: ClaimListingId; structure: 'sale' | 'lease' }
  /** In 0.5-point steps. */
  | { type: 'land/buyDownRoyalty'; interestId: ProductionInterestId; points: number }
  | { type: 'land/exerciseOption' | 'land/quickSell'; tenureId: TenureId }
  | { type: 'land/setLeaseRenewal'; tenureId: TenureId; renew: boolean }
  | { type: 'land/surrenderLease' | 'land/relinquish'; tenureId: TenureId; confirmUnreclaimed?: boolean };

export const LAND_ACTIONS: readonly ActionDef[] = [
  stubActionDef('land/acceptAsk', 5, { reveals: false, commits: true }),
  stubActionDef('land/buyDownRoyalty', 5, { reveals: false, commits: true }),
  stubActionDef('land/exerciseOption', 5, { reveals: false, commits: true }),
  stubActionDef('land/setLeaseRenewal', 5, { reveals: false, commits: false }),
  stubActionDef('land/surrenderLease', 5, { reveals: false, commits: true }),
  stubActionDef('land/quickSell', 5, { reveals: false, commits: true }),
  stubActionDef('land/relinquish', 5, { reveals: false, commits: true }),
];

export const LAND_ERROR_CODES = [
  'LISTING_NOT_OPEN',
  'STRUCTURE_NOT_OFFERED',
  'NO_BUYDOWN_CLAUSE',
  'BUYDOWN_FLOOR',
  'IN_DEFAULT',
  'TENURE_NOT_FOUND',
  'NO_OPTION',
  'OPTION_EXPIRED',
  'NO_RENEWAL_RIGHT',
  'NOT_LEASED',
  'SURRENDER_PENDING',
  'SITE_ACTIVE',
  'TENURE_NOT_OWNED',
  'QUICK_SALE_PENDING',
  'TENURE_CANNOT_RELINQUISH',
  'PI_BURDEN_TOO_HIGH',
] as const satisfies readonly string[];

export const LAND_WARNING_CODES = ['RENEWAL_OPT_OUT_SITE_ACTIVE'] as const satisfies readonly string[];
