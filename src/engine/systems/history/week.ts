// §2's step-16 history part (DESIGN §2.5, §2.6; P1 contract §1.8, part 16.15): the week's snapshot, then the
// completed year's rollup. Under P1 rules year Y's rollup is written in step 16 of turn 52Y (year Y + 1, week 1), from
// the turn-(52Y − 1) snapshot and the year's journal, so a sale or payment made after the week-52 pipeline (at turn
// 52Y − 1, between pipelines) lands in its own year (s02 #9). P0 rules keep the P0 timing (week 52) so `--rules p0`
// reproduces P0. A Y-year simulator game ends after the pipeline of turn 52Y − 1, so its last year never gets a rollup;
// the simulator reads that year from §11's periodNetIncome (D-2.57).
import { produceState } from '../../state/immutability';
import { rulesAtLeast } from '../../state/rules';
import type { GameState } from '../../state/types';
import { tuningNumber } from '../../state/tuning';
import { weekCalendar, type StepContext, type WeekCalendar } from '../../turn/types';
import { resetWeekSales } from '../gold/weekSales';
import { appendWeekly, companySnapshot, marketSnapshot, yearRollup } from './snapshot';

/** The game year whose rollup this week writes, or null. */
export function rollupYearDue(state: GameState, calendar: WeekCalendar): number | null {
  if (rulesAtLeast(state, 1)) return calendar.isYearStart && calendar.year > 1 ? calendar.year - 1 : null;
  return calendar.isYearEnd ? calendar.year : null;
}

export function writeHistory(state: GameState, ctx: StepContext): GameState {
  const calendar = weekCalendar(ctx);
  const keep = tuningNumber(state.meta.tuning, 'game.history.weeklyKeep');
  const snap = {
    turn: state.clock.turn,
    market: marketSnapshot(state),
    company: companySnapshot(state, ctx.week),
  };
  const withSnap = produceState(state, (draft) => {
    appendWeekly(draft.history, snap, keep);
    resetWeekSales(draft);
  });
  const year = rollupYearDue(withSnap, calendar);
  if (year === null) return withSnap;
  const rollup = yearRollup(withSnap, year);
  return produceState(withSnap, (draft) => {
    draft.history.annual.push(rollup);
  });
}
