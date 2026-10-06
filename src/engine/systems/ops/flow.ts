// §7 the weekly flow and the gold room (DESIGN §7.5–§7.11, §7.18; s07 #8, #9; P1 contract §4.7, §3 parts 9.1, 12.1).
// Step 9 runs, per claim in `ops.claimIds` ascending: `operateClaimFlow` (9 a–i: gates, the cleanup decision, the thaw
// of cleared, stripping and pay-exposed blocks every week, `ops-grade` draws cached in `ctx.week.ops.gradeDraws`,
// program-first reservations from §4, the hour-block flow with §12's block callbacks, attribution, disturbance), then
// §4's programs, then `closeClaimWeek` (9 k–l: cost lines incl. program fuel, the WeekOpsResult into
// `ctx.week.ops.results`, `ops.lastWeek`, the report and the accumulators). Step 12's chain weighs each cleanup
// decided in 9(b): `weighCleanup` → §5 settlement → §10 lot → §11 drawdown → `finishCleanup` → §4 production → §12.
import { ContractStubError } from '../../core/assert';
import type { ClaimId, LotId } from '../../core/ids';
import type { GameState } from '../../state/types';
import type { StepContext } from '../../turn/types';
import type { Settlement } from '../land/types';
import type { CleanupDue, CleanupResult, WeighedCleanup } from './types';

export function operateClaimFlow(_draft: GameState, _ctx: StepContext, _claimId: ClaimId): void {
  // CONTRACT-STUB(§7) ops.operateClaimFlow
}

export function closeClaimWeek(_draft: GameState, _ctx: StepContext, _claimId: ClaimId): void {
  // CONTRACT-STUB(§7) ops.closeClaimWeek
}

/** The cleanups 9(b) decided this week, claims ascending then lines ascending. */
export function cleanupsDue(_state: GameState, ctx: StepContext): CleanupDue[] {
  return ctx.week.ops.cleanupsDue.map((d) => ({ ...d }));
}

/** The gold room: the box is cleaned and weighed, `floorMilliOz(metal / (1 − dirt))` (skim skipped in P1). */
export function weighCleanup(_draft: GameState, _ctx: StepContext, _due: CleanupDue): WeighedCleanup {
  // CONTRACT-STUB(§7) ops.weighCleanup (unreachable while no cleanup is ever due)
  throw new ContractStubError('ops.weighCleanup');
}

/** Clears the box, keeps the gold-room remainder, resets `sinceCleanup` and records the cleanup in the report. */
export function finishCleanup(
  _draft: GameState,
  _ctx: StepContext,
  _weighed: WeighedCleanup,
  _settlement: Settlement,
  _lotId: LotId | null,
): CleanupResult {
  // CONTRACT-STUB(§7) ops.finishCleanup (unreachable while no cleanup is ever due)
  throw new ContractStubError('ops.finishCleanup');
}
