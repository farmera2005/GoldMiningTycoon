// §11 11.19.5 cost totals of a span of turns, which §2's annual rollup records (s01 #20, S11-15): the company's cash
// cost and all-in sustaining cost, from the same cost centers as `costPerOunce`. The P0 books carry no operating cost,
// so the body is neutral until §11's package derives it from its statements.
import { ZERO_CENTS, type Cents } from '../../core/money';
import type { GameState } from '../../state/types';

export interface PeriodCostTotals {
  cashCostCents: Cents;
  aiscCents: Cents;
}

/** Cost totals for turns fromTurn … toTurn inclusive (company book). */
export function periodCostTotals(_state: GameState, _fromTurn: number, _toTurn: number): PeriodCostTotals {
  // CONTRACT-STUB(§11)
  return { cashCostCents: ZERO_CENTS, aiscCents: ZERO_CENTS };
}
