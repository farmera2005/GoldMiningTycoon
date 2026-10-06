// §7 operations actions (DESIGN §7.17, §2.2; P1 contract §5): this folder's action composition file.
// actions/catalog.ts registers OPS_ACTIONS, and actions/types.ts folds the action union and the code lists into
// `Action`, `ActionErrorCode` and `ActionWarningCode` (s02 #11). Wave 0 registers every row as a stub (NOT_IMPLEMENTED,
// no-op handler, P1 contract §0.2); §7's packages replace each row. Rules fixed by rulings: the site lifecycle (s07
// #10), the season-end cleanup in the winterizing week (s07 #11), `emp_owner` in `plan.crew` only as `operator` on that
// claim (s07 #25), later-phase plan inputs (s07 #27); `ops/setMinePlan`'s warnings are `projectOpsVisible(…).warnings`.
import { stubActionDef } from '../../actions/stub';
import type { ActionDef } from '../../actions/types';
import type { BlockId, ClaimId, LineId } from '../../core/ids';
import type { MinePlan } from './types';

export type OpsAction =
  | { type: 'ops/setMinePlan'; claimId: ClaimId; plan: MinePlan }
  | { type: 'ops/setPlanActive'; claimId: ClaimId; active: boolean }
  | { type: 'ops/cleanupNow' | 'ops/tailingsAudit'; claimId: ClaimId; lineId?: LineId }
  | { type: 'ops/movePlant'; claimId: ClaimId; toBlockId: BlockId; lineId?: LineId }
  | {
      type: 'ops/mobilizeSite' | 'ops/winterize' | 'ops/startup' | 'ops/demobilizeSite' | 'ops/drillWell';
      claimId: ClaimId;
    };

export const OPS_ACTIONS: readonly ActionDef[] = [
  stubActionDef('ops/setMinePlan', 7, { reveals: false, commits: false }),
  stubActionDef('ops/setPlanActive', 7, { reveals: false, commits: false }),
  stubActionDef('ops/cleanupNow', 7, { reveals: false, commits: false }),
  stubActionDef('ops/movePlant', 7, { reveals: false, commits: false }),
  stubActionDef('ops/mobilizeSite', 7, { reveals: false, commits: true }),
  stubActionDef('ops/winterize', 7, { reveals: false, commits: false }),
  stubActionDef('ops/startup', 7, { reveals: false, commits: false }),
  stubActionDef('ops/demobilizeSite', 7, { reveals: false, commits: true }),
  stubActionDef('ops/drillWell', 7, { reveals: false, commits: true }),
  // Draws `ops-audit (claimId, lineId, auditSeq)`.
  stubActionDef('ops/tailingsAudit', 7, { reveals: true, commits: true }),
];

export const OPS_ERROR_CODES = [
  'CLAIM_NOT_HELD',
  'FOREMAN_REQUIRED',
  'LINE_LIMIT',
  'LINE_INVALID',
  'BLOCK_NOT_IN_CLAIM',
  'CUT_NOT_CONTIGUOUS',
  'CUT_EMPTY',
  'BLOCK_RECLAIMED',
  'BLOCK_OCCUPIED',
  'BLOCK_EXCLUDED',
  'MACHINE_NOT_ON_CLAIM',
  'ASSET_DOUBLE_BOOKED',
  'ROLE_INCOMPATIBLE',
  'EMPLOYEE_NOT_AVAILABLE',
  'SCHEDULE_INVALID',
  'FEED_TARGET_TOO_HIGH',
  'PLANT_NO_FEED',
  'BULK_SAMPLE_LIMIT',
  'LINE_NEEDS_PLANT_OPERATOR',
  'SITE_NOT_READY',
  'NO_PLANT',
  'SITE_NOT_RUNNING',
  'SITE_EXISTS',
  'ACCESS_CLOSED',
  'SITE_NOT_WINTERIZED',
  'NO_CREW_ON_SITE',
  'WELL_LIMIT',
  'NOT_ARID',
  'NO_PLANT_OPERATOR',
] as const satisfies readonly string[];

export const OPS_WARNING_CODES = [
  'TRUCKS_UNDERMATCHED',
  'WATER_SHORT',
  'POWER_SHORT',
  'FUEL_SHORT',
  'ONE_PLANT_OPERATOR_TWO_SHIFTS',
  'STRIP_BELOW_NEED',
  'PILE_STRIPPED_AS_WASTE',
  'SMALL_CREW_NO_FOREMAN',
  'FIELD_IGNORED_THIS_PHASE',
  'LINE_LEAD_HAND',
  'PAY_UNDER_PLANT_SITE',
  'MACHINES_ON_SITE',
] as const satisfies readonly string[];
