// §2 history selectors (DESIGN §2.5, §2.11; D-2.54): the simulator, the end report and the charts read the slice
// through these. A name already used by another folder fails the composition test.
import type { GameState } from '../../state/types';
import type { WeekSnapshot, YearRollup } from './types';

/** §2.5 annual rollups, ascending years (completed game years only). */
function annualHistory(state: GameState): readonly YearRollup[] {
  return state.history.annual;
}

/** The weekly history ring (§2.5), ascending turns. */
function weeklyHistory(state: GameState): readonly WeekSnapshot[] {
  return state.history.weekly;
}

export const historySelectors = {
  weeklyHistory,
  annualHistory,
} as const;
