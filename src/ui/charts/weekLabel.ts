// Week labels for chart axes, tooltips and twins (DESIGN §13.2 "Turns": `Y{year} Wk {week}` from `select.dateView`;
// `turn N` with no game loaded).
import { useCallback } from 'react';
import { select } from '../../engine';
import { yearWeek } from '../format';
import { useUi } from '../store/store';

export type WeekLabel = (turn: number) => string;

export function useWeekLabel(): WeekLabel {
  const state = useUi((s) => s.game.state);
  return useCallback(
    (turn: number) => {
      if (state === null) return `turn ${turn}`;
      const v = select.dateView(state, turn);
      return yearWeek(v.year, v.week);
    },
    [state],
  );
}
