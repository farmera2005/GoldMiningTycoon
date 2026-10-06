// §4 knowledge selectors (DESIGN §2.11, §4.14, §4.18; P1 contract §4.4): pure readers over state, spread into `select`
// by select/index.ts. They read the player's records and the estimator's views, never truth; `sampleConc[*].hidden` is
// never returned. A name already used by another folder fails the composition test.
import type { ClaimId, DistrictId, EngagementId, ProgramId, ReportId } from '../../core/ids';
import { sortedKeys, sortedValues } from '../../core/iter';
import type { GameState } from '../../state/types';
import { previewProgram } from './programs';
import type {
  Engagement,
  EstimateSnapshot,
  PlanningAssumptions,
  ProspectContractor,
  ProspectProgram,
  ProspectReport,
  SampleRecord,
} from './types';
import type { FamilyRecords } from '../world/types';
import {
  blockEstimates,
  decisionContext,
  estimateVerdict,
  knownEstimate,
  percentileOz,
  sellerCredibility,
} from './views';

function programs(state: GameState, claimId?: ClaimId): ProspectProgram[] {
  const all = sortedValues(state.knowledge.programs);
  return claimId === undefined ? all : all.filter((p) => p.claimId === claimId);
}

function program(state: GameState, programId: ProgramId): ProspectProgram | null {
  return state.knowledge.programs[programId] ?? null;
}

function reports(state: GameState, claimId?: ClaimId): ProspectReport[] {
  const all = sortedValues(state.knowledge.reports);
  return claimId === undefined ? all : all.filter((r) => r.claimId === claimId);
}

function report(state: GameState, reportId: ReportId): ProspectReport | null {
  return state.knowledge.reports[reportId] ?? null;
}

/** The claim's samples in id order (the player's own records). */
function sampleLog(state: GameState, claimId: ClaimId): SampleRecord[] {
  return sortedValues(state.knowledge.samples).filter((s) => s.claimId === claimId);
}

function estimateHistory(state: GameState, claimId: ClaimId): EstimateSnapshot[] {
  return [...(state.knowledge.history[claimId] ?? [])];
}

/** Contractors serving the district's region. */
function contractors(state: GameState, districtId: DistrictId): ProspectContractor[] {
  const district = state.world.districts[districtId];
  if (district === undefined) return [];
  return sortedValues(state.knowledge.contractors).filter((c) => c.regionIds.includes(district.templateId));
}

function engagements(state: GameState): Engagement[] {
  return sortedValues(state.knowledge.engagements);
}

function engagement(state: GameState, engagementId: EngagementId): Engagement | null {
  return state.knowledge.engagements[engagementId] ?? null;
}

/** The player's planning overrides: a claim's, or the company default (null = tuning defaults). */
function planningAssumptions(state: GameState, claimId?: ClaimId): PlanningAssumptions | null {
  if (claimId !== undefined) return state.knowledge.planning[claimId] ?? state.knowledge.planningDefault;
  return state.knowledge.planningDefault;
}

/** Claims the estimator keeps warm (held, watched or with player evidence). */
function trackedClaimIds(state: GameState): ClaimId[] {
  // CONTRACT-STUB(§4) knowledge.trackedClaimIds (held and watched claims; the sim cap geology.maxTrackedClaimsSim)
  return sortedKeys(state.knowledge.priorStatus);
}

function familyRecords(state: GameState, claimId: ClaimId): FamilyRecords | null {
  return state.knowledge.familyRecords[claimId] ?? null;
}

export const knowledgeSelectors = {
  knownEstimate,
  blockEstimates,
  percentileOz,
  estimateVerdict,
  decisionContext,
  sellerCredibility,
  programs,
  program,
  reports,
  report,
  sampleLog,
  estimateHistory,
  contractors,
  engagements,
  engagement,
  planningAssumptions,
  trackedClaimIds,
  familyRecords,
  previewProgram,
} as const;
