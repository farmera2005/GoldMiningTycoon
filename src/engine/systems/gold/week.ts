// §10 in the pipeline (DESIGN §10 10.16, §2.6; P1 contract §1.5 N7, §3 parts 12.3, 16.11).
//   N7 `init`: one local buyer per district (`market-buyers (districtId)`, S10-14 layout) and the default standing order.
//   12.3 `standingOrders`: sells through §11 `receive` with `goldSale: true`, oldest lots first, the last lot split by
//        binary search (S10-3).
//   16.11 `wrapUp`: sales and lot retention (104 weeks; pruned lots go to `archive`).
// The P5 parts (2.1 market step, 4.1 camp-safe revert, 6.3 pending deals, 12.4 forward deliveries) are registered empty.
import type { GameState, InitCtx } from '../../state/types';
import type { StepContext } from '../../turn/types';

export function init(_draft: GameState, _init: InitCtx): void {
  // CONTRACT-STUB(§10) gold.init
}

export function standingOrders(_draft: GameState, _ctx: StepContext): void {
  // CONTRACT-STUB(§10) gold.standingOrders
}

export function wrapUp(_draft: GameState, _ctx: StepContext): void {
  // CONTRACT-STUB(§10) gold.wrapUp
}
