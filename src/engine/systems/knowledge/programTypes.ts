// §4 programs, reports, seller checks, engagements and the week handoffs (DESIGN §4.1, §4.10.4, §4.11, §4.12, §4.14,
// §4.18; P1 contract §4.4), re-exported by knowledge/types.ts. `sampleConc[*].hidden` (in the slice) is the only hidden
// §4 store; everything here is visible.
import type { ActionWarning } from '../../actions/types';
import type {
  BlockId,
  ClaimId,
  ClaimListingId,
  ContractorId,
  CreekId,
  EmployeeId,
  EngagementId,
  MachineId,
  ProgramId,
  RecordFindingId,
  ReportId,
  SampleId,
} from '../../core/ids';
import type { Cents, MilliOz } from '../../core/money';
import type { AccountCode } from '../finance/accounts';
import type { MachineWeekHours } from '../ops/types';
import type { Role } from '../staff/types';
import type { RegionTemplateId } from '../world/enums';
import type { ConfidenceClass, MethodId, PlanningAssumptions, ReviewerRef } from './types';

/** A text template key (§13's catalogs render it). */
export type TemplateKey = string;

export type SellerCheckStatus = 'unchecked' | 'consistent' | 'questionable' | 'implausible' | 'verified' | 'contradicted';

export type SellerFlag =
  | 'gradeImplausible'
  | 'undisclosedSampling'
  | 'productionUnsupported'
  | 'saltingSigns'
  | 'screenedFeedGrade'
  | 'twinMismatch';

/** §4.10 the claim-wide plausibility test of a listing's (or a family's) claims. */
export interface SellerCheck {
  /** ClaimId for Inheritor family records. */
  listingId: ClaimListingId | ClaimId;
  status: SellerCheckStatus;
  z?: number;
  pHonest?: number;
  flags: SellerFlag[];
  twins: { blockId: BlockId; sellerGrade: number; z: number }[];
  tellIds: string[];
  updatedTurn: number;
}

/** §4.1 where an estimate's evidence came from. */
export type EvidenceRef =
  | { kind: 'sample'; sampleId: SampleId }
  | { kind: 'production'; sampleId: SampleId }
  | { kind: 'records'; recordId: RecordFindingId }
  | { kind: 'familyRecords'; recordId: RecordFindingId }
  | { kind: 'tell'; tellId: string; listingId: ClaimListingId }
  | { kind: 'geophysics'; lineId: string; programId: ProgramId }
  | { kind: 'sellerClaim'; listingId: ClaimListingId; status: SellerCheckStatus }
  | { kind: 'report'; reportId: ReportId };

/** §4.12 what a program samples. */
export type SampleTarget =
  | { blockId: BlockId; units: number; target?: 'inSitu' | 'oldTailings' }
  /** Cross-valley line of pits or holes. */
  | { kind: 'fence'; row: number; spacingFt: number }
  /** Trench or geophysics line. */
  | { kind: 'line'; fromBlockId: BlockId; toBlockId: BlockId };

export type GeologistRef =
  | { kind: 'owner' }
  | { kind: 'staff'; employeeId: EmployeeId }
  | { kind: 'consultant'; engagementId: EngagementId };

/** §4.11 a value-of-information hint. */
export interface VoiHint {
  candidate: 'pits' | 'trench' | 'bulk' | 'drillFence' | 'records' | 'geophysics';
  methodId?: MethodId;
  targets: SampleTarget[];
  costUsd: number;
  weeks: number;
  spreadNow: number;
  spreadAfter: number;
  classAfter: ConfidenceClass;
  evsiUsd?: number;
  note: TemplateKey;
}

/** §4.11 the decision an estimate is read against; stored only when the player sets it. */
export interface DecisionContext {
  kind: 'buy' | 'develop';
  source: 'default' | 'player';
  basis: 'footprint' | 'perBlock' | 'claim';
  /** Footprint or claim basis: O_be; perBlock: Σ_b O_be,b (display). */
  breakevenOz: number;
  askUsd?: number;
  setTurn: number;
}

/** §4.14 the verdict line above the fan chart (D-4.45). */
export interface EstimateVerdict {
  lowOz: number;
  highOz: number;
  set: 'footprint' | 'claim' | 'minable' | 'contained';
  blocks: number;
  pPays?: number;
  contextKind?: 'buy' | 'develop';
  contextSource?: 'default' | 'player';
  biggestUnknown:
    | 'creekBarren'
    | 'records'
    | 'unsampledGround'
    | 'paystreakEdges'
    | 'coarseGold'
    | 'depthToBedrock'
    | 'none';
  text: TemplateKey;
}

/** §4.12 why a program paused (checked in this order each week). */
export type ProgramBlockCode =
  | 'NO_ACCESS'
  | 'PERMIT_REQUIRED'
  | 'DISTURBANCE_CAP'
  | 'BULK_SAMPLE_LIMIT'
  | 'NOT_IN_SEASON'
  | 'CREW_UNAVAILABLE'
  | 'MACHINE_UNAVAILABLE'
  | 'GEOLOGIST_REQUIRED'
  | 'RIG_NOT_ON_SITE';

export type ProgramCostLineKey =
  | 'contractor'
  | 'mobilization'
  | 'demobilization'
  | 'standby'
  | 'lab'
  | 'consumables'
  | 'testPlant'
  | 'machineHours'
  | 'crewAllocated'
  | 'consultant';

/** §4.12 a prospecting, drilling, bulk-sample or geophysics program. */
export interface ProspectProgram {
  id: ProgramId;
  kind: 'prospecting' | 'drilling' | 'bulkSample' | 'geophysics';
  claimId: ClaimId;
  methodId: MethodId;
  delivery: 'own' | 'contractor';
  plan: {
    targets: SampleTarget[];
    sampleBcy?: number;
    order: 'asListed' | 'voi';
    preset?: 'everyBlock' | 'fences' | 'voiTop';
  };
  crew: EmployeeId[];
  machines: MachineId[];
  geologist: GeologistRef | null;
  contractorBookingId?: string;
  daysPerWeek: number;
  hoursPerDay: number;
  budgetCapCents: Cents;
  status:
    | 'planned'
    | 'awaitingAccess'
    | 'awaitingPermit'
    | 'awaitingContractor'
    | 'awaitingSeason'
    | 'mobilizing'
    | 'active'
    | 'paused'
    | 'complete'
    | 'cancelled';
  pauseReason?: ProgramBlockCode;
  progress: { unitsDone: number; unitsTotal: number; carryHours: number; carryUnits: number; footageDone?: number };
  costToDateCents: Cents;
  costByLine: Record<ProgramCostLineKey, Cents>;
  disturbedAcres: number;
  sampleIds: SampleId[];
  pendingResults: { sampleId: SampleId; availableTurn: number }[];
  createdTurn: number;
  startTurn?: number;
  endTurn?: number;
  reportIds: ReportId[];
}

/** §4.12 a contractor (one pitting contractor per region in P1, filled at N8b). */
export interface ProspectContractor {
  id: ContractorId;
  name: string;
  regionIds: RegionTemplateId[];
  methods: MethodId[];
  rigs: number;
  /** 0.9–1.15 around the catalog rate. */
  rateMult: number;
  /** sonic 6, rc 4, auger 2, churn 10, geophysics 3, pitting 1. */
  leadWeeksBase: number;
  bookings: { programId: ProgramId; fromTurn: number; toTurn: number }[];
}

/** §4.12 an estimate snapshot (fan-chart point). */
export interface EstimateSnapshot {
  turn: number;
  containedOz: [number, number, number];
  minableOz: [number, number, number];
  confidence: ConfidenceClass;
  pBarren: number;
  evidenceCount: number;
  trigger: 'program' | 'records' | 'production' | 'seller' | 'price' | 'report';
}

/** §4.12 recommendation rules R1–R10. */
export type RecommendationRule = 'R1' | 'R2' | 'R3' | 'R4' | 'R5' | 'R6' | 'R7' | 'R8' | 'R9' | 'R10';

export interface Recommendation {
  rule: RecommendationRule;
  text: TemplateKey;
  candidate?: VoiHint;
}

/** §4.12 a results report. */
export interface ProspectReport {
  id: ReportId;
  kind: 'program' | 'records' | 'consultantPER' | 'review' | 'technical';
  claimId: ClaimId;
  programId?: ProgramId;
  turn: number;
  sampleIds: SampleId[];
  before: EstimateSnapshot;
  after: EstimateSnapshot;
  costs: Record<string, Cents>;
  findings: TemplateKey[];
  recommendations: Recommendation[];
  independent: boolean;
  validUntilTurn?: number;
  /** PER/technical: the standard case (4.15), not the player's. */
  planningUsed: PlanningAssumptions;
}

/** §4.10.4 records reviews and consultants (D-4.63; s04 #5). */
export interface Engagement {
  id: EngagementId;
  kind: 'recordsReview' | 'consultant';
  reviewer: ReviewerRef;
  target: { claimId?: ClaimId; creekId?: CreekId; listingId?: ClaimListingId };
  status: 'awaitingDesk' | 'booked' | 'active' | 'delivered' | 'cancelled';
  startTurn: number | null;
  dueTurn: number | null;
  daysBilled: number;
  reportId?: ReportId;
  tier?: 'budget' | 'standard' | 'premier';
  scope?: 'supervision' | 'per' | 'review' | 'technical';
}

/** §4.7 / s04 #1 the incremental path's frozen anchor (estimator-core's EstimateAnchor shape). */
export interface EstimateAnchorRecord {
  turn: number;
  /** Blocks fully mined out at the anchor. */
  minedBlockIds: BlockId[];
  /** Overburden stripped per block at the anchor, ft (> 0 only). */
  strippedFt: Partial<Record<BlockId, number>>;
}

/** §4.7 / s04 #19 the pooled sample concentrate of a claim. `hidden` is engine-only (scrambled by §4's scrambler). */
export interface SampleConcentrate {
  /** Visible: Σ logged recovered mg not yet weighed. */
  recoveredMgLogged: number;
  /** Visible: weighed sample mg since the last assay (D-4.62). */
  mgSinceAssay: number;
  hidden: {
    metalOz: number;
    fineOz: number;
    /** §3's sample gold lines (metal oz), read by the §2.14 conservation test. */
    lines: { capture: number; processing: number; variance: number };
  };
}

/** §4.15 a program's request for own machines and crew this week (§7 step 9(f), program first). */
export interface ProgramResourceRequest {
  programId: ProgramId;
  machineId?: MachineId;
  employeeId?: EmployeeId | 'owner';
  hours: number;
}

/** §4.18 machine hours a program used this week (§9 meters and flat maintenance, §7 fuel). */
export interface ProgramMachineUse {
  programId: ProgramId;
  claimId: ClaimId;
  machineId: MachineId;
  hours: MachineWeekHours;
}

/** §4.18 crew hours a program used this week (§8 overtime, fatigue, injuries, cost allocation). */
export interface ProgramCrewUse {
  employeeId: EmployeeId | 'owner';
  programId: ProgramId;
  claimId: ClaimId;
  role: Role;
  /** 7 entries: granted hours spread over the program's worked days. */
  byDay: number[];
  supervisingGeologist: EmployeeId | 'owner' | EngagementId | null;
}

/** A program cost billed by §11 in 14c (cost center prospecting). */
export interface ProgramCostLine {
  programId: ProgramId;
  claimId: ClaimId;
  account: AccountCode;
  cents: Cents;
  memo: string;
  vendor: 'contractor' | 'lab' | 'consultant' | 'supplies' | 'rental' | 'none';
}

/** §4.18 disturbance §6 receives (own-fleet bulk samples are §7's). */
export interface ProgramDisturbance {
  claimId: ClaimId;
  acres: number;
  type: 'explorationPit';
  backfilled: boolean;
}

/** A sample-concentrate weighing of step 12 (12.2); the truth fields are hidden and go to §10 `addLot`. */
export interface SampleWeighing {
  claimId: ClaimId;
  rawMilliOz: MilliOz;
  trueAlloyFineness: number;
  trueDirtFrac: number;
}

/** `previewProgram` (S13-9): the planner's preview, never a dry-run applyAction. */
export interface ProgramPreview {
  costCents: Cents;
  weeks: number;
  units: number;
  disturbedAcres: number;
  warnings: ActionWarning[];
}
