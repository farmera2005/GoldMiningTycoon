// Step 0 · Guard (DESIGN §2.6, §2). Refuse if a blocking decision is open or the run has ended; increment the turn
// first, so every later step runs *as* week `turn` and everything it creates carries createdTurn = turn (D-2.13);
// derive year and week. The week's empty report and scratch are opened by advanceWeek before step 0 runs.
import { produceState } from '../../state/immutability';
import { turnToYearWeek } from '../../core/calendar';
import type { GameState } from '../../state/types';
import { assertCanAdvance } from '../guard';
import type { PipelinePart, StepContext, StepDef } from '../types';

function guard(state: GameState, ctx: StepContext): GameState {
  assertCanAdvance(state);
  const turn = state.clock.turn + 1;
  const { year, week } = turnToYearWeek(turn);
  ctx.report.turn = turn;
  return produceState(state, (draft) => {
    draft.clock.turn = turn;
    draft.clock.year = year;
    draft.clock.week = week;
  });
}

export const step00Guard: StepDef = { index: 0, name: 'Guard', sections: [2] };

export const STEP00_PARTS: readonly PipelinePart[] = [
  { id: 'framework.guard', step: 0, order: 1, section: 2, fromPhase: 0, run: guard },
];
