// §9 fleet explainers (DESIGN §2.8, §9 9.7, 9.10; P1 contract §4.9): pure (state, ...args) → CalcNode, spread into
// `explain` by explain/index.ts (S13-5). Wave-0 stubs return a zero leaf that says so (contract §12).
import type { CalcNode } from '../../core/calc';
import type { ClaimId, EquipListingId, MachineId } from '../../core/ids';
import { stubCalcNode } from '../../state/partKit';
import type { GameState } from '../../state/types';

function fleetMaintRate(_state: GameState, _machineId: MachineId): CalcNode {
  // CONTRACT-STUB(§9) fleet.explain.fleetMaintRate
  return stubCalcNode('Maintenance per SMR hour', 'usdPerHour');
}

function resaleEstimate(_state: GameState, _machineId: MachineId): CalcNode {
  // CONTRACT-STUB(§9) fleet.explain.resaleEstimate
  return stubCalcNode('Estimated resale', 'cents');
}

function equipmentPrice(_state: GameState, _listingId: EquipListingId): CalcNode {
  // CONTRACT-STUB(§9) fleet.explain.equipmentPrice
  return stubCalcNode('Asking price', 'cents');
}

function transportQuote(_state: GameState, _machineIds: readonly MachineId[], _toClaimId: ClaimId): CalcNode {
  // CONTRACT-STUB(§9) fleet.explain.transportQuote
  return stubCalcNode('Transport cost', 'cents');
}

function bookValue(_state: GameState, _machineId: MachineId): CalcNode {
  // CONTRACT-STUB(§9) fleet.explain.bookValue
  return stubCalcNode('Book value', 'cents');
}

export const fleetExplainers = {
  fleetMaintRate,
  resaleEstimate,
  equipmentPrice,
  transportQuote,
  bookValue,
} as const satisfies Record<string, (state: GameState, ...args: never[]) => CalcNode>;
