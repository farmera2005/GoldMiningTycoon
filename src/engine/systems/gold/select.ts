// §10 gold selectors (DESIGN §2.11): pure readers over state, spread into `select` by select/index.ts. None reads a
// hidden field. A name already used by another folder fails the composition test.
import type { GameState } from '../../state/types';
import { marketSnapshot } from '../history/snapshot';
import type { MarketSnapshot } from '../history/types';

/** This week's visible market series (§10; P0–P4 flat). */
function market(state: GameState): MarketSnapshot {
  return marketSnapshot(state);
}

/** §10 spot, USD per fine oz. */
function spotUsdPerFineOz(state: GameState): number {
  return marketSnapshot(state).spot;
}

export const goldSelectors = {
  market,
  spotUsdPerFineOz,
} as const;
