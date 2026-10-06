// §8 staff's effect hooks (DESIGN §8.17, §12 12.3; P1 contract §7). P1: `staff.wageAskMult`, `staff.poolSizeMult`
// (base = difficulty tuning, district), `staff.crewAvailableFrac` (set, neutral 1, claim / company),
// `staff.quitHazardMult` (base tuning), `staff.moraleTargetAdd` (add 0, ±10); P2: `staff.injuryHazardMult`. The
// registry in data/events/hooks.ts is the union of every owner's list (contract test).
export const STAFF_HOOK_KEYS = [
  'staff.wageAskMult',
  'staff.poolSizeMult',
  'staff.crewAvailableFrac',
  'staff.quitHazardMult',
  'staff.moraleTargetAdd',
  'staff.injuryHazardMult',
] as const;
