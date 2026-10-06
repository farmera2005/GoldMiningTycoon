// §3 claim supply (DESIGN §3.11, §3.14; D-3.62, D-3.69; P1 contract §4.3, §1.5 N3, §3 part 3.1). §3 decides which held
// claims come to market and builds each candidate's visible listing info; §5 turns candidates into listings and tells
// §3 when a listing closes. Draws: the initial market on `rng(seed,'supply','init')` with each candidate's own draws on
// `rng(seed,'supply',0,claimId)` (s03 #1); the weekly hazard rolls in claim-id order on `supply` keyed by turn;
// patented parcels take the draw but never list (s03 #12). Wave-0 stubs list nothing.
import type { ClaimId, DistrictId } from '../../core/ids';
import type { Rng } from '../../core/rng';
import type { GameState, InitCtx } from '../../state/types';
import type { ListingCandidate, ListingCloseOutcome } from './listingTypes';
import type { SellerSituation, WorldSlice } from './types';

/** The initial market's candidates (s03 #1 strata); the family run is excluded. */
export function createInitialListings(world: WorldSlice, _r: Rng): { world: WorldSlice; candidates: ListingCandidate[] } {
  // CONTRACT-STUB(§3) world.createInitialListings
  return { world, candidates: [] };
}

/** N3: the initial candidates for §5's N5 (`init.scratch.candidates`). */
export function initialCandidates(_draft: GameState, _init: InitCtx): void {
  // CONTRACT-STUB(§3) world.initialCandidates
}

/** Step 3.1(a): queued relists, then the hazard rolls; returns this week's candidates in claim-id order. */
export function supplyTick(_draft: GameState, _turn: number): ListingCandidate[] {
  // CONTRACT-STUB(§3) world.supplyTick
  return [];
}

/** §5 reports a closed listing (`leasedToPlayer` keeps the lessor as holder, s03 #11). */
export function onListingClosed(_draft: GameState, _claimId: ClaimId, _outcome: ListingCloseOutcome): void {
  // CONTRACT-STUB(§3) world.onListingClosed
}

/** A leased claim returns to its lessor (s03 #11, D-3.69). */
export function returnFromLease(_draft: GameState, _claimId: ClaimId): void {
  // CONTRACT-STUB(§3) world.returnFromLease
}

/** A forfeited claim becomes open ground (§6). */
export function forfeitToOpen(_draft: GameState, _claimId: ClaimId): void {
  // CONTRACT-STUB(§3) world.forfeitToOpen
}

/** Queues a relist for the next step-3 supplyTick (§12 busts, P5 caller). */
export function relistClaim(_draft: GameState, _claimId: ClaimId, _situation: SellerSituation): void {
  // CONTRACT-STUB(§3) world.relistClaim
}

/** Engine-only (reads the hidden class): §5 multiplies its background-sale probability by it. */
export function saleQualityMult(_state: GameState, _claimId: ClaimId): number {
  // CONTRACT-STUB(§3) world.saleQualityMult
  return 1;
}

/** §12 `landOpened`: the only entry point that opens a withdrawn overlay (P5). */
export function openWithdrawnOverlay(_draft: GameState, _districtId: DistrictId): void {
  // CONTRACT-STUB(§3) world.openWithdrawnOverlay
}
