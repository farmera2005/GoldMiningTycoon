// §5 land's week scratch and week record (P1 contract §1.3, s02 #10). The scratch carries this week's listing events
// (written in steps 3 and 6, read by §3's wrap-up and §13); the record lists what became visible, including the
// settlements of production interests taken off the top at each weighing (milli-ounces, exact).
import type { ClaimId, ClaimListingId, ClosingId, LineId } from '../../core/ids';
import type { MilliOz } from '../../core/money';
import type { ListingEvent } from './types';

export type { ListingEvent } from './types';

export interface LandWeekScratch {
  listingEvents: ListingEvent[];
}

export interface LandWeekRecord {
  listingsNew: ClaimListingId[];
  listingsClosed: ClaimListingId[];
  closings: ClosingId[];
  settlements: { claimId: ClaimId; lineId: LineId | null; deliveredRawMilliOz: MilliOz; playerRawMilliOz: MilliOz }[];
}

export function emptyLandWeekScratch(): LandWeekScratch {
  return { listingEvents: [] };
}

export function emptyLandWeekRecord(): LandWeekRecord {
  return { listingsNew: [], listingsClosed: [], closings: [], settlements: [] };
}
