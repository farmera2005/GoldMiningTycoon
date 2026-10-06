// §3 world actions (DESIGN §3.12, §2.2; P1 contract §5): this folder's action composition file. actions/catalog.ts
// registers WORLD_ACTIONS, and actions/types.ts folds the action union and the code lists into `Action`,
// `ActionErrorCode` and `ActionWarningCode` (s02 #11). Wave 0 registers every row as a stub (NOT_IMPLEMENTED, no-op
// handler, P1 contract §0.2); §3's package replaces each row.
import { stubActionDef } from '../../actions/stub';
import type { ActionDef } from '../../actions/types';
import type { ClaimId, DistrictId } from '../../core/ids';

export type WorldAction =
  | { type: 'world/siteVisit'; claimId: ClaimId; ownerTime?: 'queue' | 'now' }
  | { type: 'world/setWatch'; target: { districtId: DistrictId } | { claimId: ClaimId }; on: boolean };

export const WORLD_ACTIONS: readonly ActionDef[] = [
  stubActionDef('world/siteVisit', 3, { reveals: false, commits: false }),
  stubActionDef('world/setWatch', 3, { reveals: false, commits: false }),
];

export const WORLD_ERROR_CODES = [
  'CLAIM_UNKNOWN',
  'ACCESS_CLOSED',
  'OWNER_INJURED',
  'VISIT_ALREADY_BOOKED',
  'UNKNOWN_TARGET',
  'WATCH_LIMIT',
] as const satisfies readonly string[];

export const WORLD_WARNING_CODES = ['DESK_DAYS_QUEUED'] as const satisfies readonly string[];
