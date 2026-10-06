// §4 knowledge's week scratch and week record (P1 contract §1.3, s02 #10). The scratch carries this week's program
// resource use, costs and disturbance (written in step 9 (j), read by §9, §8, §11 and §6) and the sample lots weighed
// in step 12, which §2's history snapshot reads. The record lists what became visible.
import type { ClaimId, LotId, ReportId, SampleId } from '../../core/ids';
import type { ProgramCostLine, ProgramCrewUse, ProgramDisturbance, ProgramMachineUse } from './programTypes';

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
  /** §4.18 machine hours of own-delivery programs (§9 meters and maintenance, §7 program fuel). */
  programMachineUse: ProgramMachineUse[];
  /** §4.18 crew hours of programs (§8). */
  programCrewUse: ProgramCrewUse[];
  /** Program costs §11 bills in 14c (cost center prospecting). */
  programCosts: ProgramCostLine[];
  /** §6's disturbance feed (P2 consumer). */
  programDisturbance: ProgramDisturbance[];
  sampleLots: SampleLotRecord[];
}

export interface KnowledgeWeekRecord {
  samplesCompleted: SampleId[];
  resultsReleased: SampleId[];
  reportsIssued: ReportId[];
}

export function emptyKnowledgeWeekScratch(): KnowledgeWeekScratch {
  return { programMachineUse: [], programCrewUse: [], programCosts: [], programDisturbance: [], sampleLots: [] };
}

export function emptyKnowledgeWeekRecord(): KnowledgeWeekRecord {
  return { samplesCompleted: [], resultsReleased: [], reportsIssued: [] };
}
