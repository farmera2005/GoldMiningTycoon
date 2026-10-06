// §7 operations' effect hooks (DESIGN §7.19, §12 12.3; s07 #14; S12-5; P1 contract §7): the keys §7 publishes (all read
// through effective(); consumer phase 1 unless the registry row says 3 or 5). §3 also reads `ops.waterAvailableMult` on
// springs and wells.
export const OPS_HOOK_KEYS = [
  'ops.hoursMult',
  'ops.productivityMult',
  'ops.haulCycleMult',
  'ops.plantCapacityMult',
  'ops.thawMult',
  'ops.recoveryLossExpMult',
  'ops.waterTruckCostMult',
  'ops.blockLocked',
  'ops.fuelAdderMult',
  'ops.campCapacityMult',
  'ops.campCostMult',
  'ops.waterAvailableMult',
  'ops.fuelSupplyFrac',
  'ops.freezeDamageProbMult',
  'ops.highGradeProbMult',
] as const;
