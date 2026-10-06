// §11 loans and deferred revenue (DESIGN §11.7, §11.12, §1 1.8; D-11.53; S11-25; P1 contract §4.11). `createLoan` books
// a loan (level or the generalized seasonal schedule) and its next six payment obligations; it mints ids and posts, so
// until §11's package lands it is a creation stub that throws (only the Inheritor and Banker starts and fixtures reach
// it). `drawdownDeferredRevenue` moves a Backed-royalty delivery's value out of `deferred.revenue.<agreementId>`.
import { ContractStubError } from '../../core/assert';
import type { ClaimId, LoanId } from '../../core/ids';
import type { GameState } from '../../state/types';
import type { Settlement } from '../land/types';
import type { LoanSpec } from './types';

export function createLoan(_draft: GameState, _spec: LoanSpec): LoanId {
  // CONTRACT-STUB(§11) finance.createLoan
  throw new ContractStubError('finance.createLoan');
}

export function drawdownDeferredRevenue(_draft: GameState, _claimId: ClaimId, _settlement: Settlement, _turn: number): void {
  // CONTRACT-STUB(§11) finance.drawdownDeferredRevenue
}
