// §5 listings and lease life in the pipeline (DESIGN §5.3, §5.4, §5.7, §5.16; s05 #8, #13, #15, #20; P1 contract §4.5,
// §1.5 N5, §3 parts 3.1, 6.1, 16.7).
//   N5 / 3.1 `createListings`: listings from §3's candidates (`land-list (listingId)` with s05 #8's fixed layout; the
//        initial market at the stationary age, s05 #15); 3.1 runs §3's supplyTick first, then ages, re-prices (ask and
//        lease terms, 3% hysteresis), expires and sells off-screen (`land-market (turn, listingId)`), writing
//        `ctx.week.land.listingEvents`.
//   6.1 `pendingDeals`: quick-sale closings; lease anniversaries, AMR obligations one ahead, work test and in-lieu,
//        renewal decision at termEnd − 13, term end, option expiry, surrender effective, cure lapse; due defaults.
//   16.7 `wrapUp`: `lease.anniversarySoon`, the land alerts, work-commitment accumulation, closed-listing pruning
//        (13 weeks) with their found tells.
import type { GameState, InitCtx } from '../../state/types';
import type { StepContext } from '../../turn/types';
import type { ListingCandidate } from '../world/types';

export function createListings(_draft: GameState, _candidates: readonly ListingCandidate[], _opts: { initial: boolean }): void {
  // CONTRACT-STUB(§5) land.createListings
}

/** N5: the initial market from N3's candidates. */
export function createInitialListings(draft: GameState, init: InitCtx): void {
  createListings(draft, init.scratch.candidates, { initial: true });
}

export function marketsRefresh(_draft: GameState, _ctx: StepContext): void {
  // CONTRACT-STUB(§5) land.marketsRefresh
}

export function pendingDeals(_draft: GameState, _ctx: StepContext): void {
  // CONTRACT-STUB(§5) land.pendingDeals
}

export function wrapUp(_draft: GameState, _ctx: StepContext): void {
  // CONTRACT-STUB(§5) land.wrapUp
}
