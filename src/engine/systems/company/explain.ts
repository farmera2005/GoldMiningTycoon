// §1 company and owner explainers (DESIGN §2.8): pure (state, ...args) → CalcNode, spread into `explain` by
// explain/index.ts (S13-5: `ExplainerName = keyof typeof explain`). A name already used by another folder fails the
// composition test.
import type { CalcNode } from '../../core/calc';
import type { GameState } from '../../state/types';

export const companyExplainers = {} as const satisfies Record<string, (state: GameState, ...args: never[]) => CalcNode>;
