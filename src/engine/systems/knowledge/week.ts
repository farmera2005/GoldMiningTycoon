// §4 step-12 and step-16 work and its cross-section readers (DESIGN §4.4.6, §4.10, §4.17; s04 #3, #4, #20; P1 contract
// §4.4, §3 parts 12.1, 12.2, 16.6).
//   12.1 `recordProduction`: a cleanup's production rows (the incremental path), attributing rawOzWeighed −
//        pileRawOzEst against the estimate as of the start of step 12; estimator-core's pure core builds the rows.
//   12.2 `weighSampleConcentrates` then, per weighing, `afterSampleLot` (the assay check at ≥ 300 mg, drawing
//        `rng(seed,'prospect',claimId,'assay',n)` with n = `knowledge.assayCount[claimId]`; owner Q1).
//   16.6 `wrapUp`: records-review engagements from the week's desk tasks, findings and tells, released results, seller
//        and family checks, the estimate refresh of tracked claims, snapshots, `lastClass`, the `prospect.*` alerts and
//        retention.
import type { ClaimId, LotId } from '../../core/ids';
import { ZERO_CENTS, type Cents } from '../../core/money';
import type { GameState } from '../../state/types';
import type { StepContext } from '../../turn/types';
import type { CleanupResult } from '../ops/types';
import type { ReviewerRef, SampleWeighing } from './types';

export function recordProduction(_draft: GameState, _claimId: ClaimId, _cleanup: CleanupResult): void {
  // CONTRACT-STUB(§4) knowledge.recordProduction
}

/** Sample concentrates of finished or cancelled programs and season-ended districts, weighed in step 12. */
export function weighSampleConcentrates(_draft: GameState, _ctx: StepContext): SampleWeighing[] {
  // CONTRACT-STUB(§4) knowledge.weighSampleConcentrates
  return [];
}

/** After a sample weighing became a lot (or was taken in kind): the assay check (s04 #4). */
export function afterSampleLot(_draft: GameState, _ctx: StepContext, _claimId: ClaimId, _lotId: LotId | null): void {
  // CONTRACT-STUB(§4) knowledge.afterSampleLot
}

/** Qualifying assessment-work spend of a claim in an assessment year (§6 consumer from P2). */
export function assessmentWorkSpend(_state: GameState, _claimId: ClaimId, _year: number): Cents {
  // CONTRACT-STUB(§4) knowledge.assessmentWorkSpend
  return ZERO_CENTS;
}

/** The reviewer multiplier §3's `revealTells` uses (4.10: skillMult = reviewerMult / 0.78). */
export function reviewerSkillMult(_state: GameState, _reviewer: ReviewerRef): number {
  // CONTRACT-STUB(§4) knowledge.reviewerSkillMult
  return 1;
}

export function wrapUp(_draft: GameState, _ctx: StepContext): void {
  // CONTRACT-STUB(§4) knowledge.wrapUp
}
