// §8 staff explainers (DESIGN §2.8, §8.7, §8.8, §8.4; P1 contract §4.8): pure (state, ...args) → CalcNode, spread into
// `explain` by explain/index.ts (S13-5). Wave-0 stubs return a zero leaf that says so (contract §12).
import type { CalcNode } from '../../core/calc';
import type { CandidateId, EmployeeId } from '../../core/ids';
import { stubCalcNode } from '../../state/partKit';
import type { GameState } from '../../state/types';

function morale(_state: GameState, _empId: EmployeeId): CalcNode {
  // CONTRACT-STUB(§8) staff.explain.morale
  return stubCalcNode('Morale', 'score');
}

function quitRisk(_state: GameState, _empId: EmployeeId): CalcNode {
  // CONTRACT-STUB(§8) staff.explain.quitRisk
  return stubCalcNode('Weekly quit risk', 'prob');
}

function ask(_state: GameState, _candId: CandidateId): CalcNode {
  // CONTRACT-STUB(§8) staff.explain.ask
  return stubCalcNode('Asking wage', 'usdPerHour');
}

export const staffExplainers = { morale, quitRisk, ask } as const satisfies Record<
  string,
  (state: GameState, ...args: never[]) => CalcNode
>;
