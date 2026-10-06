// §1 company pipeline parts (DESIGN §2.6; P1 contract §3) and newGame init parts (contract §1.5): this folder's entries
// in the part tables. Each names its step (or init order), its position in the step's §2.6 sub-order and the first
// rules phase it runs under; the table tests pin the order.
import { emptyPart, initPart, mutatorPart } from '../../state/partKit';
import type { GameState, InitPart } from '../../state/types';
import type { PipelinePart, StepContext } from '../../turn/types';
import { ownerWeek } from './desk';
import { reputationWeek } from './reputation';
import { runEndCheck } from './runEnd';
import { inheritorGround, startSetup } from './start';

/** 16d: the run-end check reads §11's liquidation flag from step 15 (P0). */
function runEnd(state: GameState, _ctx: StepContext): GameState {
  return runEndCheck(state);
}

export const COMPANY_PARTS: readonly PipelinePart[] = [
  mutatorPart({ id: 'company.ownerWeek', step: 7, order: 1, section: 1, fromPhase: 1 }, ownerWeek),
  mutatorPart({ id: 'company.reputation', step: 16, order: 1, section: 1, fromPhase: 1 }, reputationWeek),
  // 16c scenario goals: registered now so the order is fixed; the body arrives with P6.
  emptyPart({ id: 'company.scenario', step: 16, order: 3, section: 1, fromPhase: 6 }),
  { id: 'company.runEnd', step: 16, order: 4, section: 1, fromPhase: 0, run: runEnd },
];

export const COMPANY_INIT_PARTS: readonly InitPart[] = [
  initPart({ id: 'company.inheritorGround', order: 4, section: 1, fromPhase: 1 }, inheritorGround),
  initPart({ id: 'company.startSetup', order: 9, section: 1, fromPhase: 0 }, startSetup),
];
