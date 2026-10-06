// §4 player knowledge (DESIGN §4.1–4.8, §4.14). Truth lives in `world` (§3); this section holds evidence and turns
// it into estimates. Estimates are never stored in GameState: they are rebuilt on demand by the pure estimator and
// cached in engine/core/memo.ts (D-4.24). P0 ships the estimator and a minimal slice; programs, reports, contractors,
// engagements, seller checks and snapshots arrive with their phases (§4.19).
import type {
  BlockId,
  ClaimId,
  ContractorId,
  CreekId,
  EmployeeId,
  EngagementId,
  ProgramId,
  RecordFindingId,
  ReportId,
  SampleId,
} from '../../core/ids';
import type {
  BedrockType,
  ClaimPriors,
  OldTimerKind,
  PriorStatus,
  SampleMethodParams,
  SizeClass,
  SizeRecord,
  Tercile,
  FamilyRecords,
} from '../world/types';
import type { SeasonPhase } from '../climate/types';

export type { ClaimPriors, PriorStatus };
export * from './programTypes';
import type {
  DecisionContext,
  Engagement,
  EstimateAnchorRecord,
  EstimateSnapshot,
  ProspectContractor,
  ProspectProgram,
  ProspectReport,
  SampleConcentrate,
  SellerCheck,
} from './programTypes';

// ---------------------------------------------------------------------------------------------------------------------
// Method catalog (DESIGN §4.2; rows live in src/data/prospecting/methods.ts)
// ---------------------------------------------------------------------------------------------------------------------

export type MethodId =
  | 'pan'
  | 'handPit'
  | 'drywasher'
  | 'excavatorPit'
  | 'trench'
  | 'bulkSample'
  | 'auger'
  | 'churn'
  | 'churnHistoric'
  | 'sonic'
  | 'rc'
  | 'geophysics'
  | 'production';

export type MethodFamily = 'surface' | 'handPit' | 'pit' | 'trench' | 'bulk' | 'drill' | 'geophysics' | 'production';
export type MethodUnit = 'station' | 'sample' | 'pit' | 'section' | 'payBcy' | 'ft' | 'lineKm' | 'cleanup';
/** §6 6.3 activity kinds a method needs (names as §6 owns them; P0 has no §6 types yet). */
export type ProspectActivity = 'handSample' | 'handSluice' | 'mechSample' | 'bulkSample' | 'drill';
/** How the sample volume is set: fixed per unit, per ft of sampled pay column (drills), or a player choice (pits). */
export type SampleVolumeRule =
  | { readonly kind: 'fixed'; readonly bcy: number }
  | { readonly kind: 'perFtOfColumn'; readonly bcyPerFt: number }
  | { readonly kind: 'choices'; readonly bcy: readonly number[]; readonly defaultBcy: number }
  | { readonly kind: 'range'; readonly minBcy: number; readonly maxBcy: number; readonly defaultBcy: number }
  | { readonly kind: 'none' };

export interface OwnDelivery {
  /** Crew by §8 role id. */
  readonly crew: Readonly<Partial<Record<string, number>>>;
  /** §9 machine classes or site tools that can do the work. */
  readonly machineClasses: readonly string[];
  readonly unitsPerPersonDay?: number;
  readonly unitsPerCrewDay?: number;
  readonly consumablesUsdPerUnit: number;
  readonly toolRentUsdPerDay?: number;
}

export interface ContractorTerms {
  readonly rateUsdPerUnit?: number;
  readonly rateUsdPerDay?: number;
  readonly unitsPerDay: number;
  readonly mobUsd: number;
  readonly standbyUsdPerDay?: number;
  readonly minUnits?: number;
  /** Ground slowdowns: rate × (1 − bouldersSlow × boulders). */
  readonly bouldersSlow?: number;
}

/**
 * One method row (§4.2.A logistics + §4.2.B measurement). DESIGN §4.2 prints `SamplingMethodSpec extends
 * SampleMethodParams`; the draw parameters sit in `draw` here because geophysics and production rows have none.
 */
export interface SamplingMethodSpec {
  readonly id: MethodId;
  readonly family: MethodFamily;
  readonly unit: MethodUnit;
  readonly activity: ProspectActivity | null;
  /** §3 SampleMethodParams for drawSample; null for geophysics and production (no particle draw). */
  readonly draw: SampleMethodParams | null;
  /** excavatorPit and trench reach to the machine's §9 reachFt (draw.maxDepthFt is null in the row). */
  readonly depthLimit: 'row' | 'machineReach';
  readonly sampleBcy: SampleVolumeRule;
  readonly reportsClassMasses: boolean;
  readonly informsSizeMix: boolean;
  readonly falseBedrockP: number;
  readonly requiresGeologist: boolean;
  /** Pit gold is credited to inventory; pan and drill gold is consumed (D-4.23). */
  readonly credited: boolean;
  readonly seasonMult: Readonly<Record<SeasonPhase, number>>;
  readonly own?: OwnDelivery;
  readonly contractor?: ContractorTerms;
  readonly disturbanceAcPerUnit: number;
  readonly backfilled: boolean;
  readonly resultLagWeeks: number;
  /** Lab fees, $ per sampled interval (drills; §4.2 logistics notes). */
  readonly labUsdPerPayInterval?: number;
  readonly labUsdPerBarrenInterval?: number;
}

// ---------------------------------------------------------------------------------------------------------------------
// Evidence (DESIGN §4.1, §4.3, §4.10)
// ---------------------------------------------------------------------------------------------------------------------

export type SampleInterval = 'fullColumn' | 'upperPay' | 'exposure' | 'overburdenOnly' | 'tailings';
export type SampleSource = 'own' | 'production' | 'recordsHistoric' | 'sellerVerified';
export type SampleFlag = 'shortOfBedrock' | 'suspectFalseBedrock' | 'nuggetHit' | 'pocketHit' | 'blank';

export interface LoggedBy {
  readonly kind: 'owner' | 'staff' | 'consultant' | 'none';
  readonly employeeId?: EmployeeId;
  /** The skill the estimator uses (résumé midpoint for staff, D-4.9); the draw used the true skill. */
  readonly shownSkill: number;
}

export interface SampleObservedLog {
  readonly overburdenFt?: number;
  readonly depthToBedrockFt?: number;
  readonly payThicknessFt?: number;
  readonly bedrockType?: BedrockType;
  readonly permafrost: boolean;
  /** Ground terciles as logged (absent on historic logs that did not record them). */
  readonly clay?: Tercile;
  readonly boulders?: Tercile;
  readonly waterInflow: boolean;
  readonly oldWorkings: boolean;
}

export interface ProductionRow {
  readonly cleanupTurn: number;
  readonly inSituBcy: number;
  readonly ozAttributedWeighed: number;
  readonly chainFactor: number;
  readonly audited: boolean;
  readonly bulkSampleProgramId?: ProgramId;
}

/** DESIGN §4.3. Masses rounded to 0.01 mg and volumes to 0.001 bcy at storage time. */
export interface SampleRecord {
  readonly id: SampleId;
  readonly claimId: ClaimId;
  readonly blockId: BlockId;
  readonly methodId: MethodId;
  readonly programId?: ProgramId;
  readonly drawIndex: number;
  readonly source: SampleSource;
  readonly turn: number;
  readonly availableTurn: number;
  readonly production?: ProductionRow;
  /** §3 volumeMeasuredBcy (reported). */
  readonly volumeBcy: number;
  readonly interval: SampleInterval;
  readonly bedrockLogged: boolean;
  readonly depthReachedFt: number;
  /** Bedrock taken into the sample when it differs from the method row (bulk samples take the plan's cleanup). */
  readonly bedrockPenFt?: number;
  readonly observed: SampleObservedLog;
  readonly colours: SizeRecord;
  /** Sieved class masses (pits, trenches, bulk); null for colour-only methods (pans, drills). */
  readonly massMg: SizeRecord | null;
  readonly recoveredMg: number;
  readonly headGradeOzPerBcy: number;
  readonly ncGradeOzPerBcy: number;
  readonly loggedBy: LoggedBy;
  readonly flags: readonly SampleFlag[];
}

export type RecordItem = 'creekHistory' | 'oldWorkings' | 'priorExploration' | 'filedProduction' | 'permitHistory';

export type ReviewerRef =
  | { readonly kind: 'owner'; readonly geologist: boolean }
  | { readonly kind: 'staff'; readonly employeeId?: EmployeeId; readonly trueSkill: number }
  | { readonly kind: 'consultant'; readonly tier: ConsultantTier };

export type ConsultantTier = 'budget' | 'standard' | 'premier';

/** DESIGN §4.10.4 RecordFinding. */
export interface RecordFinding {
  readonly id: RecordFindingId;
  readonly claimId?: ClaimId;
  readonly creekId?: CreekId;
  readonly turn: number;
  readonly item: RecordItem;
  readonly reviewer: ReviewerRef;
  readonly payload: {
    readonly histOz?: number;
    readonly histBcy?: number;
    readonly era?: readonly [number, number];
    readonly kind?: OldTimerKind;
    readonly workedBlocks?: readonly { readonly blockId: BlockId; readonly kind: OldTimerKind }[];
    readonly sampleIds?: readonly SampleId[];
    readonly filedProduction?: readonly { readonly year: number; readonly rawOz: number }[];
    readonly permitNotes?: readonly string[];
  };
}

/** What the player can see of a block's state (Block.state is visible, §3.5.1). */
export interface KnownBlockState {
  /** Share of the block's area mined out (§7 areaMined; recent-operator blocks are fully mined, §3.6). */
  readonly minedFrac: number;
  /** Pay bcy removed by the player's samples. */
  readonly sampledBcy: number;
  /** Overburden already stripped, ft (strippedBcy / 1,613 / acres). */
  readonly strippedFt: number;
}

/** A fineness assay of pooled sample or cleanup gold (§4.7 Fineness). */
export interface FinenessAssay {
  readonly value: number;
  readonly sd: number;
  readonly source: 'sample' | 'cleanup';
}

/**
 * Everything the estimator may use about one claim besides its public prior (§4.1). It never carries truth: a
 * function of the player's records only. Samples are folded in ascending SampleId order, so acquisition order never
 * changes an estimate (order independence, §4.22).
 */
export interface EvidenceSet {
  readonly claimId: ClaimId;
  readonly samples: readonly SampleRecord[];
  readonly records: readonly RecordFinding[];
  /** Sparse: blocks the player has touched (absent = untouched). */
  readonly blockState: Readonly<Partial<Record<BlockId, KnownBlockState>>>;
  readonly assays: readonly FinenessAssay[];
  /** A geologist (owner, staff or engaged consultant) works the claim: enables the false-bedrock check (§4.6). */
  readonly geologistOnClaim: boolean;
}

// ---------------------------------------------------------------------------------------------------------------------
// Planning (DESIGN §4.7)
// ---------------------------------------------------------------------------------------------------------------------

export interface PlanningAssumptions {
  readonly price: 'ema13' | 'spot' | { readonly usdPerFineOz: number };
  readonly payable: number;
  /** 'auto' = Σ_c sizeMixP50_c × recoveryBySize_c × (1 − recClay·clay). */
  readonly recovery: 'auto' | number;
  readonly mineWashUsdPerPayBcy: number;
  readonly stripUsdPerBcy: number;
  readonly miningLossFrac: number;
  readonly dilutionFrac: number;
}

/**
 * The market inputs the economic layer needs that are not the player's choices. P0 has no §10 market and no §7
 * plant, so the caller passes them explicitly (P1: flat $4,200 for both prices, sluice-only recovery anchors).
 */
export interface PlanningContext {
  /** §10 EMA13 and spot of the week (P1 flat). */
  readonly ema13UsdPerFineOz: number;
  readonly spotUsdPerFineOz: number;
  /** §10 market.openingSpotUsdPerFineOz: the anchor of the 2% repricing grid. */
  readonly refSpotUsdPerFineOz: number;
  /** §7 recoveryBySize of the claim's plant (sluice-only anchor when there is none). */
  readonly recoveryBySize: SizeRecord;
}

// ---------------------------------------------------------------------------------------------------------------------
// Estimates (DESIGN §4.7, §4.8)
// ---------------------------------------------------------------------------------------------------------------------

export type ConfidenceClass = 'speculative' | 'inferred' | 'indicated' | 'measured';
export const CONFIDENCE_CLASSES: readonly ConfidenceClass[] = ['speculative', 'inferred', 'indicated', 'measured'];

export interface ConfidenceGates {
  readonly spread: number;
  readonly cov0: number;
  readonly cov2: number;
  readonly coarseSd: number;
  readonly processedBcy: number;
  readonly bedrockSamples: number;
  readonly productionBcy: number;
  readonly bulkBlocks: number;
  readonly belowCutoff: boolean;
  readonly failing: readonly { readonly cls: ConfidenceClass; readonly gate: string }[];
}

export interface BlockEstimate {
  readonly blockId: BlockId;
  /** Total grade incl. coarse, metal oz per bcy of the pay column. */
  readonly gradeP10: number;
  readonly gradeP50: number;
  readonly gradeP90: number;
  /** Mixture mean and sd of ln G_b (for calibration and the heat map's hatching). */
  readonly lnGradeMean: number;
  readonly lnGradeSd: number;
  readonly sampleCount: number;
  readonly sampledVolumeBcy: number;
  readonly bedrockSamples: number;
  /** P(f ≥ 0.4) over the hypothesis mixture. */
  readonly pStreak: number;
  readonly depthToBedrockFtP50: number;
  readonly payColumnFtP10: number;
  readonly payColumnFtP50: number;
  readonly payColumnFtP90: number;
  readonly overburdenFtP10: number;
  readonly overburdenFtP50: number;
  readonly overburdenFtP90: number;
  readonly strip50: number;
  readonly remainingFrac: number;
  readonly containedOzP10: number;
  readonly containedOzP50: number;
  readonly containedOzP90: number;
  readonly costUsdPerPayBcy50: number;
  readonly marginUsdPerPayBcy50: number;
  readonly cutoffOzPerBcy: number;
  readonly minable: boolean;
  readonly confidence: ConfidenceClass;
  readonly worked?: OldTimerKind;
  readonly pocket?: 'confirmed';
}

export interface ClaimEstimate {
  readonly claimId: ClaimId;
  readonly evidenceHash: string;
  readonly independent: boolean;
  readonly priorStatus: PriorStatus;
  readonly containedOzP10: number;
  readonly containedOzP50: number;
  readonly containedOzP90: number;
  readonly containedOzMean: number;
  readonly spreadFactor: number;
  /** Without the pocket term (§4.7): feeds the confidence gates. */
  readonly baseContainedOzP10: number;
  readonly baseContainedOzP50: number;
  readonly baseContainedOzP90: number;
  readonly baseSpreadFactor: number;
  readonly pocketUpsideOzMean: number;
  readonly pBarrenCreek: number;
  readonly minableOzP10: number;
  readonly minableOzP50: number;
  readonly minableOzP90: number;
  readonly minableBcy: number;
  readonly minableBlockIds: readonly BlockId[];
  readonly avgStrip: number;
  readonly avgMinableGradeP50: number;
  readonly recovery: number;
  readonly recoverableRawOzP50: number;
  readonly fineOzP50: number;
  readonly costUsdPerPayBcyM: number;
  readonly confidence: ConfidenceClass;
  readonly gates: ConfidenceGates;
  /** ALLOY fineness (fine oz per metal oz, §2.4). */
  readonly finenessP50: number;
  readonly finenessSd: number;
  readonly sizeMixP50: SizeRecord;
  /** 1 + R (paystreak centre). */
  readonly coarseFactorP10: number;
  readonly coarseFactorP50: number;
  readonly coarseFactorP90: number;
  /** sd of ln R (Gamma posterior). */
  readonly coarseLogSd: number;
  readonly planning: PlanningAssumptions;
  readonly planningPriceUsed: number;
  readonly hypotheses: { readonly evaluated: number; readonly surviving: number };
}

export interface EstimateResult {
  readonly claim: ClaimEstimate;
  readonly blocks: readonly BlockEstimate[];
}

// ---------------------------------------------------------------------------------------------------------------------
// The slice (DESIGN §4.1; P0 minimal shape)
// ---------------------------------------------------------------------------------------------------------------------

/**
 * §4.1 `KnowledgeSlice` (P1 contract §4.4): the P0 evidence stores plus programs, reports, engagements, contractors,
 * seller checks, planning overrides, decision contexts, the pooled sample concentrate and its assays, snapshot history,
 * last class, the incremental path's anchors and the Inheritor's family records. Every P1 store starts empty (N8b fills
 * the contractors). `sampleConc[*].hidden` is the only hidden field (scrambler s04).
 */
export interface KnowledgeSlice {
  samples: Record<SampleId, SampleRecord>;
  sampleIds: SampleId[];
  /** `${blockId}|${methodId}` → next per-block draw index k (the RNG key of §4.3). */
  drawIndex: Record<string, number>;
  records: Record<RecordFindingId, RecordFinding>;
  recordIds: RecordFindingId[];
  /** Fixed when the claim first gets player evidence (D-4.44). */
  priorStatus: Record<ClaimId, PriorStatus>;
  programs: Record<ProgramId, ProspectProgram>;
  programIds: ProgramId[];
  reports: Record<ReportId, ProspectReport>;
  reportIds: ReportId[];
  /** Records reviews and consultants (s04 #5). */
  engagements: Record<EngagementId, Engagement>;
  engagementIds: EngagementId[];
  /** Filled at N8b from data/prospecting/contractors.ts. */
  contractors: Record<ContractorId, ProspectContractor>;
  contractorIds: ContractorId[];
  /** Keyed by ClaimListingId, or ClaimId for the Inheritor's family records. */
  sellerChecks: Record<string, SellerCheck>;
  /** Per-claim overrides of planningDefault (s04 #6). */
  planning: Record<ClaimId, PlanningAssumptions>;
  planningDefault: PlanningAssumptions | null;
  /** Player overrides only; defaults are derived (4.11). Empty in P1. */
  decisionContext: Record<ClaimId, DecisionContext>;
  /** s04 #19. */
  sampleConc: Record<ClaimId, SampleConcentrate>;
  /** Sample-gold assays and the per-claim counter that keys `rng(seed,'prospect',claimId,'assay',n)` (s04 #4, Q1). */
  assays: Record<ClaimId, FinenessAssay[]>;
  assayCount: Record<ClaimId, number>;
  /** Fan-chart points, ≤ 52 per claim. */
  history: Record<ClaimId, EstimateSnapshot[]>;
  /** For "class changed" alerts. */
  lastClass: Record<ClaimId, ConfidenceClass>;
  /** The incremental path's anchors (s04 #1). */
  anchors: Record<ClaimId, EstimateAnchorRecord>;
  /** §3.6.1 Inheritor records (shown, never admitted). */
  familyRecords: Record<ClaimId, FamilyRecords>;
}

export function emptyKnowledgeSlice(): KnowledgeSlice {
  return {
    samples: {},
    sampleIds: [],
    drawIndex: {},
    records: {},
    recordIds: [],
    priorStatus: {},
    programs: {},
    programIds: [],
    reports: {},
    reportIds: [],
    engagements: {},
    engagementIds: [],
    contractors: {},
    contractorIds: [],
    sellerChecks: {},
    planning: {},
    planningDefault: null,
    decisionContext: {},
    sampleConc: {},
    assays: {},
    assayCount: {},
    history: {},
    lastClass: {},
    anchors: {},
    familyRecords: {},
  };
}

export type { SizeClass, SizeRecord };
