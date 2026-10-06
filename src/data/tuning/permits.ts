// `permits.*` tuning constants (DESIGN §6 6.19, whose keys are written there without the prefix). Keys must start with
// 'permits.'. P1 runs no permits (§6's P1 obligation store only), but §5's closings read the federal fee keys
// (s05 #27; D-6.50: §5 holds no fee keys), so P1 Wave 0 (contracts-data) wrote them with their 6.19 values. These fees
// are nominal statutory amounts (6.19), not × cpiIndex.
import type { TuningTable } from './types';

export const permitsTuning = {
  // ---- Federal claim fees and recording (BLM fee table 2026, R1)
  'permits.fed.processingFeeUsd': 25,
  'permits.fed.locationFeeUsd': 49,
  'permits.fed.maintenanceFeePerUnitUsd': 200,
  // The overlay's countyFilingUsdPerClaim overrides the county fee where set.
  'permits.fed.countyRecordingFeePerClaimUsd': 12,
  // Charged only as the transferOfInterest obligation.
  'permits.fed.transferFeePerClaimUsd': 15,
  'permits.fed.affidavitFeePerClaimUsd': 15,
  // 90 days.
  'permits.fed.recordingWindowWeeks': 13,
  'permits.fed.unitAcres': 20,

  // ---- Notice tier (P2). Ships early as the base of the §12 hook permits.noticeMaxAcresSet (baseKey, S12-14).
  'permits.noticeMaxAcres': 5,
} as const satisfies TuningTable;
