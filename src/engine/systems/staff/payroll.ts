// §8's side of payroll and staffing costs (DESIGN §8.6, §8.13, §11.3; S08-11, S08-16, S08-18, S08-22; P1 contract §4.8).
// §11 calls `payrollForWeek` in 14b (it reads `Employee.lastWeek`, written in part 10.5 of the same week; a corp owner's
// wage is an `isOwner` line; standby crew are paid their guarantee), `recordPayrollOutcome` per employee ascending in
// 14e, and `drainStaffingCharges` in 14c. Wave-0 stubs pay no one.
import type { ClaimId, EmployeeId } from '../../core/ids';
import type { Cents } from '../../core/money';
import type { GameState } from '../../state/types';
import type { PayrollLine } from '../finance/types';
import type { MinePlan } from '../ops/types';
import type { Role, StaffingCharge } from './types';

export function payrollForWeek(_state: GameState): PayrollLine[] {
  // CONTRACT-STUB(§8) staff.payrollForWeek
  return [];
}

export function recordPayrollOutcome(_draft: GameState, _empId: EmployeeId, _paidCents: Cents, _shortCents: Cents): void {
  // CONTRACT-STUB(§8) staff.recordPayrollOutcome
}

/** Removes and returns the staffing charges waiting for §11's 14c bill. */
export function drainStaffingCharges(_draft: GameState): StaffingCharge[] {
  // CONTRACT-STUB(§8) staff.drainStaffingCharges
  return [];
}

/** Gross payroll and burden for the next weeks (§11 forecast, bots). */
export function payrollProjection(_state: GameState, _weeks: number): { turn: number; grossCents: Cents; burdenCents: Cents }[] {
  // CONTRACT-STUB(§8) staff.payrollProjection
  return [];
}

/** The crew a plan needs by role (S08-22). */
export function crewRequirement(_state: GameState, _claimId: ClaimId, _plan: MinePlan): Partial<Record<Role, number>> {
  // CONTRACT-STUB(§8) staff.crewRequirement
  return {};
}
