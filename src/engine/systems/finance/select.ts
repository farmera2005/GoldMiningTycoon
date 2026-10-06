// §11 finance selectors (DESIGN §2.11, §11 11.20): pure readers over state, spread into `select` by select/index.ts.
// None reads a hidden field. A name already used by another folder fails the composition test.
import type { Cents } from '../../core/money';
import type { GameState } from '../../state/types';
import { cashOnHandCents, companyNetWorthCents, netWorthCents, type NetWorthMode } from './netWorth';

/** §11 cashOnHand: operating + reserve, excluding restricted cash. */
function cashOnHand(state: GameState): Cents {
  return cashOnHandCents(state.finance);
}

/** §2.11 / §11 11.20 netWorth(state, mode); 'scoring' is §1 1.13's owner NW (P0 form: ledger marks only). */
function netWorth(state: GameState, mode: NetWorthMode): Cents {
  return netWorthCents(state.finance, state.meta.tuning, mode);
}

/** §1 1.13 companyNW. */
function companyNetWorth(state: GameState): Cents {
  return companyNetWorthCents(state.finance, state.meta.tuning);
}

export const financeSelectors = {
  cashOnHand,
  netWorth,
  companyNetWorth,
} as const;
