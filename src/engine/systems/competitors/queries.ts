// §12 competitor readers for other sections (DESIGN §12 12.12, 12.13; D-8.53; P1 contract §4.12). §8's labor market
// reads the competitors' labor demand and §5's listing market their interest in a listing. There are no competitors
// before P5, so both are real and return 0 (P1 forms).
import type { ClaimListingId, DistrictId } from '../../core/ids';
import type { GameState } from '../../state/types';

/** Competitors' crew demand in a district this week (§8 `cld`; 0 until P5). */
export function competitorLaborDemand(_state: GameState, _districtId: DistrictId): number {
  return 0;
}

/** Competitors' interest in a listing (§5; 0 until P5). */
export function competitorInterest(_state: GameState, _listingId: ClaimListingId): number {
  return 0;
}
