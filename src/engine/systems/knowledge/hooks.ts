// §4 knowledge's effect hooks (DESIGN §4.18, §12 12.3; S12-5; P1 contract §7): the keys §4 publishes and reads through
// effective(). The registry in data/events/hooks.ts is the union of every owner's list (contract test).
export const KNOWLEDGE_HOOK_KEYS = [
  'prospect.rateMult',
  'prospect.pitStopProbMult',
  'prospect.recordsFindMult',
  'prospect.consultantLeadMult',
  'prospect.contractorCostMult',
  'prospect.contractorLeadTimeMult',
  'prospect.labTurnaroundWeeksAdd',
] as const;
