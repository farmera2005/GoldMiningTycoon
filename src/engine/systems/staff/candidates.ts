// §8 candidate creation (DESIGN §8.3, §8.4; S08-6, S08-7, S08-27; P1 contract §4.8). `addCandidate` draws a candidate's
// truth, résumé noise and pool stay on a stream the caller supplies (S08-7: §1 passes the Inheritor's former-hand
// stream; the labor market passes `staff-cand (candId)` with S08-6's draw order) and mints a `cand` id, so until §8's
// package lands it is a creation stub that throws, as is the fixture builder (BALANCE §2.1 crews).
import { ContractStubError } from '../../core/assert';
import type { CandidateId, ClaimId, EmployeeId } from '../../core/ids';
import type { Rng } from '../../core/rng';
import type { FixtureSpec } from '../../state/fixture';
import type { GameState } from '../../state/types';
import type { CandidateSpec } from './types';

export function addCandidate(_draft: GameState, _spec: CandidateSpec, _stream?: Rng): CandidateId {
  // CONTRACT-STUB(§8) staff.addCandidate
  throw new ContractStubError('staff.addCandidate');
}

/** A fixture crew member: a candidate with a truth spec, then the hire path (S08-27). */
export function fixtureEmployee(_draft: GameState, _spec: FixtureSpec['crew'][number], _claimId: ClaimId): EmployeeId {
  // CONTRACT-STUB(§8) staff.fixtureEmployee
  throw new ContractStubError('staff.fixtureEmployee');
}
