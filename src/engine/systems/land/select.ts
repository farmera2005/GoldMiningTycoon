// §5 land selectors (DESIGN §2.11, §5.17; P1 contract §4.5): pure readers over state, spread into `select` by
// select/index.ts. They never return a hidden field: a listing view drops the seller's disposition (`hidden`) and the
// summary's belief (`info.summary.hidden`), and a tenure view drops its undiscovered defects. A name already used by
// another folder fails the composition test.
import type { ClaimId, ClaimListingId, TenureId } from '../../core/ids';
import { sortedValues } from '../../core/iter';
import type { GameState } from '../../state/types';
import type { ListingInfo, SellerClaimSummary } from '../world/types';
import {
  controlledClaimCount,
  heldClaimIds,
  heldDistrictIds,
  holdingCostAnnual,
  samplingAccess,
  tenureOf,
} from './tenure';
import type { Listing, ProductionInterest, Tenure } from './types';
import { previewOffer, quickSaleQuote, valuationView, valueClaimForPlayer } from './valuation';

/** A listing as the player sees it. */
export type ListingView = Omit<Listing, 'hidden' | 'info'> & {
  info: Omit<ListingInfo, 'summary'> & { summary: Omit<SellerClaimSummary, 'hidden'> };
};

/** A tenure as the player sees it. */
export type TenureView = Omit<Tenure, 'hiddenDefects'>;

export interface ListingFilter {
  status?: Listing['status'];
  districtId?: string;
}

function listingView(l: Listing): ListingView {
  const { hidden: _hidden, info, ...rest } = l;
  const { hidden: _belief, ...summary } = info.summary;
  return { ...rest, info: { ...info, summary } };
}

function tenureView(t: Tenure): TenureView {
  const { hiddenDefects: _h, ...rest } = t;
  return rest;
}

function listings(state: GameState, filter: ListingFilter = {}): ListingView[] {
  return sortedValues(state.land.listings)
    .filter((l) => filter.status === undefined || l.status === filter.status)
    .filter((l) => filter.districtId === undefined || l.info.districtId === filter.districtId)
    .map(listingView);
}

function listing(state: GameState, listingId: ClaimListingId): ListingView | null {
  const l = state.land.listings[listingId];
  return l === undefined ? null : listingView(l);
}

function tenures(state: GameState): TenureView[] {
  return sortedValues(state.land.tenures).map(tenureView);
}

function tenure(state: GameState, tenureId: TenureId): TenureView | null {
  const t = state.land.tenures[tenureId];
  return t === undefined ? null : tenureView(t);
}

function tenureOfView(state: GameState, claimId: ClaimId): TenureView | null {
  const t = tenureOf(state, claimId);
  return t === null ? null : tenureView(t);
}

/** Production interests, all or those burdening one claim (claim-specific and company-wide). */
function productionInterests(state: GameState, claimId?: ClaimId): ProductionInterest[] {
  const all = sortedValues(state.land.interests);
  if (claimId === undefined) return all;
  return all.filter(
    (pi) => pi.claimId === claimId || (pi.claimId === undefined && !pi.excludedClaimIds.includes(claimId)),
  );
}

export const landSelectors = {
  listings,
  listing,
  tenures,
  tenure,
  tenureOf: tenureOfView,
  productionInterests,
  heldClaimIds,
  heldDistrictIds,
  controlledClaimCount,
  samplingAccess,
  quickSaleQuote,
  valueClaimForPlayer,
  previewOffer,
  valuationView,
  holdingCostAnnual,
} as const;
