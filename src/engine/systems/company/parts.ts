// §1 company pipeline parts (DESIGN §2.6; P1 contract §3): this folder's entries in the part table that turn/parts.ts
// concatenates. Each part names its step, its position in the step's §2.6 sub-order and the first rules phase it runs
// under; the table test pins the order.
import type { GameState } from '../../state/types';
import type { PipelinePart, StepContext } from '../../turn/types';
import { runEndCheck } from './runEnd';

/** 16d: the run-end check reads §11's liquidation flag from step 15 (P0). */
function runEnd(state: GameState, _ctx: StepContext): GameState {
  return runEndCheck(state);
}

export const COMPANY_PARTS: readonly PipelinePart[] = [
  { id: 'company.runEnd', step: 16, order: 4, section: 1, fromPhase: 0, run: runEnd },
];
