// Step 1 · Calendar & season (DESIGN §2.6; §1 1.17 (a)–(f) → §8). The framework part first derives the week's calendar
// facts that later steps read (reporting month, month/quarter/year ends; D-2.42); §1's per-district season roll,
// shifts, phases, forecasts and weather (part 1.2) and §8's week-1 items (part 1.3) follow as their owners' parts (P1).
import {
  WEEKS_PER_YEAR,
  displayYear,
  isMonthEndWeek,
  isQuarterEndWeek,
  quarter,
  reportingMonth,
} from '../../core/calendar';
import type { GameState } from '../../state/types';
import { tuningNumber } from '../../state/tuning';
import type { PipelinePart, StepContext, StepDef, WeekCalendar } from '../types';

export function deriveWeekCalendar(state: GameState): WeekCalendar {
  const { turn, year, week } = state.clock;
  return {
    turn,
    year,
    week,
    displayYear: displayYear(year, tuningNumber(state.meta.tuning, 'game.startCalendarYear')),
    reportingMonth: reportingMonth(week),
    quarter: quarter(week),
    isMonthEnd: isMonthEndWeek(week),
    isQuarterEnd: isQuarterEndWeek(week),
    isYearStart: week === 1,
    isYearEnd: week === WEEKS_PER_YEAR,
  };
}

function calendar(state: GameState, ctx: StepContext): GameState {
  ctx.calendar = deriveWeekCalendar(state);
  return state;
}

export const step01Calendar: StepDef = { index: 1, name: 'Calendar & season', sections: [1, 8] };

export const STEP01_PARTS: readonly PipelinePart[] = [
  { id: 'framework.calendar', step: 1, order: 1, section: 2, fromPhase: 0, run: calendar },
];
