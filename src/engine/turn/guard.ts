// canAdvance (DESIGN §2.2, §2.6 step 0): a week cannot run while a blocking decision is open or once the run has
// ended. An open reorganization case leaves runStatus 'active', so it never blocks by itself (D-2.30).
import { EngineGuardError } from '../core/assert';
import { hasOpenBlockingDecision } from '../actions/decisions';
import type { GameState } from '../state/types';

export type AdvanceRefusal = 'BLOCKING_DECISION_OPEN' | 'GAME_OVER';

export function canAdvance(state: GameState): null | AdvanceRefusal {
  if (state.company.runStatus !== 'active') return 'GAME_OVER';
  if (hasOpenBlockingDecision(state)) return 'BLOCKING_DECISION_OPEN';
  return null;
}

/** Throws EngineGuardError with the refusal code when the state cannot advance. */
export function assertCanAdvance(state: GameState): void {
  const refusal = canAdvance(state);
  if (refusal !== null) {
    throw new EngineGuardError(
      refusal,
      refusal === 'GAME_OVER'
        ? 'the run has ended'
        : 'a blocking decision must be answered before the week can advance',
    );
  }
}
