// Query builders for effective() (DESIGN §12 12.3, §2.10; S12-7, P1 contract §1.9). A read through `effective(state,
// key, q)` must carry its full context, or a modifier scoped to a district would miss a claim-level read: a claim read
// is `{ districtId, claimId }`, a block read adds `blockId`, a machine read is `{ districtId, claimId, machineId,
// modelId, brandId }`. Every consumer builds its query with these, never by hand, so all reads of one kind match the
// same modifiers. An unknown id is a bug in the caller (validators reject unknown ids first), so the builders throw.
import { ContractStubError } from '../../core/assert';
import type { BlockId, ClaimId, DistrictId, EmployeeId, MachineId } from '../../core/ids';
import type { GameState } from '../../state/types';
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
export function qMachine(_state: GameState, _machineId: MachineId): EffectQuery {
  // CONTRACT-STUB(§12): needs §9's machine records; there is no machine before the fleet slice lands.
  throw new ContractStubError('events.qMachine');
}

/** An employee read: the employee plus its district and claim when assigned (§8). */
export function qEmployee(_state: GameState, _employeeId: EmployeeId): EffectQuery {
  // CONTRACT-STUB(§12): needs §8's employee records; there is no employee before the staff slice lands.
  throw new ContractStubError('events.qEmployee');
}
