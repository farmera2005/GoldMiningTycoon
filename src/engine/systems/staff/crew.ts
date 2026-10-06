// §8 crew readers for §7, §9, §4 and §1 (DESIGN §8.2, §8.5, §8.12, §8.16; s07 #4; S08-10, S08-22; P1 contract §4.8):
// who can fill a role and at what effective skill, availability, the foreman rule with its small-crew exception
// (D-8.18, D-8.48), the shop capacity and market wages. Wave-0 stubs describe a crew that is always available at skill
// 50 under no supervisor.
import type { ClaimId, DistrictId, EmployeeId, LineId } from '../../core/ids';
import { ZERO_CENTS, type Cents } from '../../core/money';
import type { GameState } from '../../state/types';
import type { ClassId } from '../fleet/catalog';
import type { OpsRole } from '../ops/types';
import type { ForemanInfo, Range, Role, ShopKey, SupervisorKind } from './types';

/** An operator's effective and shown skill on a machine class (§9 class map, 9.7.2). */
export function operatorProfile(
  _state: GameState,
  _who: EmployeeId | 'owner',
  _classId: ClassId,
): { effSkill: number; shownSkill: Range } | null {
  // CONTRACT-STUB(§8) staff.operatorProfile
  return { effSkill: 50, shownSkill: { lo: 50, hi: 50 } };
}

/** Whether a person can fill a §7 role (on a machine class), and at what effective skill (§7 pairing). */
export function canFill(
  _state: GameState,
  _who: EmployeeId | 'owner',
  _role: OpsRole,
  _machineClass?: ClassId,
): { ok: boolean; effSkill: number; reason?: string } {
  // CONTRACT-STUB(§8) staff.canFill
  return { ok: true, effSkill: 50 };
}

/** §8.5 availableFraction (0..1) of a person in a week. */
export function availableFraction(_state: GameState, _who: EmployeeId | 'owner', _turn: number): number {
  // CONTRACT-STUB(§8) staff.availableFraction
  return 1;
}

/** §8.12 the supervisor of a claim's line (L1 = the claim's senior supervisor), from step 7's supervision records. */
export function foremanFor(_state: GameState, _claimId: ClaimId, _lineId: LineId = 'L1'): ForemanInfo {
  // CONTRACT-STUB(§8) staff.foremanFor
  return {
    kind: 'none',
    empId: null,
    skill: 0,
    shownSkill: { lo: 0, hi: 0 },
    safety: 0,
    leadHandWeeks: 0,
    lineIds: [],
  };
}

/** The supervisor kind a plan would get (s07 #4: pending assignments and the small-crew test), for §7's validators. */
export function prospectiveSupervisorKind(
  _state: GameState,
  _claimId: ClaimId,
  _plan: { shiftsPerDay: 1 | 2; activeLines: LineId[]; crewIds: EmployeeId[] },
): SupervisorKind {
  // CONTRACT-STUB(§8) staff.prospectiveSupervisorKind
  return 'none';
}

/** 1.15 for a small crew with no foreman, else 1 (§12 site incidents, P2). */
export function supervisionIncidentMult(_state: GameState, _claimId: ClaimId): number {
  // CONTRACT-STUB(§8) staff.supervisionIncidentMult
  return 1;
}

/** Field crew on a claim this week (§7, §6). */
export function fieldCrewCount(_state: GameState, _claimId: ClaimId): number {
  // CONTRACT-STUB(§8) staff.fieldCrewCount
  return 0;
}

/** A shop's labor this week (§9 9.8.6; site or district pool). */
export function shopCapacity(
  _state: GameState,
  _shop: ShopKey,
): { mechHours: number; weldHours: number; mechSkill: number; weldSkill: number } {
  // CONTRACT-STUB(§8) staff.shopCapacity
  return { mechHours: 0, weldHours: 0, mechSkill: 0, weldSkill: 0 };
}

/** The district's market wage for a role (hourly cents, or annual for salaried roles). */
export function marketWage(_state: GameState, _role: Role, _districtId: DistrictId): Cents {
  // CONTRACT-STUB(§8) staff.marketWage
  return ZERO_CENTS;
}

/** The market wage before the season and scarcity terms. */
export function marketWageBase(_state: GameState, _role: Role, _districtId: DistrictId): Cents {
  // CONTRACT-STUB(§8) staff.marketWageBase
  return ZERO_CENTS;
}
