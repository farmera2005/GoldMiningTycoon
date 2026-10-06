// §7 operations explainers (DESIGN §2.8, §7.19; P1 contract §4.7): pure (state, ...args) → CalcNode, spread into
// `explain` by explain/index.ts (S13-5). The week's numbers are explained from `WeekReport.calc` under
// `ops/<metric>/<claimId>/<lineId>` keys; these explain the visible projection. A name already used by another folder
// fails the composition test.
import type { CalcNode } from '../../core/calc';
import type { ClaimId, LineId } from '../../core/ids';
import { stubCalcNode } from '../../state/partKit';
import type { GameState } from '../../state/types';

function opsProjection(_state: GameState, _claimId: ClaimId): CalcNode {
  // CONTRACT-STUB(§7) ops.explain.opsProjection
  return stubCalcNode('Washed per week', 'bcy');
}

function recoveryBySizeExplain(_state: GameState, _claimId: ClaimId, _lineId: LineId): CalcNode {
  // CONTRACT-STUB(§7) ops.explain.recoveryBySize
  return stubCalcNode('Recovery', 'pct');
}

function siteMobilization(_state: GameState, _claimId: ClaimId): CalcNode {
  // CONTRACT-STUB(§7) ops.explain.siteMobilization
  return stubCalcNode('Mobilization cost', 'cents');
}

export const opsExplainers = {
  opsProjection,
  recoveryBySize: recoveryBySizeExplain,
  siteMobilization,
} as const satisfies Record<string, (state: GameState, ...args: never[]) => CalcNode>;
