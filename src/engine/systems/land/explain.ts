// §5 land and tenure explainers (DESIGN §2.8, §5.17; P1 contract §4.5): pure (state, ...args) → CalcNode, spread into
// `explain` by explain/index.ts (S13-5: `ExplainerName = keyof typeof explain`). A listing's ask tags its hidden pricing
// factor `hidden` with a knownAlt (s05 #7). A name already used by another folder fails the composition test.
import type { CalcNode } from '../../core/calc';
import type { ClaimId, ClaimListingId, LineId, TenureId } from '../../core/ids';
import { stubCalcNode } from '../../state/partKit';
import type { GameState } from '../../state/types';

function listingAsk(_state: GameState, _listingId: ClaimListingId): CalcNode {
  // CONTRACT-STUB(§5) land.explain.listingAsk
  return stubCalcNode('Asking price', 'cents');
}

function claimValue(_state: GameState, _claimId: ClaimId): CalcNode {
  // CONTRACT-STUB(§5) land.explain.claimValue
  return stubCalcNode('Claim value P50', 'cents');
}

/** How a cleanup's gold was split among the interests (from the week's settlement). */
function cleanupSplit(_state: GameState, _claimId: ClaimId, _turn: number, _lineId: LineId): CalcNode {
  // CONTRACT-STUB(§5) land.explain.cleanupSplit
  return stubCalcNode('Player lot', 'rawOz');
}

function leaseObligations(_state: GameState, _tenureId: TenureId): CalcNode {
  // CONTRACT-STUB(§5) land.explain.leaseObligations
  return stubCalcNode('Lease obligations this year', 'cents');
}

function valuationViewExplain(_state: GameState, _claimId: ClaimId): CalcNode {
  // CONTRACT-STUB(§5) land.explain.valuationView
  return stubCalcNode('Valuation', 'cents');
}

export const landExplainers = {
  listingAsk,
  claimValue,
  cleanupSplit,
  leaseObligations,
  valuationView: valuationViewExplain,
} as const satisfies Record<string, (state: GameState, ...args: never[]) => CalcNode>;
