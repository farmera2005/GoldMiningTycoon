// Explainers (DESIGN §2.8): pure (state, args) → CalcNode trees for numbers that are functions of current state. The UI
// calls them on demand for `live` ExplainRefs; dice-dependent numbers are explained from the WeekReport instead.
import type { CalcNode } from '../core/calc';
import type { GameState } from '../state/types';
import { explainCash } from './cash';
import { explainNetWorth } from './netWorth';
import type { ExplainerName } from './types';

export const explain = {
  /** Cash on hand → cash accounts → ledger postings. */
  cash: explainCash,
  /** netWorth(state, 'scoring') → company NW and the owner's personal items. */
  netWorth: explainNetWorth,
} as const satisfies Record<ExplainerName, (state: GameState, ...args: never[]) => CalcNode>;

export type Explainers = typeof explain;
export type { ExplainerName, ExplainRef } from './types';
