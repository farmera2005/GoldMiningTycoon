// §3 seller tells (DESIGN §3.10.4; D-3.66; s03 #6; P1 contract §4.3). A review rolls each applicable tell once per
// (listing, channel) on `rng(seed,'seller-tells',listingId,channel)` with p = min(0.98, base × skillMult); found tells
// are written to `world.foundTells` under '<listingId>/<tellKind>' and returned. Because the stream is keyed by
// (listing, channel), a higher-skill review finds a superset. Accurate sellers generate none.
import type { ClaimListingId } from '../../core/ids';
import type { GameState } from '../../state/types';
import type { SellerTell } from './listingTypes';

export type TellChannel = SellerTell['channel'];

/** Rolls a review's tells (§4 records reviews and geologist reviews, §3 site visits). */
export function revealTells(
  _draft: GameState,
  _listingId: ClaimListingId,
  _channel: TellChannel,
  _skillMult: number,
): SellerTell[] {
  // CONTRACT-STUB(§3) world.revealTells
  return [];
}
