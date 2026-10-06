// §9 in the pipeline (DESIGN §9 9.12, §2.6; P1 contract §1.5 N6, §3 parts 3.4, 6.2, 8.1, 10.1, 10.3, 11.1, 16.10).
//   N6 `initMarket`: dealers at each hub, the six rotating used listings per district (`fleet-market (0, districtId)`,
//      `fleet-listing (listingId)` with the S09-5 / S09-18 draw order).
//   3.4 `marketsRefresh`: listing expiry and arrivals, the cached market multipliers.
//   6.2 `pendingDeals`: factory orders (deposit, balance, held orders lapse), transport legs advance, deliveries.
//   8.1 `availability`: each claim's `ctx.week.fleet.availability` (P1: availability 0.92 by grade, in transit,
//      assembling).
//   10.1 `failures` (P3): failure rolls and masks for §7's re-resolve.
//   10.3 `meters`: SMR hours, the weekly log ring, the unposted depreciation accrual (D-9.70).
//   11.1 `shop`: P1 flat maintenance bills by grade; P3 work orders, parts and PM.
//   16.10 `wrapUp`: `saleLog` pruning (52 weeks), transport alerts.
import type { GameState, InitCtx } from '../../state/types';
import type { StepContext } from '../../turn/types';

export function initMarket(_draft: GameState, _init: InitCtx): void {
  // CONTRACT-STUB(§9) fleet.initMarket
}

export function marketsRefresh(_draft: GameState, _ctx: StepContext): void {
  // CONTRACT-STUB(§9) fleet.marketsRefresh
}

export function pendingDeals(_draft: GameState, _ctx: StepContext): void {
  // CONTRACT-STUB(§9) fleet.pendingDeals
}

export function availability(_draft: GameState, _ctx: StepContext): void {
  // CONTRACT-STUB(§9) fleet.availability
}

export function meters(_draft: GameState, _ctx: StepContext): void {
  // CONTRACT-STUB(§9) fleet.meters
}

export function shop(_draft: GameState, _ctx: StepContext): void {
  // CONTRACT-STUB(§9) fleet.shop
}

export function wrapUp(_draft: GameState, _ctx: StepContext): void {
  // CONTRACT-STUB(§9) fleet.wrapUp
}
