// §1 climate's effect hooks (DESIGN §12 12.3; S12-5; P1 contract §7): the keys this owner publishes and reads
// through effective(). The registry in data/events/hooks.ts is the union of every owner's list (contract test).
export const CLIMATE_HOOK_KEYS = [
  'season.breakupShiftWeeks',
  'season.freezeUpShiftWeeks',
  'access.roadOpen',
  'access.airOpen',
] as const;
