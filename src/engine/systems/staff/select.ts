// §8 staff selectors (DESIGN §2.11, §8.14; P1 contract §4.8): pure readers over state, spread into `select` by
// select/index.ts. None returns a hidden field: employee and candidate views drop `truth`, `resumeNoise` and
// `leavesPoolTurn`, and a separation drops its re-entry snapshot. A name already used by another folder fails the
// composition test.
import type { ClaimId, DistrictId, EmployeeId } from '../../core/ids';
import { sortedValues } from '../../core/iter';
import type { GameState } from '../../state/types';
import { fieldCrewCount, foremanFor } from './crew';
import { crewRequirement, payrollProjection } from './payroll';
import type {
  Candidate,
  Employee,
  LaborMarketState,
  OwnerWork,
  RecruiterOrder,
  Separation,
  SupervisionRecord,
} from './types';

/** An employee as the player sees it (shown résumé ranges, never the truth). */
export type EmployeeView = Omit<Employee, 'truth' | 'resumeNoise'>;
/** A candidate as the player sees it. */
export type CandidateView = Omit<Candidate, 'truth' | 'resumeNoise' | 'leavesPoolTurn'>;
/** A separation without its hidden re-entry snapshot. */
export type SeparationView = Omit<Separation, 'reentry'> & { reentryTurn: number | null };
export type RosterRow = { kind: 'owner'; owner: OwnerWork } | { kind: 'employee'; employee: EmployeeView };
export type QuitRiskBand = 'low' | 'elevated' | 'high';

function employeeView(e: Employee): EmployeeView {
  const { truth: _t, resumeNoise: _n, ...rest } = e;
  return rest;
}

function candidateView(c: Candidate): CandidateView {
  const { truth: _t, resumeNoise: _n, leavesPoolTurn: _l, ...rest } = c;
  return rest;
}

function separationView(s: Separation): SeparationView {
  const { reentry, ...rest } = s;
  return { ...rest, reentryTurn: reentry === undefined ? null : reentry.turn };
}

/** The owner row first, then every employee (incl. the recall list) in id order. */
function roster(state: GameState): RosterRow[] {
  const rows: RosterRow[] = [{ kind: 'owner', owner: state.staff.owner }];
  for (const e of sortedValues(state.staff.employees)) rows.push({ kind: 'employee', employee: employeeView(e) });
  return rows;
}

function employee(state: GameState, empId: EmployeeId): EmployeeView | null {
  const e = state.staff.employees[empId];
  return e === undefined ? null : employeeView(e);
}

function candidates(state: GameState, districtId?: DistrictId): CandidateView[] {
  return sortedValues(state.staff.candidates)
    .filter((c) => districtId === undefined || c.districtId === districtId)
    .map(candidateView);
}

function laborMarket(state: GameState, districtId: DistrictId): LaborMarketState['byDistrict'][DistrictId] | null {
  return state.staff.market.byDistrict[districtId] ?? null;
}

function supervision(state: GameState, claimId: ClaimId): Partial<Record<string, SupervisionRecord>> {
  return state.staff.supervision[claimId] ?? {};
}

function recallList(state: GameState): EmployeeView[] {
  return sortedValues(state.staff.employees)
    .filter((e) => e.status === 'laidOff' && e.recall !== null)
    .map(employeeView);
}

function recruiterOrders(state: GameState): RecruiterOrder[] {
  return state.staff.recruiterOrders;
}

function separations(state: GameState): SeparationView[] {
  return state.staff.separations.map(separationView);
}

/** The visible quit-risk band (8.8; from morale and visible pay only). */
function quitRiskBand(_state: GameState, _empId: EmployeeId): QuitRiskBand {
  // CONTRACT-STUB(§8) staff.quitRiskBand
  return 'low';
}

export const staffSelectors = {
  roster,
  employee,
  candidates,
  laborMarket,
  supervision,
  recallList,
  recruiterOrders,
  separations,
  quitRiskBand,
  crewRequirement,
  payrollProjection,
  foremanFor,
  fieldCrewCount,
} as const;
