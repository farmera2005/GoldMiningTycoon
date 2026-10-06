// §3 world selectors (DESIGN §2.11, §3.14; P1 contract §4.3): pure readers over state, spread into `select` by
// select/index.ts. None reads a hidden field (claim truth, holders' honesty and evidence, the hidden water). A name
// already used by another folder fails the composition test.
import type { ClaimId, ClaimListingId, DistrictId } from '../../core/ids';
import { sortedValues } from '../../core/iter';
import type { GameState } from '../../state/types';
import { claimAccess, claimWater, districtMap, listedFlowGpm } from './claimState';
import type { SellerTell } from './listingTypes';
import { siteVisitQuote } from './siteVisit';
import type { SiteVisitReport } from './types';

/** The player's watch list (inbox preferences, world/setWatch). */
function watchList(state: GameState): { districtIds: DistrictId[]; claimIds: ClaimId[] } {
  const w = state.world.watch;
  return { districtIds: [...w.districtIds], claimIds: [...w.claimIds] };
}

/** A claim's site-visit reports (the last 3, oldest first). */
function siteVisitReports(state: GameState, claimId: ClaimId): SiteVisitReport[] {
  return [...(state.world.siteVisits[claimId] ?? [])];
}

/** The tells found on a listing, by tell kind order of the stored keys. */
function foundTells(state: GameState, listingId: ClaimListingId): SellerTell[] {
  return sortedValues(state.world.foundTells).filter((t) => t.listingId === listingId);
}

export const worldSelectors = {
  watchList,
  districtMap,
  claimAccess,
  claimWater,
  listedFlowGpm,
  siteVisitReports,
  foundTells,
  siteVisitQuote,
} as const;
