// §5 cleanup settlement (DESIGN §5.12; D-5.27, D-5.34, D-5.61, D-5.79; P1 contract §4.5, §0.6 item 7). At every weighing
// (step 12, cleanup or sample) the interests on a claim are settled off the top, in milli-ounces: property level by
// seniority on gross, then the JV level, then the attributable level; in-kind deliveries leave the weighed gold, cash
// interests accrue; the player's lot is the exact remainder. §5 posts credit consumption and accruals, and records
// +0.5 reputation per in-kind lease royalty paid in full. With no interest (every Wave-0 game) the player keeps it all.
import type { ClaimId, ProductionInterestId } from '../../core/ids';
import { ZERO_CENTS, type Cents, type MilliOz } from '../../core/money';
import type { GameState } from '../../state/types';
import type { Settlement } from './types';

export interface SettlementInput {
  rawMilliOz: MilliOz;
  turn: number;
  source: 'cleanup' | 'sample';
}

export function settleProductionInterests(_draft: GameState, _claimId: ClaimId, input: SettlementInput): Settlement {
  // CONTRACT-STUB(§5) land.settleProductionInterests
  return { deliveries: [], cashAccruals: [], playerRawMilliOz: input.rawMilliOz };
}

/** §11's week-52 top-up of a royalty minimum: minimum − Δ paidToDate.valueCents over year Y; 0 once stepped (s01 #25). */
export function minimumShortfallCents(_state: GameState, _interestId: ProductionInterestId, _year: number): Cents {
  // CONTRACT-STUB(§5) land.minimumShortfallCents
  return ZERO_CENTS;
}
