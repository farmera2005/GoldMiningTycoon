// §1 investors (DESIGN §1 1.8.1; P1 contract §4.2). The equity waterfall (pure; used by net worth, buyouts and the end
// report): each equity agreement, most senior first, claims min(remaining, max(pref, conversion)); the owner's share
// is what is left. With no equity holder (every P1 Wave-0 game) the owner's share is the company's whole net worth.
// Royalty agreements are liabilities, not equity: their delivered value is read from §5's interest (D-5.61).
import { ZERO_CENTS, type Cents } from '../../core/money';
import type { InvestorAgreementId, ObligationId } from '../../core/ids';
import type { GameState } from '../../state/types';
import type { StepContext } from '../../turn/types';

export interface InvestorClaim {
  agreementId: InvestorAgreementId;
  claimCents: Cents;
}

/** Each equity holder's claim on a company net worth (1.8.1 waterfall), most senior first. */
export function investorClaims(_state: GameState, _companyNwCents: Cents): InvestorClaim[] {
  // CONTRACT-STUB(§1) investors.investorClaims
  return [];
}

/** companyNW − Σ investor claims (equals companyNW when it is negative or no equity holder exists). */
export function ownerShare(_state: GameState, companyNwCents: Cents): Cents {
  // CONTRACT-STUB(§1) investors.ownerShare
  return companyNwCents;
}

/** Value delivered to a royalty investor so far: §5's interest `paidToDate.valueCents` (s01 #25). */
export function deliveredValueCents(_state: GameState, _agreementId: InvestorAgreementId): Cents {
  // CONTRACT-STUB(§1) investors.deliveredValueCents
  return ZERO_CENTS;
}

/** §6 routes a missed royalty minimum here (1.8.1). P1: nothing (the cure ships in P4; P1 opens the §11 counter). */
export function investorOnMinimumMissed(_draft: GameState, _obligationId: ObligationId): void {
  // P1–P3: a missed top-up is a failed payment; the cure and foreclosure ship in P4.
}

/** §11 reads it when counting missed plan payments: true while a confirmed plan runs and an equity holder is hostile. */
export function conversionMotionActive(_state: GameState): boolean {
  return false;
}

/** Part 16.2 (16b): P1 does nothing (the agreements are consistent); check-ins arrive in P4. */
export function investorsWeekly(_draft: GameState, _ctx: StepContext): void {
  // Nothing to do under P1 rules.
}
