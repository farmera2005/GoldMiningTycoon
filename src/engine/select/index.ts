// Selectors (DESIGN §2.11; P1 contract §1.9): pure derived views over state, used alike by the UI, bots, the simulator
// and scenario goals. None reads a hidden field. Each canonical value has one implementation, owned by its section:
// `select` spreads §2's framework selectors and every folder's select.ts (s02 #11), and a test fails when two sources
// define the same name. After Wave 0 owners edit only their own folder's select.ts, never this file.
import type { TuningKey, TuningValue } from '../../data/tuning';
import { turnDate, type MonthDay } from '../core/calendar';
import { openDecisions } from '../actions/decisions';
import type { PendingDecision } from '../actions/types';
import type { GameState } from '../state/types';
import { tuningNumber } from '../state/tuning';
import { climateSelectors } from '../systems/climate/select';
import { companySelectors } from '../systems/company/select';
import type { EndReason, LiquidationPath, RunStatus } from '../systems/company/types';
import { competitorsSelectors } from '../systems/competitors/select';
import { eventsSelectors } from '../systems/events/select';
import { financeSelectors } from '../systems/finance/select';
import { fleetSelectors } from '../systems/fleet/select';
import { goldSelectors } from '../systems/gold/select';
import { historySelectors } from '../systems/history/select';
import { inboxSelectors } from '../systems/inbox/select';
import { investorsSelectors } from '../systems/investors/select';
import { knowledgeSelectors } from '../systems/knowledge/select';
import { landSelectors } from '../systems/land/select';
import { opsSelectors } from '../systems/ops/select';
import { permitsSelectors } from '../systems/permits/select';
import { staffSelectors } from '../systems/staff/select';
import { worldSelectors } from '../systems/world/select';
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

/**
 * The game's resolved tuning value for a key (s02 #13). Tuning is not hidden (§13 has a tuning viewer); a value an
 * event may change is a hook, read through the public `effective()` instead.
 */
function tuning(state: GameState, key: TuningKey): TuningValue {
  return state.meta.tuning[key];
}

/** §2's own selectors. */
export const frameworkSelectors = {
  dateView,
  runStatus,
  runOutcome,
  tuning,
  openDecisions: (state: GameState): PendingDecision[] => openDecisions(state),
  canAdvance: (state: GameState): null | AdvanceRefusal => canAdvance(state),
} as const;

/** Every source of selectors, by folder ('framework' = §2's own); the composition test checks names are disjoint. */
export const SELECTOR_SOURCES = {
  framework: frameworkSelectors,
  climate: climateSelectors,
  company: companySelectors,
  investors: investorsSelectors,
  history: historySelectors,
  world: worldSelectors,
  knowledge: knowledgeSelectors,
  land: landSelectors,
  permits: permitsSelectors,
  ops: opsSelectors,
  staff: staffSelectors,
  fleet: fleetSelectors,
  gold: goldSelectors,
  finance: financeSelectors,
  events: eventsSelectors,
  competitors: competitorsSelectors,
  inbox: inboxSelectors,
} as const;

export const select = {
  ...frameworkSelectors,
  ...climateSelectors,
  ...companySelectors,
  ...investorsSelectors,
  ...historySelectors,
  ...worldSelectors,
  ...knowledgeSelectors,
  ...landSelectors,
  ...permitsSelectors,
  ...opsSelectors,
  ...staffSelectors,
  ...fleetSelectors,
  ...goldSelectors,
  ...financeSelectors,
  ...eventsSelectors,
  ...competitorsSelectors,
  ...inboxSelectors,
} as const;

export type Selectors = typeof select;
