// Selectors (DESIGN §2.11): pure derived views over state, used alike by the UI, bots, the simulator and scenario
// goals. None reads a hidden field. Each canonical value has one implementation, owned by its section.
import { turnDate, type MonthDay } from '../core/calendar';
import type { DistrictId } from '../core/ids';
import type { Cents } from '../core/money';
import { openDecisions } from '../actions/decisions';
import type { PendingDecision } from '../actions/types';
import type { GameState } from '../state/types';
import { tuningNumber } from '../state/tuning';
import type { EndReason, LiquidationPath, RunStatus } from '../systems/company/types';
import { cashOnHandCents, companyNetWorthCents, netWorthCents, type NetWorthMode } from '../systems/finance/netWorth';
import { marketSnapshot } from '../systems/history/snapshot';
import type { MarketSnapshot, WeekSnapshot, YearRollup } from '../systems/history/types';
import { canAdvance, type AdvanceRefusal } from '../turn/guard';

/** §1 1.3 / §13 13.2 date facts for a turn (default: the current turn). */
export interface DateView {
  turn: number;
  year: number;
  week: number;
  displayYear: number;
  start: MonthDay;
  end: MonthDay;
}

function dateView(state: GameState, turn: number = state.clock.turn): DateView {
  const d = turnDate(turn, tuningNumber(state.meta.tuning, 'game.startCalendarYear'));
  return { turn: d.turn, year: d.year, week: d.week, displayYear: d.displayYear, start: d.start, end: d.end };
}

/** §11 cashOnHand: operating + reserve, excluding restricted cash. */
function cashOnHand(state: GameState): Cents {
  return cashOnHandCents(state.finance);
}

/** §2.11 / §11 11.20 netWorth(state, mode); 'scoring' is §1 1.13's owner NW (P0 form: ledger marks only). */
function netWorth(state: GameState, mode: NetWorthMode): Cents {
  return netWorthCents(state.finance, state.meta.tuning, mode);
}

/** §1 1.13 companyNW. */
function companyNetWorth(state: GameState): Cents {
  return companyNetWorthCents(state.finance, state.meta.tuning);
}

/** This week's visible market series (§10; P0–P4 flat). */
function market(state: GameState): MarketSnapshot {
  return marketSnapshot(state);
}

/** §10 spot, USD per fine oz. */
function spotUsdPerFineOz(state: GameState): number {
  return marketSnapshot(state).spot;
}

/** Districts where the player holds ground (§5 tenures; none before P1). */
function heldDistrictIds(_state: GameState): DistrictId[] {
  return [];
}

function runStatus(state: GameState): RunStatus {
  return state.company.runStatus;
}

/** §1 1.14 run outcome: status, why the run ended and, for a liquidation, its path (§11). Never hidden. */
export interface RunOutcome {
  runStatus: RunStatus;
  endReason: EndReason | null;
  liquidationPath: LiquidationPath | null;
}

function runOutcome(state: GameState): RunOutcome {
  const c = state.company;
  return { runStatus: c.runStatus, endReason: c.endReason, liquidationPath: c.liquidationPath };
}

/** §2.5 annual rollups, ascending years (completed game years only). */
function annualHistory(state: GameState): readonly YearRollup[] {
  return state.history.annual;
}

/** The weekly history ring (§2.5), ascending turns. */
function weeklyHistory(state: GameState): readonly WeekSnapshot[] {
  return state.history.weekly;
}

export const select = {
  cashOnHand,
  netWorth,
  companyNetWorth,
  dateView,
  market,
  spotUsdPerFineOz,
  heldDistrictIds,
  runStatus,
  runOutcome,
  weeklyHistory,
  annualHistory,
  openDecisions: (state: GameState): PendingDecision[] => openDecisions(state),
  canAdvance: (state: GameState): null | AdvanceRefusal => canAdvance(state),
} as const;

export type Selectors = typeof select;
