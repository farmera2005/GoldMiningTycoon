// §5 land selectors (DESIGN §2.11): pure readers over state, spread into `select` by select/index.ts. None reads a
// hidden field. A name already used by another folder fails the composition test.
import type { DistrictId } from '../../core/ids';
import type { GameState } from '../../state/types';

/** Districts where the player holds ground (§5 active tenures). The P0 slice holds no tenure. */
function heldDistrictIds(_state: GameState): DistrictId[] {
  // CONTRACT-STUB(§5)
  return [];
}

/** Claims the player controls through an active tenure (§5; the annual rollup's `claimsHeld`). */
function controlledClaimCount(_state: GameState): number {
  // CONTRACT-STUB(§5)
  return 0;
}

export const landSelectors = {
  heldDistrictIds,
  controlledClaimCount,
} as const;
