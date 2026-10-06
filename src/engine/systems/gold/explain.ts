// §10 gold explainers (DESIGN §2.8, §10 10.9, 10.10; S10-9; P1 contract §4.10): pure (state, ...args) → CalcNode, spread
// into `explain` by explain/index.ts (S13-5). The buyer's fineness is a visible leaf (S10-9). Wave-0 stubs return a
// zero leaf that says so (contract §12).
import type { CalcNode } from '../../core/calc';
import type { LocalBuyerId, LotId } from '../../core/ids';
import { stubCalcNode } from '../../state/partKit';
import type { GameState } from '../../state/types';

function lotFineness(_state: GameState, _lotId: LotId): CalcNode {
  // CONTRACT-STUB(§10) gold.explain.lotFineness
  return stubCalcNode('Estimated fineness', 'ratio');
}

function netSalePerFineOz(_state: GameState, _lotId: LotId): CalcNode {
  // CONTRACT-STUB(§10) gold.explain.netSalePerFineOz
  return stubCalcNode('Net per fine oz', 'usdPerFineOz');
}

function localBuyerQuote(_state: GameState, _lotIds: readonly LotId[], _buyerId: LocalBuyerId): CalcNode {
  // CONTRACT-STUB(§10) gold.explain.localBuyerQuote
  return stubCalcNode('Local buyer quote', 'cents');
}

function inventoryValue(_state: GameState): CalcNode {
  // CONTRACT-STUB(§10) gold.explain.inventoryValue
  return stubCalcNode('Gold on hand', 'cents');
}

export const goldExplainers = {
  lotFineness,
  netSalePerFineOz,
  localBuyerQuote,
  inventoryValue,
} as const satisfies Record<string, (state: GameState, ...args: never[]) => CalcNode>;
