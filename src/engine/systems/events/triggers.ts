// §12's in-step triggers (DESIGN §12 12.1, 12.19; P1 contract §4.12). §7 calls `onBlockStripped` and `onBlockMined` in
// step 9 and the framework's cleanup chain calls `onCleanup` in step 12.1, so §12's in-step rows (the catalog's
// `trigger` field) can roll on the moment. P1 has no events, so all three are real no-ops; the §12 package fills them
// from P3 (rolls keyed `rng(seed, 'events', turn, defId, scopeKey)` with the block or cleanup as scope key).
import type { BlockId, ClaimId, LineId } from '../../core/ids';
import type { GameState } from '../../state/types';
import type { CleanupResult } from '../ops/types';
import type { StepContext } from '../../turn/types';

export function onBlockStripped(
  _draft: GameState,
  _ctx: StepContext,
  _at: { claimId: ClaimId; blockId: BlockId },
): void {
  // P1: no in-step events.
}

export function onBlockMined(_draft: GameState, _ctx: StepContext, _at: { claimId: ClaimId; blockId: BlockId }): void {
  // P1: no in-step events.
}

export function onCleanup(
  _draft: GameState,
  _ctx: StepContext,
  _at: { claimId: ClaimId; lineId: LineId; cleanup: CleanupResult },
): void {
  // P1: no in-step events.
}
