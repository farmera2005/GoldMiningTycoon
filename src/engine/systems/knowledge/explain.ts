// §4 knowledge explainers (DESIGN §2.8, §4.18; P1 contract §4.4): pure (state, ...args) → CalcNode, spread into
// `explain` by explain/index.ts (S13-5: `ExplainerName = keyof typeof explain`). The estimate's tree is built lazily from
// the cached layers (s04 #23). A name already used by another folder fails the composition test.
import type { CalcNode } from '../../core/calc';
import type { ClaimId } from '../../core/ids';
import { stubCalcNode } from '../../state/partKit';
import type { GameState } from '../../state/types';
import type { ProgramDraft } from './actions';

function claimEstimate(_state: GameState, _claimId: ClaimId): CalcNode {
  // CONTRACT-STUB(§4) knowledge.explain.claimEstimate
  return stubCalcNode('Contained gold P50', 'oz');
}

function programPreview(_state: GameState, _draft: ProgramDraft): CalcNode {
  // CONTRACT-STUB(§4) knowledge.explain.programPreview
  return stubCalcNode('Program cost', 'cents');
}

export const knowledgeExplainers = {
  claimEstimate,
  programPreview,
} as const satisfies Record<string, (state: GameState, ...args: never[]) => CalcNode>;
