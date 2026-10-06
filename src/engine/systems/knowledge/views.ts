// §4 estimate views over state (DESIGN §4.7, §4.11, §4.14, §4.18; P1 contract §4.4). Estimates are never stored: they
// are rebuilt from the player's evidence by the pure estimator and cached in core/memo.ts (D-4.24), warm from step 16.
// Until §4's view package wires the estimator to state, every claim reads as having no estimate.
import type { ClaimId, ClaimListingId } from '../../core/ids';
import type { GameState } from '../../state/types';
import type {
  BlockEstimate,
  ClaimEstimate,
  DecisionContext,
  EstimateVerdict,
  SellerCheckStatus,
  SellerFlag,
} from './types';

/** The player's estimate of a claim (memoized by evidence hash), or null with no evidence model yet. */
export function knownEstimate(_state: GameState, _claimId: ClaimId): ClaimEstimate | null {
  // CONTRACT-STUB(§4) knowledge.knownEstimate
  return null;
}

export function blockEstimates(_state: GameState, _claimId: ClaimId): BlockEstimate[] {
  // CONTRACT-STUB(§4) knowledge.blockEstimates
  return [];
}

/** The q-quantile of contained or minable ounces. */
export function percentileOz(
  _state: GameState,
  _claimId: ClaimId,
  _q: number,
  _which: 'contained' | 'minable',
): number {
  // CONTRACT-STUB(§4) knowledge.percentileOz
  return 0;
}

/** The decision an estimate is read against (default or the player's), or null. */
export function decisionContext(_state: GameState, _claimId: ClaimId): DecisionContext | null {
  // CONTRACT-STUB(§4) knowledge.decisionContext
  return null;
}

/** §4.14's verdict line. */
export function estimateVerdict(_state: GameState, _claimId: ClaimId): EstimateVerdict {
  // CONTRACT-STUB(§4) knowledge.estimateVerdict
  return {
    lowOz: 0,
    highOz: 0,
    set: 'contained',
    blocks: 0,
    biggestUnknown: 'none',
    text: 'verdict.none',
  };
}

export interface SellerCredibility {
  status: SellerCheckStatus;
  flags: SellerFlag[];
  pHonest?: number;
}

/** §5's view of a listing's seller check. */
export function sellerCredibility(_state: GameState, _listingId: ClaimListingId): SellerCredibility {
  // CONTRACT-STUB(§4) knowledge.sellerCredibility
  return { status: 'unchecked', flags: [] };
}
