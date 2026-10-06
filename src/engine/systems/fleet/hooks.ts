// §9 fleet's effect hooks (DESIGN §9 9.15, §12 12.3; P1 contract §7). P1: `fleet.rateMult`, `fleet.fuelBurnMult`,
// `fleet.transportCostMult`, `fleet.usedPriceMult`, `fleet.newLeadAddWeeks`; P3: `fleet.machineGrounded`,
// `fleet.partsLeadTimeMult`, `fleet.partsPriceMult`, `fleet.failureHazardMult` (base tuning), `fleet.wearMult`,
// `fleet.fieldServiceDelayMult`, `fleet.auctionSupplyMult`, `fleet.rentalAvailMult`. The registry in
// data/events/hooks.ts is the union of every owner's list (contract test).
export const FLEET_HOOK_KEYS = [
  'fleet.rateMult',
  'fleet.fuelBurnMult',
  'fleet.transportCostMult',
  'fleet.usedPriceMult',
  'fleet.newLeadAddWeeks',
  'fleet.machineGrounded',
  'fleet.partsLeadTimeMult',
  'fleet.partsPriceMult',
  'fleet.failureHazardMult',
  'fleet.wearMult',
  'fleet.fieldServiceDelayMult',
  'fleet.auctionSupplyMult',
  'fleet.rentalAvailMult',
] as const;
