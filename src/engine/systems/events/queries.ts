// Query builders for effective() (DESIGN §12 12.3, §2.10; S12-7, P1 contract §1.9). A read through `effective(state,
// key, q)` must carry its full context, or a modifier scoped to a district would miss a claim-level read: a claim read
// is `{ districtId, claimId }`, a block read adds `blockId`, a machine read is `{ districtId, claimId, machineId,
// modelId, brandId }`. Every consumer builds its query with these, never by hand, so all reads of one kind match the
// same modifiers. An unknown id is a bug in the caller (validators reject unknown ids first), so the builders throw.
import type { BlockId, ClaimId, DistrictId, EmployeeId, MachineId } from '../../core/ids';
import type { GameState } from '../../state/types';
import type { Assignment } from '../staff/types';
import { EffectiveError } from './effective';
import type { EffectQuery } from './types';

/** A company-wide read (no scope dimension). */
export function qCompany(): EffectQuery {
  return {};
}

export function qDistrict(districtId: DistrictId): EffectQuery {
  return { districtId };
}

function districtOfClaim(state: GameState, claimId: ClaimId): DistrictId {
  const claim = Object.prototype.hasOwnProperty.call(state.world.claims, claimId)
    ? state.world.claims[claimId]
    : undefined;
  if (claim === undefined) throw new EffectiveError(`effective query: no claim ${claimId}`);
  return claim.districtId;
}

export function qClaim(state: GameState, claimId: ClaimId): EffectQuery {
  return { districtId: districtOfClaim(state, claimId), claimId };
}

export function qBlock(state: GameState, claimId: ClaimId, blockId: BlockId): EffectQuery {
  return { districtId: districtOfClaim(state, claimId), claimId, blockId };
}

/** A machine read: its location (district and claim, when placed) plus machine, model and brand (§9). */
export function qMachine(state: GameState, machineId: MachineId): EffectQuery {
  const m = Object.prototype.hasOwnProperty.call(state.fleet.machines, machineId)
    ? state.fleet.machines[machineId]
    : undefined;
  if (m === undefined) throw new EffectiveError(`effective query: no machine ${machineId}`);
  const q: EffectQuery = {};
  switch (m.location.kind) {
    case 'claim':
      q.districtId = districtOfClaim(state, m.location.id);
      q.claimId = m.location.id;
      break;
    case 'yard':
    case 'dealer':
    case 'auctionSite':
    case 'town':
      q.districtId = m.location.id;
      break;
    case 'transit':
      break;
  }
  q.machineId = machineId;
  q.modelId = m.modelId;
  q.brandId = m.brandId;
  return q;
}

/** The claim an assignment places an employee on, if any (a program's claim for program crew). */
function assignmentClaim(state: GameState, a: Assignment): ClaimId | null {
  switch (a.kind) {
    case 'claim':
    case 'camp':
    case 'security':
    case 'caretaker':
      return a.claimId;
    case 'shop':
      return a.mode === 'site' ? a.claimId : null;
    case 'program':
      return state.knowledge.programs[a.programId]?.claimId ?? null;
    case 'district':
    case 'office':
    case 'standby':
      return null;
  }
}

/** An employee read: the employee plus its district (the assignment's, else home) and claim when assigned (§8). */
export function qEmployee(state: GameState, employeeId: EmployeeId): EffectQuery {
  const e = Object.prototype.hasOwnProperty.call(state.staff.employees, employeeId)
    ? state.staff.employees[employeeId]
    : undefined;
  if (e === undefined) throw new EffectiveError(`effective query: no employee ${employeeId}`);
  const claimId = assignmentClaim(state, e.assignment);
  if (claimId !== null) return { districtId: districtOfClaim(state, claimId), claimId, employeeId };
  const a = e.assignment;
  const districtId = a.kind === 'district' || (a.kind === 'shop' && a.mode === 'pool') ? a.districtId : e.homeDistrictId;
  return { districtId, employeeId };
}
