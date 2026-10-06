// §13 inbox pipeline parts (DESIGN §2.6; P1 contract §3): this folder's entries in the part table that turn/parts.ts
// concatenates. Each part names its step, its position in the step's §2.6 sub-order and the first rules phase it runs
// under; the table test pins the order.
import { produceState } from '../../state/immutability';
import type { GameState } from '../../state/types';
import type { PipelinePart, StepContext } from '../../turn/types';
import { collateAlerts } from './collate';

/** 16.14: collate the week's signals; the stop candidates go to the report (13.10). */
function collate(state: GameState, ctx: StepContext): GameState {
  let candidates: ReturnType<typeof collateAlerts> = [];
  const next = produceState(state, (draft) => {
    candidates = collateAlerts(draft, ctx.report.alerts, draft.clock.turn, 'week');
  });
  ctx.report.stopCandidates.push(...candidates);
  return next;
}

export const INBOX_PARTS: readonly PipelinePart[] = [
  { id: 'inbox.collate', step: 16, order: 14, section: 13, fromPhase: 0, run: collate },
];
