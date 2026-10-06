// §7 operations slice of GameState and its report records (DESIGN §7.1, §7.2, §7.3, §7.6.8, §7.8, §7.11, §7.13, §7.14,
// §7.16; D-7.64; P1 contract §4.7). Hidden (scrambler s07): every gold field (pad, box, BlockOps oz, tailings, stolen,
// skimmed, `lostSinceAudit`, `lostOnTenureEndRawOz`), the hidden WeekOpsResult fields in `lastWeek`,
// `MachineWeekHours.operatorSkill` and `CleanupResult.skimOz`. The kernel's shapes (GroundCtx, CircuitKey) are the same
// types, re-exported from ./kernel so the two never drift.
import type { ActionWarning } from '../../actions/types';
import type {
  BlockId,
  ClaimId,
  EmployeeId,
  Id,
  LineId,
  LotId,
  MachineId,
  ProductionInterestId,
  ProgramId,
  SiteWorkOrderId,
  WellId,
} from '../../core/ids';
import type { Cents, MilliOz } from '../../core/money';
import type { AccountCode } from '../finance/accounts';
import type { CostCenter } from '../finance/types';
import type { DisturbanceType } from '../permits/types';
import type { Range } from '../staff/types';
import type { SizeClass, SizeRecord } from '../world/enums';
import type { CircuitKey, GroundCtx } from './kernel/types';

export type { CircuitKey, GroundCtx } from './kernel/types';
export type { LineId } from '../../core/ids';

export type SiteStatus = 'none' | 'mobilizing' | 'ready' | 'running' | 'winterizing' | 'winterized' | 'demobilizing';
export type OpsRole = 'strip' | 'dig' | 'haul' | 'feed' | 'plant' | 'water' | 'power' | 'support' | 'reclaim';
export type CutSource = 'inSitu' | 'oldTailings' | 'ownTailings' | 'pileThenInSitu';
export type FeedMode = 'padLoader' | 'truckDirect' | 'excavatorDirect' | 'none';
export type Stage =
  'strip' | 'pay' | 'thaw' | 'dig' | 'haul' | 'feed' | 'plant' | 'water' | 'power' | 'fuel' | 'tailings' | 'crew';
export type IdleCause =
  | 'unstaffed'
  | 'operatorAbsent'
  | 'servicing'
  | 'coordination'
  | 'weather'
  | 'season'
  | 'breakdown'
  | 'cleanup'
  | 'plantMove'
  | 'startup'
  | 'program'
  | 'starved'
  | 'blocked'
  | 'water'
  | 'power'
  | 'fuel'
  | 'tailings'
  | 'noWork'
  | 'permitLimit'
  | 'redeployed';

/** Recovered or contained gold: rawOz = metal (alloy) oz by size; fineOz = Σ raw × source alloy fineness. */
export interface GoldParcel {
  rawOz: Record<SizeClass, number>;
  fineOz: number;
}

/** A well-mixed stockpile (every draw is pro rata); clay and boulders are bcy-weighted averages; gold is hidden. */
export interface Pile {
  bcy: number;
  frozenBcy: number;
  gold: GoldParcel;
  clay: number;
  boulders: number;
  /** Source composition: in-situ bcy by block. */
  bcyByBlock: Record<BlockId, number>;
  /** Pile and own-tailings bcy. */
  pileBcy: number;
}

/** Keyed by its block (one pond per block); empty in P1. */
export interface Pond {
  blockId: BlockId;
  capacityBcy: number;
  sludgeBcy: number;
}

/** §7.6.6 a drilled water well (yield hidden until ready, D-7.64). */
export interface Well {
  id: WellId;
  status: 'drilling' | 'ready';
  readyTurn: number;
  yieldGpm: number | null;
  depthFt: number;
  drilledTurn: number;
}

export interface SeasonTotals {
  year: number;
  bcyStripped: number;
  bcyWashed: number;
  rawOzWeighed: number;
  plantHours: number;
  costCents: Cents;
}

/** §7.6.8 site works: P1 uses 'plantMove' and 'clear'. */
export interface SiteWorkOrder {
  id: SiteWorkOrderId;
  kind:
    'plantMove' | 'pondBuild' | 'pondCleanout' | 'clear' | 'reclaim' | 'finalReclaim' | 'reseed' | 'abatement' | 'prep';
  blockId?: BlockId;
  bcyLeft?: number;
  machineHoursLeft?: number;
  /** P1 plant moves (D-7.64). */
  plantMoveHoursLeft?: number;
  reclamation: boolean;
  /** §6 order or §12 preparation. */
  sourceRef?: Id;
}

/** §7.3 per-block progress; the oz fields are hidden. */
export interface BlockOps {
  surface: 'vegetated' | 'cleared' | 'stripping' | 'payExposed' | 'minedOut' | 'backfilled' | 'reclaimed';
  /** = Block.state.thawProgress: ft thawed below the current exposed surface. */
  thawedFt: number;
  stripBcyTotal: number;
  payColumnFt: number;
  payBcyTotal: number;
  /** 0..1. */
  areaMined: number;
  goldRemaining: number;
  extracted: number;
  leftInPit: number;
  lostToWaste: number;
  /** Open pit capacity for backfill and tailings, loose cubic yards (7.13). */
  voidLcy: number;
}

/** §7.14 an own tailings deposit (gold = lost oz by size, hidden). */
export interface TailingsDeposit {
  blockId: BlockId;
  bcy: number;
  gold: GoldParcel;
  kind: 'plant' | 'goldRoom';
  firstTurn: number;
  lastTurn: number;
}

/** §7.13 acres disturbed. */
export interface DisturbanceLedger {
  disturbedAcres: number;
  reclaimedAcres: number;
  openAcres: number;
  byFeature: Record<'block' | 'dump' | 'tailings' | 'pond' | 'site' | 'road', number>;
}

/** §7.10 a tailings audit's visible result (ring of 4 per claim, D-7.64). */
export interface TailingsAuditReport {
  turn: number;
  lineId: LineId;
  /** The audit's estimate of plant capture by size (visible). */
  recoveryBySize: SizeRecord;
  costCents: Cents;
}

/** §1 end report's per-claim season summary (last 10, D-7.64). */
export interface ClaimSeasonSummary {
  year: number;
  washedBcy: number;
  weighedRawOz: number;
  plantIdleHoursByCause: Partial<Record<IdleCause, number>>;
}

/** §7.2.1 one plant line's process state; kept while its pad or box holds anything. */
export interface LineOps {
  lineId: LineId;
  pad: Pile;
  /** Recovered metal held in this line's riffles and concentrators (hidden). */
  inBox: GoldParcel;
  sinceCleanup: {
    weeks: number;
    bcyWashed: number;
    plantHours: number;
    bcyByBlock: Record<BlockId, number>;
    inSituBcyByBlock: Record<BlockId, number>;
    pileBcy: number;
    visCaptureBcy: Record<SizeClass, number>;
    foremanEstRawOz: number;
  };
  tailingsSurgeBcy: number;
  /** Plant losses since the last audit (hidden, scrambled). */
  lostSinceAudit: { sinceTurn: number; bySize: Record<SizeClass, number> };
  /** Excavator-direct feed since the last plant shift (7.6.4). */
  directFeedBcySinceShift: number;
}

/** §7.2.1 a plant line of the mine plan. */
export interface PlantLine {
  lineId: LineId;
  /** false = line standby: forced cleanup, pad kept, its machines free for other roles. */
  active: boolean;
  cutBlockIds: BlockId[];
  plantMachineId: MachineId | null;
  machineIds: MachineId[];
  plantSiteBlockId: BlockId;
  stockpileCapBcy: number;
  plantFeedTargetBcyHr: number;
  /** 1–8; 0 = on demand only. */
  cleanupEveryWeeks: number;
  cleanupOnOffDay: boolean;
}

/** §7.2 the mine plan. */
export interface MinePlan {
  claimId: ClaimId;
  /** ≥ 1: exactly L1 … Ln in order, n ≤ maxPlantLines. */
  lines: PlantLine[];
  daysPerWeek: number;
  shiftsPerDay: 1 | 2;
  hoursPerShift: number;
  assignments: Record<MachineId, OpsRole>;
  crew: Record<EmployeeId, OpsRole>;
  reclamationCrewHours: number;
  strippingAhead: { blocksAhead: number; extraStripBlockIds: BlockId[]; clearBlockIds: BlockId[] };
  /** false = standby (crew on §8's guarantee, machines idle). */
  active: boolean;
  purpose: 'production' | 'bulkSample';
  capBcy: number | null;
  crewShift: Record<EmployeeId, 0 | 1>;
  operatorFor: Record<MachineId, EmployeeId>;
  bedrockTakeFt: number;
  payTopPolicy: 'tight' | 'standard' | 'generous';
  cutSource: Record<BlockId, CutSource>;
  waterShortPolicy: 'cutFeed' | 'runLean';
  dischargeMode: 'closedLoop' | 'discharge';
  recirculation: number;
  waterTrucksPerDay: number;
  allowRedeploy: boolean;
  programPriority: 'opsFirst' | 'programFirst';
  /** P3. */
  winterOps: boolean;
  /** P3. */
  fuelFillToGal: number | null;
  /** P3. */
  fuelByAir: boolean;
}

/** §7.1 one claim's operations. */
export interface ClaimOps {
  claimId: ClaimId;
  plan: MinePlan | null;
  site: SiteStatus;
  siteTask?: { kind: 'mobilize' | 'startup' | 'winterize' | 'demobilize'; crewHoursLeft: number; weeksLeft: number };
  lines: Partial<Record<LineId, LineOps>>;
  /** §12 `ops.addRehandleBcy` backlog. */
  rehandleBcy: number;
  ponds: Pond[];
  wells: Well[];
  /** On-site stock (7.11.2); 0 in P1–P2. */
  fuel: { gal: number; avgCentsPerGal: number };
  workOrders: SiteWorkOrder[];
  blocks: Record<BlockId, BlockOps>;
  tailings: Record<BlockId, TailingsDeposit>;
  disturbance: DisturbanceLedger;
  season: SeasonTotals;
  /** Hidden (conservation). */
  stolenRawOz: number;
  /** Hidden (conservation). */
  skimmedRawOz: number;
  /** Keys the `ops-audit` draw; never reset. */
  auditSeq: Partial<Record<LineId, number>>;
  /** ops/cleanupNow, consumed by the next step 9(b). */
  orders: { cleanupLines: LineId[] };
  /** Ring of 4. */
  auditReports: TailingsAuditReport[];
  /** Pay bcy dug in each of the last 4 weeks (coverage weeks). */
  payDugLast4: number[];
  /** Last 10. */
  seasons: ClaimSeasonSummary[];
  /** Kept read-only after the claim leaves the player (D-7.64). */
  status: 'active' | 'left';
  leftTurn: number | null;
  /** Hidden terminal conservation term. */
  lostOnTenureEndRawOz: number;
}

export interface IdleItem {
  stage: Stage;
  /** Absent on shared stages. */
  lineId?: LineId;
  machineId?: MachineId;
  cause: IdleCause;
  rootStage?: Stage;
  rootMachineIds?: MachineId[];
  hours: number;
  bcyForgone?: number;
  note: string;
}

/** §7.11 a cost line of the week, billed by §11 in 14c. */
export interface OpsCostLine {
  account: AccountCode;
  cents: Cents;
  memo: string;
  claimId: ClaimId;
  /** Non-cash: fuel drawn from stock posts Dr exp.fuel / Cr inv.fuel. */
  offsetAccount?: AccountCode;
  reclamationShare?: number;
  vendor: 'fuel' | 'supplies' | 'camp' | 'trucking' | 'transport' | 'none';
  /** Program fuel (§4 cost allocation). */
  programId?: ProgramId;
  costCenter?: CostCenter;
}

/** §7.16 one machine's hours this week. */
export interface MachineWeekHours {
  role: OpsRole;
  lineId?: LineId;
  scheduled: number;
  work: number;
  wait: number;
  /** work + wait × idleEngineRunShare; excludes program hours (§9 adds programMachineUse). */
  smr: number;
  byCause: Partial<Record<IdleCause, number>>;
  outputBcy?: number;
  avgLoadFactor: number;
  /** Hours-weighted effective skill (hidden; §9 wear M_op). */
  operatorSkill: number;
  ground: GroundCtx;
  /** Plant entries only: hours processing feed at the continuous rate (BALANCE M-RATE, D-7.55, s07 #1). */
  runHours?: number;
}

export interface RecoveryInputs {
  phiAvg: number;
  omegaAvg: number;
  circuit: CircuitKey;
  plantOpSkillShown: Range;
  riffleLoad: 'ok' | 'heavy';
}

export interface LineWeekResult {
  lineId: LineId;
  plantMachineId: MachineId | null;
  active: boolean;
  supervisor: 'hired' | 'owner' | 'leadHand' | 'smallCrew' | 'none';
  feedMode: FeedMode;
  hoursScheduled: number;
  payMinedBcy: number;
  payHauledBcy: number;
  payWashedBcy: number;
  padStartBcy: number;
  padEndBcy: number;
  tailingsBcy: number;
  /** Hidden. */
  containedRawOz: number;
  /** Hidden. */
  recoveredRawOz: number;
  /** Hidden. */
  lostRawOzBySize: Record<SizeClass, number>;
  recoveryInputs: RecoveryInputs;
  idleBreakdown: IdleItem[];
  bottleneck: Stage;
  plantIdlePct: number;
  stageCapacityBcyWk: Partial<Record<Stage, number>>;
  water: { allocGpmAvg: number; limitedHours: number };
}

/** §7.16 the visible model's chain parts, so §4 can swap in an audited capture. */
export interface ModeledChain {
  miningFactorByBlock: Partial<Record<BlockId, number>>;
  sizeMixP50: SizeRecord;
  captureBySize: SizeRecord;
  goldRoomLossBySize: SizeRecord;
  estDirtFrac: number;
}

/**
 * §7.16 one plant-line cleanup (+ `lotId?` and milli-ounce interests, contract §4.7). The same shape as
 * knowledge/production.ts's (estimator-core) declaration; the integrator keeps one of them at merge.
 */
export interface CleanupResult {
  turn: number;
  lineId: LineId;
  purpose: 'production' | 'bulkSample';
  /** Gross weighed raw oz at the scale, before in-kind interests (7.10). */
  rawOzWeighed: number;
  /** Sieved, visible (weighed raw oz). */
  rawOzBySize: SizeRecord;
  interestsTaken: { interestId: ProductionInterestId; rawMilliOz: MilliOz }[];
  lotId?: LotId;
  bcyWashedSince: number;
  bcyByBlock: Partial<Record<BlockId, number>>;
  recoveredGradeOzPerBcy: number;
  /** Washed bcy restated on §3's in-situ pay-column basis (→ §4). */
  inSituBcyByBlock: Partial<Record<BlockId, number>>;
  pileBcyWashed: number;
  pileRawOzEst: number;
  /** Visible model: in-situ metal oz → weighed raw oz (→ §4). */
  modeledChainFactor: number;
  modeledChain: ModeledChain;
  /** Visible model, frozen at cleanup (§13 reconciliation). */
  foremanEstimateOz: number;
  nominalRecoveryBySize: SizeRecord;
  auditedRecoveryBySize?: SizeRecord;
  /** HIDDEN: metal oz skimmed at this cleanup (7.10; → §12). */
  skimOz: number;
}

/** §7.16 a claim's week (claim totals; per-line detail in `lines`, D-7.51). */
export interface WeekOpsResult {
  claimId: ClaimId;
  turn: number;
  site: SiteStatus;
  /** L1's. */
  feedMode: FeedMode;
  hoursScheduled: number;
  hoursByMachine: Record<MachineId, MachineWeekHours>;
  overburdenBcy: number;
  frozenOverburdenBcy: number;
  payMinedBcy: number;
  payHauledBcy: number;
  /** Σ lines: pay gravel through the plants this week (bank cubic yards). */
  payWashedBcy: number;
  padStartBcy: number;
  padEndBcy: number;
  tailingsBcy: number;
  /** Hidden. */
  containedRawOz: number;
  /** Hidden. */
  containedBySize: Record<SizeClass, number>;
  /** Hidden until cleanup. */
  recoveredRawOz: number;
  /** Hidden until cleanup. */
  recoveredBySize: Record<SizeClass, number>;
  /** Hidden. */
  lostRawOzBySize: Record<SizeClass, number>;
  /** Hidden. */
  lostToWasteOz: number;
  /** Hidden. */
  leftInPitOz: number;
  /** L1's. */
  recoveryInputs: RecoveryInputs;
  idleBreakdown: IdleItem[];
  bottleneck: Stage;
  plantIdlePct: number;
  stageCapacityBcyWk: Partial<Record<Stage, number>>;
  lines: LineWeekResult[];
  strip: { needBcyWk: number; doneBcyWk: number; coverageWeeks: number; standalone: Record<MachineId, number> };
  water: {
    needGpm: number;
    pumpGpm: number;
    sourceGpm: number;
    wellGpm: number;
    truckGpm: number;
    recirc: number;
    dischargeMode: 'closedLoop' | 'discharge';
    limitedHours: number;
  };
  power: { demandKw: number; supplyKw: number; shed: MachineId[] };
  fuelGal: number;
  fuelOnHandGal: number;
  costLines: OpsCostLine[];
  disturbedAcresAdded: number;
  reclaimedAcresAdded: number;
  openAcres: number;
  disturbedAcresByType: Partial<Record<DisturbanceType, number>>;
  reclaimedAcresByType: Partial<Record<DisturbanceType, { earthwork: number; reveg: number }>>;
  permitUsage: {
    waterGpmAvg: number;
    windowWeeksWorked: string[];
    channelBlocksWorked: BlockId[];
    mechanized: boolean;
    pond: { capacityBcy: number; sludgeBcy: number } | null;
    plantFeedBcyHr: number;
    plantRatedBcyHr: number;
    plantHoursPerDay: number;
  };
  crewHours: Record<EmployeeId, { byDay: number[]; shift: 0 | 1; role: OpsRole | 'cleanup'; lineId?: LineId }>;
  ownerHours: number;
  /** One per line that cleaned up this week, ascending lineId. */
  cleanups: CleanupResult[];
}

/** §7.8 / s07 #2 a what-if hint (report only with explain). */
export interface WhatIfHint {
  label: string;
  deltaWashedBcy: number;
  deltaVisibleRawOz: number;
  weeklyCostUsd: number;
}

/** `projectOpsVisible`: the visible model only (estimates, shown skills); carries the plan warnings (s07 #3). */
export interface OpsProjection {
  claimId: ClaimId;
  washedBcyWk: number;
  estContainedRawOz: number;
  estRecoveredRawOz: number;
  estRecoveryBySize: Record<SizeClass, number>;
  weeklyCostCents: Cents;
  lines: { lineId: LineId; washedBcyWk: number; plantIdlePct: number; bottleneck: Stage }[];
  strip: { needBcyWk: number; doneBcyWk: number; coverageWeeks: number };
  water: { needGpm: number; availableGpm: number };
  warnings: ActionWarning[];
}

/** §7.16 production forecast (D-7.40, P50 from P1). */
export interface ProductionForecast {
  byWeek: { turn: number; p10FineOz: number; p50FineOz: number; p90FineOz: number }[];
  cleanups: {
    claimId: ClaimId;
    lineId: LineId;
    turn: number;
    p50RawOzWeighed: number;
    p50PlayerRawOz: number;
    estFineness: number;
  }[];
  /** §5 valuation's annual bcy (s05 #26). */
  washedBcyByClaim: Record<ClaimId, number>;
}

/** A cleanup decided in step 9(b), run by step 12's chain (claims asc, lines asc). */
export interface CleanupDue {
  claimId: ClaimId;
  lineId: LineId;
  reason: 'interval' | 'maxBoxWeeks' | 'ordered' | 'standby' | 'winterizing' | 'plantMove' | 'seasonEnd';
}

/** The gold room's weighing (step 12): the truth fields are hidden and go only to §10 `addLot`. */
export interface WeighedCleanup {
  claimId: ClaimId;
  lineId: LineId;
  weighedRawMilliOz: MilliOz;
  trueAlloyFineness: number;
  trueDirtFrac: number;
}

/** §7.1 `OpsSlice`. */
export interface OpsSlice {
  claims: Record<ClaimId, ClaimOps>;
  /** Sorted; iteration order (§2.3). */
  claimIds: ClaimId[];
  /** Core result only, rewritten for every claim in claimIds every week (s07 #22). */
  lastWeek: Record<ClaimId, WeekOpsResult>;
}

export function emptyOpsSlice(): OpsSlice {
  return { claims: {}, claimIds: [], lastWeek: {} };
}
