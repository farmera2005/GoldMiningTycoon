// §4 knowledge's week scratch and week record (P1 contract §1.3, s02 #10). The scratch carries this week's program
// resource use and costs (written in step 9 (j), read by §9, §8 and §11) and the sample lots weighed in step 12, which
// §2's history snapshot reads; §4 adds its program fields when its package lands. The record lists what became visible.
import type { ClaimId, LotId, ReportId, SampleId } from '../../core/ids';

/** A sample concentrate weighed into a lot this week (step 12; s02 #19, s01 #21). */
export interface SampleLotRecord {
  claimId: ClaimId;
  /** The §10 lot it became, or null when in-kind interests took it all. */
  lotId: LotId | null;
  /** Weighed raw oz of the sample concentrate (prospecting gold: never in the snapshot's `weighedRawOz`). */
  weighedRawOz: number;
  /** Estimated fine oz of the sample lot at creation (counts toward `fineOzRecovered`). */
  fineOzRecovered: number;
}

export interface KnowledgeWeekScratch {
  sampleLots: SampleLotRecord[];
}

export interface KnowledgeWeekRecord {
  samplesCompleted: SampleId[];
  resultsReleased: SampleId[];
  reportsIssued: ReportId[];
}

export function emptyKnowledgeWeekScratch(): KnowledgeWeekScratch {
  return { sampleLots: [] };
}

export function emptyKnowledgeWeekRecord(): KnowledgeWeekRecord {
  return { samplesCompleted: [], resultsReleased: [], reportsIssued: [] };
}
