// §1 company and owner selectors (DESIGN §2.11; P1 contract §4.2): pure readers over state, spread into `select` by
// select/index.ts. §1 holds no hidden field. A name already used by another folder fails the composition test.
import type { Cents } from '../../core/money';
import { sortedValues } from '../../core/iter';
import type { GameState } from '../../state/types';
import { ownerPersonalCash } from '../finance/owner';
import { ownerDeskDays } from './desk';
import { endReport } from './endReport';
import type { InvestorTermsView, Owner, ReputationEntry, TimelineEntry } from './types';

/** The owner record plus the owner-book cash §11 publishes (D-1.73). */
export interface OwnerView extends Owner {
  personalCashCents: Cents;
}

function owner(state: GameState): OwnerView {
  return { ...state.company.owner, personalCashCents: ownerPersonalCash(state) };
}

/** Reputation with its last 52 weeks of entries (1.12: fully visible). */
function reputation(state: GameState): { value: number; log: ReputationEntry[] } {
  const r = state.company.reputation;
  return { value: r.value, log: [...r.log] };
}

/** Every investor agreement's visible terms, in id order. */
function investorAgreements(state: GameState): InvestorTermsView[] {
  return sortedValues(state.company.investors).map((a) => {
    const { satisfaction: _s, hostileStreak: _h, approvalRequestCount: _r, reorgCaseSeen: _c, ...view } = a;
    return view;
  });
}

/** The end report's decision timeline (D-1.84). */
function timeline(state: GameState): TimelineEntry[] {
  return [...state.company.timeline];
}

export const companySelectors = {
  owner,
  ownerDeskDays,
  reputation,
  investorAgreements,
  timeline,
  endReport,
} as const;
