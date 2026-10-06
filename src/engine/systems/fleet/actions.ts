// §9 fleet actions (DESIGN §9 9.11, §2.2; P1 contract §5): this folder's action composition file. actions/catalog.ts
// registers FLEET_ACTIONS, and actions/types.ts folds the action union and the code lists into `Action`,
// `ActionErrorCode` and `ActionWarningCode` (s02 #11). Wave 0 registers every row as a stub (NOT_IMPLEMENTED, no-op
// handler, P1 contract §0.2). P1 rules: ACCESS_CLOSED only when the outlook has no open week (S09-10, D-9.65); payment
// timing S09-12; `fleet/sell` and `fleet/move` call §7's and §4's `onMachineRemoved` (S09-15, D-7.75).
import { stubActionDef } from '../../actions/stub';
import type { ActionDef } from '../../actions/types';
import type { ClaimId, EquipListingId, MachineId } from '../../core/ids';
import type { MachineOption } from './types';

export type FleetAction =
  | {
      type: 'fleet/buy';
      listingId: EquipListingId;
      payment: 'cash';
      deliverTo: { kind: 'claim'; id: ClaimId };
      options?: MachineOption[];
    }
  | { type: 'fleet/move'; machineIds: MachineId[]; to: { kind: 'claim'; id: ClaimId }; mode: 'auto' | 'road' }
  | { type: 'fleet/sell'; machineId: MachineId; channel: 'dealerCash' };

/** Registry rows (contract §5.2 flags: R = reveals, C = commits). */
export const FLEET_ACTIONS: readonly ActionDef[] = [
  stubActionDef('fleet/buy', 9, { reveals: false, commits: true }),
  stubActionDef('fleet/move', 9, { reveals: false, commits: true }),
  stubActionDef('fleet/sell', 9, { reveals: false, commits: true }),
];

/** Error codes this folder's validators return (contract §5.2), beyond the framework's. */
export const FLEET_ERROR_CODES = [
  'LISTING_GONE',
  'NOT_FOR_SALE',
  'DESTINATION_INVALID',
  'OPTION_INVALID',
  'ACCESS_CLOSED',
  'INSUFFICIENT_FUNDS',
  'MACHINE_NOT_FOUND',
  'MACHINE_IN_TRANSIT',
] as const satisfies readonly string[];

/** Non-blocking warning codes (s07 #3, S13-3). */
export const FLEET_WARNING_CODES = [
  'TRANSPORT_WINDOW_RISK',
  'TRANSPORT_UNFUNDED',
  'MACHINE_IN_PLAN',
] as const satisfies readonly string[];
