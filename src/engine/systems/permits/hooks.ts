// §6 permits' effect hooks (DESIGN §6.17, §12 12.3; D-6.34; S12-5; P1 contract §7): the canonical names §6 publishes,
// all with consumer phase 2 (6 for the Yukon row). The registry in data/events/hooks.ts is the union of every owner's
// list (contract test).
export const PERMITS_HOOK_KEYS = [
  'permits.reviewTimeMult',
  'permits.inspectionRateMult',
  'permits.complaintRateMult',
  'permits.detectionMult',
  'permits.exceedanceMult',
  'permits.maxWaterGpmMult',
  'permits.agencyWorkloadMult',
  'permits.bondRateMult',
  'permits.feeAdd.maintenance',
  'permits.noticeMaxAcresSet',
  'permits.yukon.securityFracMult',
] as const;
