// §8 staff slice of GameState (DESIGN §8.1–§8.5, §8.10, §8.12, §8.16; S08-5, S08-9, S08-25; P1 contract §4.8). Every P2+
// field ships from P1 at its neutral value (§2 D-2.60): `injuries`, `claimSafety`, `pendingRefs`, `flexHourPlan`,
// `leakage`. Hidden (scrambler s08): `truth`, `resumeNoise` and `leavesPoolTurn` of employees, candidates and re-entry
// snapshots. In P1 `shown` is a degenerate range equal to truth and is rewritten when truth changes (S08-26).
import type {
  CandidateId,
  ClaimId,
  DistrictId,
  EmployeeId,
  Id,
  InjuryId,
  LineId,
  ProgramId,
  RecruiterOrderId,
} from '../../core/ids';
import type { Cents } from '../../core/money';
import type { CostCenter } from '../finance/types';
import type { JurisdictionId } from '../world/enums';

export type Role =
  | 'foreman'
  | 'operator'
  | 'mechanic'
  | 'welder'
  | 'plantOperator'
  | 'geologist'
  | 'driller'
  | 'landSpecialist'
  | 'safetyOfficer'
  | 'bookkeeper'
  | 'controller'
  | 'cook'
  | 'laborer';

/** `Role` order (pool draws iterate roles in this order, §8.4). */
export const ROLES: readonly Role[] = [
  'foreman',
  'operator',
  'mechanic',
  'welder',
  'plantOperator',
  'geologist',
  'driller',
  'landSpecialist',
  'safetyOfficer',
  'bookkeeper',
  'controller',
  'cook',
  'laborer',
];

export type OpClass = 'dozer' | 'excavator' | 'loader' | 'truck';
export type CandidateSource = 'walkIn' | 'referral' | 'recruiter' | 'competitorLayoff' | 'formerEmployee' | 'event';

export interface Attr3 {
  skill: number;
  reliability: number;
  safety: number;
}

export interface Range {
  lo: number;
  hi: number;
}

/** Hidden. */
export interface Truth extends Attr3 {
  skillCap: number;
  /** Operators only. */
  opClass?: { primary: OpClass; secondary: OpClass };
  /** Points below skill per alternative role. */
  altRoleGap: Partial<Record<Role, number>>;
}

export interface Resume {
  skill: Range;
  reliability: Range;
  safety: Range;
  classSkill?: Partial<Record<OpClass, Range>>;
  opClass?: { primary: OpClass; secondary: OpClass };
  mshaTrained: boolean;
  expYears: number;
  source: CandidateSource;
  refsChecked: boolean;
  flags: ('attendance' | 'incidents')[];
}

/** Hidden; drives `shown`. */
export interface ResumeNoise {
  center0: Attr3;
  w0: Attr3;
  observedWeeks: Attr3;
}

export interface Candidate {
  id: CandidateId;
  name: string;
  role: Role;
  districtId: DistrictId;
  origin: 'local' | 'regional' | 'outOfRegion';
  createdTurn: number;
  truth: Truth;
  resumeNoise: ResumeNoise;
  shown: Resume;
  /** ask = marketWage(role, district, t) × askMult (8.4). */
  askMult: number;
  /** P5. */
  askBumpUntilTurn: number | null;
  /** P5: never reset. */
  offersMade: number;
  laidOffTagUntilTurn: number | null;
  employedElsewhere: boolean;
  availableFromTurn: number;
  /** Hidden. */
  leavesPoolTurn: number;
  tags: ('laidOff' | 'competitorBust' | 'formerEmployee' | 'skilledHand')[];
  formerEmployeeId?: EmployeeId;
  /** The recruiter order that delivered this candidate (S08-25, D-8.72). */
  recruiterOrderId?: RecruiterOrderId;
}

/** §12 competitor crews and former-employee re-entry. */
export type CandidateSnapshot = Omit<Candidate, 'districtId' | 'leavesPoolTurn' | 'availableFromTurn'>;

export type EmpStatus = 'pendingArrival' | 'active' | 'injured' | 'rotationOff' | 'laidOff' | 'gone';

/** §8.5 where an employee works. */
export type Assignment =
  /** §7 MinePlan.crew gives the OpsRole and shift; not in plan.crew = standby on site. */
  | { kind: 'claim'; claimId: ClaimId }
  | { kind: 'program'; programId: ProgramId }
  | { kind: 'shop'; mode: 'site'; claimId: ClaimId }
  /** P3. */
  | { kind: 'shop'; mode: 'pool'; districtId: DistrictId }
  | { kind: 'district'; districtId: DistrictId }
  | { kind: 'camp'; claimId: ClaimId }
  | { kind: 'security' | 'caretaker'; claimId: ClaimId }
  | { kind: 'office' }
  | { kind: 'standby' };

/** §8.6 pay. */
export interface PayStructure {
  base: { kind: 'hourly'; centsPerHour: Cents } | { kind: 'salary'; centsPerYear: Cents };
  /** P4. */
  seasonBonus: { kind: 'pctOfWages'; pct: number } | { kind: 'flat'; cents: Cents } | null;
  bonusVest: { rule: 'operatingEnd' | 'turn'; turn?: number; proRataOnLayoff: boolean };
  /** P4. */
  goldShare: { pct: number; scope: 'claimPool' | 'individual'; claimId: ClaimId | 'assigned' } | null;
  /** P4: paid only while laid off on the recall list. */
  retainerWeeklyCents: Cents;
}

export interface Employee {
  id: EmployeeId;
  name: string;
  role: Role;
  homeDistrictId: DistrictId;
  origin: Candidate['origin'];
  truth: Truth;
  resumeNoise: ResumeNoise;
  shown: Resume;
  /** 0–100, visible. */
  morale: number;
  /** 0–100, visible. */
  fatigue: number;
  moraleMem: { payScar: number; pendingShock: number };
  payStructure: PayStructure;
  assignment: Assignment;
  status: EmpStatus;
  hiredTurn: number;
  arrivalTurn: number;
  tenureWeeks: number;
  seasonsWithCompany: number;
  probationUntilTurn: number | null;
  signingBonusCents: Cents;
  training: {
    kind: 'newMiner' | 'experienced' | 'none';
    newMinerHours: number;
    firstFieldTurn: number | null;
    lastRefresherTurn: number | null;
    preWorkDone: boolean;
  };
  rotation: 'none' | '3on1off';
  rotationOffset: 0 | 1 | 2 | 3;
  returnTurn: number | null;
  bonus: { accruedCents: Cents; vestTurn: number | null };
  last8: {
    paidHours: number;
    straightEqHours: number;
    baseCents: Cents;
    goldShareCents: Cents;
    bonusAccrualCents: Cents;
  }[];
  consecutiveNoDayOffWeeks: number;
  weeksOnSite: number;
  recall: { laidOffTurn: number; moraleAtLayoff: number; lastBonusPaidInFull: boolean } | null;
  // P1 fields (D-8.58, S08-9)
  /** Applied at the next step 7. */
  pendingAssignment: Assignment | null;
  /** Paid in the next payroll. */
  pendingPay: { bonusCents: Cents; severanceCents: Cents };
  lastWeek: {
    hoursByDay: number[];
    availableFraction: number;
    claimId: ClaimId | null;
    lineId: LineId | null;
    onSite: boolean;
  };
  weeksWorkedThisYear: number;
  moralePrev: number;
  leaving: { turn: number; walkOff: boolean } | null;
}

export interface LaborMarketState {
  byDistrict: Record<
    DistrictId,
    {
      candidateIds: CandidateId[];
      poolTarget: Record<Role, number>;
      /** Hourly cents, or annual for salaried roles. */
      marketWage: Record<Role, Cents>;
      marketWageBase: Record<Role, Cents>;
      /** §12 competitorLaborDemand read this week (last week's value). */
      cld: number;
      /** From the forecast breakup (no look-ahead). */
      rushWindow: { from: number; to: number };
      scarcity: number;
      seasonPool: number;
      seasonWage: number;
    }
  >;
}

export interface OwnerWork {
  fatigue: number;
  hoursLastWeek: number;
  consecutiveNoDayOffWeeks: number;
  weeksOnSite: number;
}

export interface UnpaidWages {
  cents: Cents;
  weeks: number;
  misses: number;
  newMissThisRun: boolean;
}

export interface SafetyRecord {
  value: number;
  lastLostTimeTurn: number | null;
  /** 52 weeks. */
  log: { turn: number; delta: number; ref: Id }[];
}

export interface InjuryRecord {
  id: InjuryId;
  turn: number;
  empId: EmployeeId | 'owner';
  claimId: ClaimId | null;
  tier: 'firstAid' | 'lostTime' | 'serious' | 'fatal';
  lostDays: number;
  returnTurn: number | null;
  neverReturns: boolean;
  wcIncurredCents: Cents;
  medicalOnly: boolean;
  lateNotified: boolean;
  /** 'work' or a §12 event id. */
  cause: string;
}

export interface Separation {
  empId: EmployeeId;
  turn: number;
  role: Role;
  districtId: DistrictId;
  kind: 'quit' | 'poached' | 'fired' | 'firedCause' | 'layoff' | 'injuryExit' | 'fatality';
  uiChargeCents: Cents;
  /** Former-employee re-entry (S08-5, D-8.55); the snapshot is hidden. */
  reentry?: { turn: number; snapshot: CandidateSnapshot };
}

export type SupervisorKind = 'hired' | 'owner' | 'leadHand' | 'smallCrew' | 'none';
export type StandDownReason = 'reassigned' | 'leadHandExhausted' | 'smallCrewExceeded';

/** This week's supervision of one plant line (8.12 counters, written in step 7; D-8.58). */
export interface SupervisionRecord {
  leadHandWeeks: number;
  presentWeeks: number;
  lastSupervisorQuitTurn: number | null;
  kind: SupervisorKind;
  empId: EmployeeId | 'owner' | null;
  qF: number;
  reason: StandDownReason | null;
}

export interface RecruiterOrder {
  id: RecruiterOrderId;
  role: Role;
  districtId: DistrictId;
  readyTurn: number;
  count: number;
  depositCents: Cents;
  expiresTurn: number;
  deliveredTurn: number | null;
  candIds: CandidateId[];
  firstFeeCredited: boolean;
}

/** Travel, recruiter fees and deposit forfeits awaiting §11's 14c bill. */
export interface StaffingCharge {
  turn: number;
  kind: 'travel' | 'recruiterFee' | 'depositForfeit';
  cents: Cents;
  costCenter: CostCenter;
  claimId?: ClaimId;
  memo: string;
  refId: Id;
}

/** Last week's camp at a claim (8.7 morale inputs). */
export interface CampWeekRecord {
  onSite: number;
  cooks: number;
  cookShort: number;
  overCapacity: number;
  tier: 'basic' | 'standard' | 'good' | 'premium';
  commuting: number;
}

/** §8.1 `StaffSlice`. */
export interface StaffSlice {
  /** Includes laid-off staff on the recall list. */
  employees: Record<EmployeeId, Employee>;
  employeeIds: EmployeeId[];
  candidates: Record<CandidateId, Candidate>;
  candidateIds: CandidateId[];
  market: LaborMarketState;
  owner: OwnerWork;
  /** Written only via recordPayrollOutcome. */
  unpaidWages: Record<EmployeeId, UnpaidWages>;
  /** Last 156 weeks (P2). */
  injuries: InjuryRecord[];
  claimSafety: Record<ClaimId, { injuryMemory: number; lastLostTimeTurn: number | null }>;
  supervision: Record<ClaimId, Partial<Record<LineId, SupervisionRecord>>>;
  /** Last 156 weeks. */
  separations: Separation[];
  pendingRefs: { candId: CandidateId; readyTurn: number }[];
  recruiterOrders: RecruiterOrder[];
  staffingCharges: StaffingCharge[];
  camps: Record<ClaimId, CampWeekRecord>;
  /** akStyle daily-OT relief (P4). */
  flexHourPlan: Partial<Record<JurisdictionId, boolean>>;
  leakage: { ytdCents: Cents; caughtYtdCents: Cents };
}

export function emptyStaffSlice(): StaffSlice {
  return {
    employees: {},
    employeeIds: [],
    candidates: {},
    candidateIds: [],
    market: { byDistrict: {} },
    owner: { fatigue: 0, hoursLastWeek: 0, consecutiveNoDayOffWeeks: 0, weeksOnSite: 0 },
    unpaidWages: {},
    injuries: [],
    claimSafety: {},
    supervision: {},
    separations: [],
    pendingRefs: [],
    recruiterOrders: [],
    staffingCharges: [],
    camps: {},
    flexHourPlan: {},
    leakage: { ytdCents: 0 as Cents, caughtYtdCents: 0 as Cents },
  };
}

/** `foremanFor(state, claimId, lineId = 'L1')` (8.12). */
export interface ForemanInfo {
  kind: SupervisorKind;
  empId: EmployeeId | 'owner' | null;
  /** qF: effective (fatigue- and availability-adjusted), true-based. */
  skill: number;
  shownSkill: Range;
  safety: number;
  leadHandWeeks: number;
  /** The active lines this supervisor covers. */
  lineIds: LineId[];
}

/** `addCandidate`'s spec (S08-7: the caller supplies the stream). */
export interface CandidateSpec {
  role: Role;
  districtId: DistrictId;
  origin: Candidate['origin'];
  truth?: Partial<Truth>;
  askMult?: number;
  tags?: Candidate['tags'];
  formerEmployeeId?: EmployeeId;
  leavesPoolTurnMin?: number;
}

/** One employee's hours this week (step 10 → §11's payroll). */
export interface EmployeeWeekHours {
  byDay: number[];
  paidHours: number;
  straightEqHours: number;
  byCostCenter: { costCenter: CostCenter; claimId?: ClaimId; programId?: ProgramId; hours: number }[];
}

/** A shop: one claim's site shop or a district pool (P3). */
export type ShopKey = { mode: 'site'; claimId: ClaimId } | { mode: 'pool'; districtId: DistrictId };
