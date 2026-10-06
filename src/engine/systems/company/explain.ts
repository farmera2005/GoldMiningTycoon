// §1 company and owner explainers (DESIGN §2.8; P1 contract §4.2): pure (state, ...args) → CalcNode, spread into
// `explain` by explain/index.ts (S13-5: `ExplainerName = keyof typeof explain`). A name already used by another folder
// fails the composition test.
import type { CalcNode } from '../../core/calc';
import { stubCalcNode } from '../../state/partKit';
import type { NewGameSetup } from '../../state/setup';
import type { GameState } from '../../state/types';

/** The start position of a setup (D-1.90). The wizard has no game yet, so `state` may be null. */
function startPreview(_state: GameState | null, _setup: NewGameSetup): CalcNode {
  // CONTRACT-STUB(§1) company.explain.startPreview
  return stubCalcNode('Owner net worth at start', 'cents');
}

/** Reputation → its last 52 weeks of entries (1.12). */
function reputation(_state: GameState): CalcNode {
  // CONTRACT-STUB(§1) company.explain.reputation
  return stubCalcNode('Reputation', 'score');
}

export const companyExplainers = {
  startPreview,
  reputation,
} as const satisfies Record<string, (state: GameState, ...args: never[]) => CalcNode>;
