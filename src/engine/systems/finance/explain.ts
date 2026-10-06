// §11 finance explainers (DESIGN §2.8): pure (state, ...args) → CalcNode, spread into `explain` by explain/index.ts
// (S13-5: `ExplainerName = keyof typeof explain`). A name already used by another folder fails the composition test.
import type { CalcNode } from '../../core/calc';
import { explainCash } from '../../explain/cash';
import { explainNetWorth } from '../../explain/netWorth';
import type { GameState } from '../../state/types';

export const financeExplainers = {
  /** Cash on hand → cash accounts → ledger postings. */
  cash: explainCash,
  /** netWorth(state, 'scoring') → company NW and the owner's personal items. */
  netWorth: explainNetWorth,
} as const satisfies Record<string, (state: GameState, ...args: never[]) => CalcNode>;
