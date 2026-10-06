// §8 staff actions (DESIGN §8.14, §2.2; P1 contract §5): this folder's action composition file. actions/catalog.ts
// registers STAFF_ACTIONS, and actions/types.ts folds the action union and the code lists into `Action`,
// `ActionErrorCode` and `ActionWarningCode` (s02 #11). Wave 0 registers every row as a stub (NOT_IMPLEMENTED, no-op
// handler, P1 contract §0.2). The role ↔ assignment table lives in data/staff/roles.ts (S08-17); the northern layoff
// and spring recall are non-blocking decisions with defaults (`staff.layoffDecision`, `staff.recallDecision`, S08-14),
// not actions.
import { stubActionDef } from '../../actions/stub';
import type { ActionDef } from '../../actions/types';
import type { CandidateId, DistrictId, EmployeeId } from '../../core/ids';
import type { Cents } from '../../core/money';
import type { Assignment, Role } from './types';

/** A pay offer: intent, never a derived number (the ask is read by the validator). */
export type PayOffer = { kind: 'hourly'; centsPerHour: Cents } | { kind: 'salary'; centsPerYear: Cents };

export type StaffAction =
  | {
      type: 'staff/hire';
      candidateId: CandidateId;
      role?: Role;
      pay: PayOffer;
      startTurn: number;
      assignment: Assignment;
      flyInIfClosed?: boolean;
    }
  | { type: 'staff/cancelHire'; employeeId: EmployeeId }
  | { type: 'staff/useRecruiter'; role: Role; districtId: DistrictId; count: 1 | 2 | 3 }
  | { type: 'staff/assign'; employeeId: EmployeeId; assignment: Assignment; flyInIfClosed?: boolean }
  | { type: 'staff/setPay'; employeeId: EmployeeId; pay: PayOffer }
  | { type: 'staff/giveBonus'; employeeIds: EmployeeId[]; cents: Cents }
  | { type: 'staff/fire'; employeeId: EmployeeId; cause: 'none'; severanceWeeks: number }
  | { type: 'staff/layoff'; employeeIds: EmployeeId[]; recall: boolean }
  | { type: 'staff/recall'; employeeIds: EmployeeId[]; startTurn: number; flyInIfClosed?: boolean };

/** Registry rows (contract §5.2 flags: R = reveals, C = commits). */
export const STAFF_ACTIONS: readonly ActionDef[] = [
  stubActionDef('staff/hire', 8, { reveals: false, commits: true }),
  stubActionDef('staff/cancelHire', 8, { reveals: false, commits: true }),
  stubActionDef('staff/useRecruiter', 8, { reveals: false, commits: true }),
  stubActionDef('staff/assign', 8, { reveals: false, commits: false }),
  stubActionDef('staff/setPay', 8, { reveals: false, commits: false }),
  stubActionDef('staff/giveBonus', 8, { reveals: false, commits: false }),
  stubActionDef('staff/fire', 8, { reveals: false, commits: true }),
  stubActionDef('staff/layoff', 8, { reveals: false, commits: true }),
  stubActionDef('staff/recall', 8, { reveals: false, commits: true }),
];

/** Error codes this folder's validators return (contract §5.2), beyond the framework's. */
export const STAFF_ERROR_CODES = [
  'CANDIDATE_GONE',
  'ROLE_NOT_ELIGIBLE',
  'START_TOO_SOON',
  'PAY_BELOW_ASK',
  'BELOW_MIN_WAGE',
  'SALARY_NOT_EXEMPT',
  'ASSIGNMENT_INVALID',
  'ROLE_INCOMPATIBLE',
  'EMPLOYEE_NOT_FOUND',
  'NOT_PENDING',
  'INSUFFICIENT_FUNDS',
  'EMPLOYEE_NOT_AVAILABLE',
  'FOREMAN_SLOT_TAKEN',
  'COVERAGE_ROLE_ONLY',
  'NEGATIVE_AMOUNT',
  'CAUSE_NOT_DOCUMENTED',
  'NOT_ON_RECALL_LIST',
] as const satisfies readonly string[];

/** Non-blocking warning codes (s07 #3, S13-3). */
export const STAFF_WARNING_CODES = ['CAMP_FULL', 'SMALL_CREW_ENDS'] as const satisfies readonly string[];
