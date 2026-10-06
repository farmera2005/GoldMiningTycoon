// §7 operations' week scratch and report types (DESIGN §7 7.16; P1 contract §1.3, s02 #10). Step 9 writes each
// operating claim's `WeekOpsResult` into `StepContext.week.ops.results` (read by §8, §9, §11 and §2's history in
// steps 10–16) and into `WeekReport.ops`. Until §7's package lands, the result and cleanup records carry only the fields
// §2 and §13 read; §7's full 7.16 records (supersets of these) replace them in this file.
import type { ClaimId, LineId } from '../../core/ids';

/** §7's per-claim week result (7.16). W0 subset: the fields the history snapshot and the stop rules read. */
export interface WeekOpsResult {
  claimId: ClaimId;
  turn: number;
  /** Σ lines: pay gravel through the plants this week (bank cubic yards). */
  payWashedBcy: number;
}

/** §7's per-line cleanup result (7.16). W0 subset: the line the every-cleanup stop names and the weighed raw oz. */
export interface CleanupResult {
  turn: number;
  lineId: LineId;
  /** Gross weighed raw oz at the scale, before in-kind interests (7.10). */
  rawOzWeighed: number;
}

/** §7's what-if hint (7.8; only with explain). Placeholder until §7 defines `WhatIfHint`. */
export type OpsHint = Readonly<Record<string, unknown>>;

export interface OpsWeekScratch {
  /** One entry per claim that ran step 9 this week (claims in `ops.claimIds`). */
  results: Record<ClaimId, WeekOpsResult>;
}

export function emptyOpsWeekScratch(): OpsWeekScratch {
  return { results: {} };
}
