// §4 prospecting actions (DESIGN §4.16, §2.2; P1 contract §5): this folder's action composition file.
// actions/catalog.ts registers KNOWLEDGE_ACTIONS, and actions/types.ts folds the action union and the code lists into
// `Action`, `ActionErrorCode` and `ActionWarningCode` (s02 #11). Wave 0 registers every row as a stub (NOT_IMPLEMENTED,
// no-op handler, P1 contract §0.2); §4's packages replace each row. Rules fixed by rulings: contractor delivery only for
// `excavatorPit` in P1 (s04 #9); lead time max(1, ceil(base × geology.contractorLeadMult ×
// effective('prospect.contractorLeadTimeMult'))) (s04 #8); pits refused on blocks with areaMined > 0
// (BLOCK_BEING_MINED, s07 #26); open ground allows records reviews only (s04 #7).
import { stubActionDef } from '../../actions/stub';
import type { ActionDef } from '../../actions/types';
import type { ClaimId, ClaimListingId, ContractorId, CreekId, EmployeeId, MachineId, ProgramId } from '../../core/ids';
import type { Cents } from '../../core/money';
import type { GeologistRef, MethodId, PlanningAssumptions, ReviewerRef, SampleTarget } from './types';

export type ProspectAction =
  | {
      type: 'prospect/panSurvey';
      claimId: ClaimId;
      people: (EmployeeId | 'owner')[];
      stations: number;
      ownerTime?: 'queue' | 'now';
    }
  | {
      type: 'prospect/createProgram';
      claimId: ClaimId;
      methodId: MethodId;
      delivery: 'own' | 'contractor';
      targets?: SampleTarget[];
      preset?: 'everyBlock' | 'fences' | 'voiTop';
      sampleBcy?: number;
      crew?: (EmployeeId | 'owner')[];
      machines?: MachineId[];
      geologist?: GeologistRef | null;
      daysPerWeek: number;
      hoursPerDay: number;
      budgetCapCents: Cents;
      order: 'asListed' | 'voi';
    }
  /** Plan, crew, machines, geologist, days, hours, cap. */
  | { type: 'prospect/modifyProgram'; programId: ProgramId; patch: ProgramPatch }
  | { type: 'prospect/pauseProgram' | 'prospect/resumeProgram' | 'prospect/cancelProgram'; programId: ProgramId }
  | {
      type: 'prospect/bookContractor';
      contractorId: ContractorId;
      methodId: MethodId;
      claimId: ClaimId;
      programId: ProgramId;
      earliestTurn: number;
    }
  | { type: 'prospect/recordsReview'; target: { claimId: ClaimId } | { creekId: CreekId }; reviewer: ReviewerRef }
  | {
      type: 'prospect/engageConsultant';
      tier: 'budget' | 'standard' | 'premier';
      scope: 'supervision';
      target: { claimId: ClaimId } | { listingId: ClaimListingId };
      days?: number;
    }
  | { type: 'prospect/setPlanning'; claimId?: ClaimId; assumptions: Partial<PlanningAssumptions> | null };

/** The composition name of this folder's action union (actions/types.ts). */
export type KnowledgeAction = ProspectAction;

/** A program as the planner builds it (P1 contract §4 supporting types). */
export type ProgramDraft = Omit<Extract<ProspectAction, { type: 'prospect/createProgram' }>, 'type'>;
export type ProgramPatch = Partial<Omit<ProgramDraft, 'claimId' | 'methodId' | 'delivery'>>;

export const KNOWLEDGE_ACTIONS: readonly ActionDef[] = [
  stubActionDef('prospect/panSurvey', 4, { reveals: false, commits: false }),
  stubActionDef('prospect/createProgram', 4, { reveals: false, commits: false }),
  stubActionDef('prospect/modifyProgram', 4, { reveals: false, commits: false }),
  stubActionDef('prospect/pauseProgram', 4, { reveals: false, commits: false }),
  stubActionDef('prospect/resumeProgram', 4, { reveals: false, commits: false }),
  stubActionDef('prospect/cancelProgram', 4, { reveals: false, commits: false }),
  stubActionDef('prospect/bookContractor', 4, { reveals: false, commits: true }),
  // Commits only when the reviewer is a consultant (the handler calls markCommits()).
  stubActionDef('prospect/recordsReview', 4, { reveals: false, commits: false }),
  stubActionDef('prospect/engageConsultant', 4, { reveals: false, commits: true }),
  stubActionDef('prospect/setPlanning', 4, { reveals: false, commits: false }),
];

export const KNOWLEDGE_ERROR_CODES = [
  'NO_ACCESS',
  'NOT_IN_SEASON',
  'ACCESS_CLOSED',
  'OWNER_INJURED',
  'VISIT_ALREADY_BOOKED',
  'CREW_UNAVAILABLE',
  'METHOD_NOT_AVAILABLE',
  'MACHINE_UNSUITABLE',
  'MACHINE_NOT_ON_CLAIM',
  'GEOLOGIST_REQUIRED',
  'GEOLOGIST_AT_CAPACITY',
  'INVALID_TARGET',
  'BLOCK_BEING_MINED',
  'PROGRAM_NOT_FOUND',
  'PROGRAM_CLOSED',
  'NO_RIG_AVAILABLE',
  'REVIEW_IN_PROGRESS',
  'CONSULTANT_UNAVAILABLE',
  'INVALID_VALUE',
] as const satisfies readonly string[];

/** `NOT_IN_SEASON` and `PERMIT_REQUIRED` are warnings on createProgram (the program waits). */
export const KNOWLEDGE_WARNING_CODES = [
  'DESK_DAYS_QUEUED',
  'NOT_IN_SEASON',
  'PERMIT_REQUIRED',
] as const satisfies readonly string[];
