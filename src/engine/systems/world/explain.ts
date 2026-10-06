// §3 world explainers (DESIGN §2.8; P1 contract §4.3): pure (state, ...args) → CalcNode, spread into `explain` by
// explain/index.ts (S13-5: `ExplainerName = keyof typeof explain`). A name already used by another folder fails the
// composition test.
import { EXPLAIN_ON, type CalcNode } from '../../core/calc';
import type { ClaimId } from '../../core/ids';
import { stubCalcNode } from '../../state/partKit';
import type { GameState } from '../../state/types';
import { claimAccessFactors } from './claimState';

/** Mobilization multiplier → access class anchor × distance scale (§3.3.3). */
function accessFactors(state: GameState, claimId: ClaimId): CalcNode {
  const r = claimAccessFactors(state, claimId, EXPLAIN_ON);
  return r.calc ?? { label: 'Mobilization multiplier', value: r.value.mobMult, unit: 'mult' };
}

/** This week's water at a claim (§3.3.4). */
function waterAvailable(_state: GameState, _claimId: ClaimId): CalcNode {
  // CONTRACT-STUB(§3) world.explain.waterAvailable
  return stubCalcNode('Water available', 'gpm');
}

/** A site visit's cost and days (S13-9). */
function siteVisitQuoteExplain(_state: GameState, _claimId: ClaimId): CalcNode {
  // CONTRACT-STUB(§3) world.explain.siteVisitQuote
  return stubCalcNode('Site visit cost', 'cents');
}

export const worldExplainers = {
  accessFactors,
  waterAvailable,
  siteVisitQuote: siteVisitQuoteExplain,
} as const satisfies Record<string, (state: GameState, ...args: never[]) => CalcNode>;
