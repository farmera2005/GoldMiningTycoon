// §5 land's effect hooks (DESIGN §5.17, §12 12.3; S12-5; s05 #22; P1 contract §7): the keys §5 publishes and reads
// through effective(). The registry in data/events/hooks.ts is the union of every owner's list (contract test).
export const LAND_HOOK_KEYS = [
  'land.askPriceMult',
  'land.rivalSaleMult',
  'land.sellerMotivationAdd',
  'land.distressedShareMult',
  'land.titleDefectRateMult',
  'land.stakeConflictMult',
] as const;
