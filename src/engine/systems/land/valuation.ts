// §5 the player's valuation of ground and the deal previews (DESIGN §5.13, §5.14, §5.15; s05 #12, #26; S13-9; P1
// contract §4.5). Valuations read the player's estimate only (§4 knownEstimate), never truth: cost = §4
// costUsdPerPayBcyM + land.valCapitalChargePerBcy × cpiIndex. The quick sale quotes `land.quickSaleFrac` × the buyer's
// summary valuation, whose oz view is §4's minableOzP50 alone. Wave-0 stubs return zeros and nulls.
import type { ValidationResult } from '../../actions/types';
import type { ClaimId, ClaimListingId, TenureId } from '../../core/ids';
import { ZERO_CENTS, type Cents } from '../../core/money';
import type { GameState } from '../../state/types';
import type { Forecast13Week } from '../finance/types';
import type { ObligationSpec } from '../permits/types';
import type { ListingInfo } from '../world/types';
import type { BuyerClaimView, ClaimValuation, LeaseTerms, SaleTerms } from './types';

/** `previewOffer` (S13-9): what accepting the ask costs and commits to, with §11's forecast after close. */
export interface OfferPreview {
  cashAtCloseCents: Cents;
  closingCostsCents: Cents;
  firstYearObligations: ObligationSpec[];
  validation: ValidationResult;
  forecastAfterClose: Forecast13Week;
}

const ZERO_VALUATION: ClaimValuation = {
  p10Cents: ZERO_CENTS,
  p50Cents: ZERO_CENTS,
  p90Cents: ZERO_CENTS,
  breakdown: { burden: 0, amrCents: ZERO_CENTS, holdingCents: ZERO_CENTS, opPvCents: ZERO_CENTS, npvCents: ZERO_CENTS },
};

/** The presented permit authority of a listing (§3 owns the statement): a pure map, 'none' in P1. */
export function presentedAuthority(info: Pick<ListingInfo, 'permits'>): 'none' | 'notice' | 'plan' {
  switch (info.permits.status) {
    case 'none':
    case 'unknown':
      return 'none';
    case 'noticeOnFile':
      return 'notice';
    case 'planApproved':
      return 'plan';
  }
}

export function valueClaimForPlayer(
  _state: GameState,
  _claimId: ClaimId,
  _terms?: SaleTerms | LeaseTerms,
): ClaimValuation {
  // CONTRACT-STUB(§5) land.valueClaimForPlayer
  return { ...ZERO_VALUATION, breakdown: { ...ZERO_VALUATION.breakdown } };
}

/** The visible valuation panel of a claim. */
export function valuationView(state: GameState, claimId: ClaimId): ClaimValuation {
  // CONTRACT-STUB(§5) land.valuationView
  return valueClaimForPlayer(state, claimId);
}

export function breakevenGradeOzPerBcy(_state: GameState, _claimId: ClaimId, _blockId: string): number | null {
  // CONTRACT-STUB(§5) land.breakevenGradeOzPerBcy
  return null;
}

export function breakevenSpot(_state: GameState, _claimId: ClaimId): number | null {
  // CONTRACT-STUB(§5) land.breakevenSpot
  return null;
}

export function breakevenOz(_state: GameState, _claimId: ClaimId, _priceCents?: Cents): number | null {
  // CONTRACT-STUB(§5) land.breakevenOz
  return null;
}

/** Sensitivity of the valuation to price, grade and cost (§13 tornado). */
export function valueSensitivity(
  _state: GameState,
  _claimId: ClaimId,
): { key: string; lowCents: Cents; highCents: Cents }[] {
  // CONTRACT-STUB(§5) land.valueSensitivity
  return [];
}

/** A buyer's view of a held claim (s05 #12). */
export function buyerClaimView(
  _state: GameState,
  _tenureId: TenureId,
  _disclosure: 'none' | 'summary' | 'full',
): BuyerClaimView {
  // CONTRACT-STUB(§5) land.buyerClaimView
  return { minableOzP50: 0, valueCents: ZERO_CENTS };
}

/** = land.quickSaleFrac × V_buyer(summary). */
export function quickSaleQuote(_state: GameState, _tenureId: TenureId): Cents {
  // CONTRACT-STUB(§5) land.quickSaleQuote
  return ZERO_CENTS;
}

/** The preview of accepting a listing's ask (S13-9). */
export function previewOffer(
  _state: GameState,
  _listingId: ClaimListingId,
  _structure: 'sale' | 'lease',
): OfferPreview {
  // CONTRACT-STUB(§5) land.previewOffer
  return {
    cashAtCloseCents: ZERO_CENTS,
    closingCostsCents: ZERO_CENTS,
    firstYearObligations: [],
    validation: { ok: false, error: { code: 'NOT_IMPLEMENTED', message: 'land.previewOffer is not implemented yet' } },
    forecastAfterClose: { weeks: [], productionByClaim: {} },
  };
}
