// §11 finance's effect hooks (DESIGN §11.23, §12 12.3; S12-5; P1 contract §7): all consumer phase 4. The registry in
// data/events/hooks.ts is the union of every owner's list (contract test).
export const FINANCE_HOOK_KEYS = [
  'finance.lenderSpreadAdd',
  'finance.lenderMaxLtvAdd',
  'finance.lenderAppetiteShift',
  'finance.lineLimitMult',
  'finance.insurancePremiumMult',
  'finance.vendor.limitMult',
  'finance.wageLienSweep',
] as const;
