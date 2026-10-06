// §9 machine creation outside the market (DESIGN §9 9.1, §1 1.8.2; D-9.61, S09-6; BALANCE §2.1; P1 contract §4.9): the
// Inheritor's fleet from its data spec on the caller's per-item stream, and a fixture machine on a claim. Both mint
// `mch` ids, so until §9's package lands they are creation stubs that throw.
import { ContractStubError } from '../../core/assert';
import type { ClaimId, MachineId } from '../../core/ids';
import type { Rng } from '../../core/rng';
import type { FixtureSpec } from '../../state/fixture';
import type { GameState } from '../../state/types';
import type { InheritedFleetSpec } from './catalog';

export function materializeInheritedFleet(
  _draft: GameState,
  _spec: InheritedFleetSpec,
  _fleetRng: (i: number) => Rng,
): MachineId[] {
  // CONTRACT-STUB(§9) fleet.materializeInheritedFleet
  throw new ContractStubError('fleet.materializeInheritedFleet');
}

export function fixtureMachine(_draft: GameState, _spec: FixtureSpec['fleet'][number], _claimId: ClaimId): MachineId {
  // CONTRACT-STUB(§9) fleet.fixtureMachine
  throw new ContractStubError('fleet.fixtureMachine');
}
