// §3 world's effect hooks (DESIGN §3.14, §12 12.3; S12-5; P1 contract §7): the keys §3 publishes. §3 also reads §7's
// `ops.waterAvailableMult` on springs and wells (listed in systems/ops/hooks.ts, its owner).
export const WORLD_HOOK_KEYS = ['geology.supply.listingHazardMult', 'geology.access.closed'] as const;
