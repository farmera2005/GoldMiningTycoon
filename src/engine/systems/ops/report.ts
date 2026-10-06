// §7 operations' week scratch and report types (DESIGN §7.16; P1 contract §1.3, s02 #10). Step 9 writes each operating
// claim's `WeekOpsResult` into `StepContext.week.ops.results` (read by §8, §9, §11 and §2's history in steps 10–16) and
// into `WeekReport.ops`; it also decides the week's cleanups (9 b), which step 12's chain runs, caches the week's
// `ops-grade` draws (s07 #9) and keeps the week's cost lines for §11's 14c. Report calc keys are
// `ops/<metric>/<claimId>/<lineId>` (S13-6).
import type { BlockId, ClaimId, EmployeeId } from '../../core/ids';
import type { CleanupDue, OpsCostLine, WeekOpsResult, WhatIfHint } from './types';

export type { CleanupResult, WeekOpsResult, WhatIfHint } from './types';

/** §7's what-if hint, by the name the report uses (`WeekReport.hints`). */
export type OpsHint = WhatIfHint;

export interface OpsWeekScratch {
  /** One entry per claim that ran step 9 this week (claims in `ops.claimIds`). */
  results: Record<ClaimId, WeekOpsResult>;
  /** The week's cleanups, decided in step 9(b): claims ascending, then lines ascending. */
  cleanupsDue: CleanupDue[];
  /** `ops-grade (turn, claimId, blockId)`: one normal per block, drawn at its first dig of the week (s07 #9). */
  gradeDraws: Record<`${ClaimId}/${BlockId}`, number>;
  /** Every claim's cost lines of the week, for §11's 14c (claims ascending). */
  costLines: OpsCostLine[];
  /** Crew hours by employee across claims (§8 step 10 reads them with §4's program crew). */
  crewHours: Record<EmployeeId, number>;
  /** The owner's field hours this week (§8). */
  ownerHours: number;
}

export function emptyOpsWeekScratch(): OpsWeekScratch {
  return { results: {}, cleanupsDue: [], gradeDraws: {}, costLines: [], crewHours: {}, ownerHours: 0 };
}
