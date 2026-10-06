// §1 company and owner actions (DESIGN §1 1.16, §2.2; P1 contract §5): this folder's action composition file.
// actions/catalog.ts registers COMPANY_ACTIONS, and actions/types.ts folds the action union and the code lists into
// `Action`, `ActionErrorCode` and `ActionWarningCode` (s02 #11). Wave 0 registers every row as a stub (NOT_IMPLEMENTED,
// no-op handler, P1 contract §0.2); §1's company package replaces each row. Rules fixed by rulings: draws and salary
// increases fail DISTRESS_BLOCKED while §11's P1 counter is open or the stub stage is 3+ (s01 #13, S11-17); salary above
// the lowest investor cap fails ABOVE_CAP_INVESTOR (s01 #16); owner-loan injections carry no interest under P1–P3
// rules (s01 #14).
import { stubActionDef } from '../../actions/stub';
import type { ActionDef } from '../../actions/types';
import type { OwnerAssignment } from './types';

/** This folder's action payloads (contract §5.1). Money is intent in USD where DESIGN writes USD. */
export type CompanyAction =
  | { type: 'owner/setAssignment'; assignment: OwnerAssignment }
  | { type: 'owner/setSalary'; usdPerWeek: number }
  | { type: 'owner/draw'; amountUsd: number }
  | { type: 'owner/inject'; amountUsd: number; form: 'equity' | 'loan' }
  | { type: 'community/sponsor'; amountUsd: number }
  | { type: 'game/retire' };

/** Registry rows (contract §5.2 flags: R = reveals, C = commits). */
export const COMPANY_ACTIONS: readonly ActionDef[] = [
  stubActionDef('owner/setAssignment', 1, { reveals: false, commits: false }),
  stubActionDef('owner/setSalary', 1, { reveals: false, commits: false }),
  stubActionDef('owner/draw', 1, { reveals: false, commits: false }),
  stubActionDef('owner/inject', 1, { reveals: false, commits: false }),
  stubActionDef('community/sponsor', 1, { reveals: false, commits: true }),
  stubActionDef('game/retire', 1, { reveals: false, commits: true }),
];

/** Error codes this folder's validators return (contract §5.2), beyond the framework's. */
export const COMPANY_ERROR_CODES = [
  'CLAIM_NOT_ACTIVE',
  'ASSIGNMENT_INVALID',
  'ROLE_NOT_AVAILABLE',
  'PROGRAM_NOT_ACTIVE',
  'MACHINE_NOT_ON_CLAIM',
  'OWNER_INJURED',
  'FOREMAN_SLOT_TAKEN',
  'NEGATIVE_AMOUNT',
  'ABOVE_CAP_INVESTOR',
  'DISTRESS_BLOCKED',
  'INSUFFICIENT_PERSONAL_CASH',
  'EQUITY_LOCKED',
  'BELOW_MINIMUM',
  'CAP_REACHED',
  'SCENARIO_ACTIVE',
] as const satisfies readonly string[];

/** Non-blocking warning codes (s07 #3, S13-3). */
export const COMPANY_WARNING_CODES = ['SMALL_CREW_ENDS'] as const satisfies readonly string[];
