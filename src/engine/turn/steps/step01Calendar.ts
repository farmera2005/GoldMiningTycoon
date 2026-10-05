// Step 1 · Calendar & season (DESIGN §2.6; §1 1.17 (a)–(f) → §8). P0 derives the week's calendar facts that later
// steps read (reporting month, month/quarter/year ends). §1's per-district season roll, shifts, phases, forecasts,
// weather and access cache, and §8's week-1 items, arrive in P1 (§1 1.19: P0 ships an empty step 1).
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
import type { PipelineStep, StepContext, WeekCalendar } from '../types';

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

function run(state: GameState, ctx: StepContext): GameState {
  ctx.calendar = deriveWeekCalendar(state);
  return state;
}

export const step01Calendar: PipelineStep = { index: 1, name: 'Calendar & season', sections: [1, 8], run };
