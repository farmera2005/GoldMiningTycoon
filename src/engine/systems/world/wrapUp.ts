// §3 step-16 wrap-up and fixture builder (DESIGN §3.13, §2.6 16.5; P1 contract §3, §1.6).
//   16.5 `wrapUp`: `listing.new` and `listing.priceChanged` (info, edge) for watched districts or claims or ones
//        adjacent to player ground, read from `ctx.week.land.listingEvents`; `siteVisit.report`; site-visit report
//        retention (3 per claim).
//   `buildReferenceClaim`: a fixture game's claim (BALANCE §2.1): rewrites one held, unlisted claim of the district to
//        uniform truth, water and access.
import { ContractStubError } from '../../core/assert';
import type { ClaimId, DistrictId } from '../../core/ids';
import type { ReferenceClaimSpec } from '../../state/fixture';
import type { GameState } from '../../state/types';
import type { StepContext } from '../../turn/types';

export function wrapUp(_draft: GameState, _ctx: StepContext): void {
  // CONTRACT-STUB(§3) world.wrapUp
}

/** Creation stub until §3's package lands. */
export function buildReferenceClaim(_draft: GameState, _spec: ReferenceClaimSpec, _districtId: DistrictId): ClaimId {
  // CONTRACT-STUB(§3) world.buildReferenceClaim
  throw new ContractStubError('world.buildReferenceClaim');
}
