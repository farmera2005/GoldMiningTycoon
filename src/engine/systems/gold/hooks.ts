// §10 gold's effect hooks (DESIGN §10 10.18, §12 12.3; P1 contract §7). P1: `market.localBuyerDiscountAdd` (add, 0,
// [−0.05, +0.15], district/claim); P5: `market.theftHazardMult`, `market.shippingCostMult`,
// `market.refineryTransitWeeksAdd`, `market.localBuyerCapMult`. The registry in data/events/hooks.ts is the union of
// every owner's list (contract test).
export const GOLD_HOOK_KEYS = [
  'market.localBuyerDiscountAdd',
  'market.theftHazardMult',
  'market.shippingCostMult',
  'market.refineryTransitWeeksAdd',
  'market.localBuyerCapMult',
] as const;
