// §1 step 16d run-end check (DESIGN §1 1.14, 1.17): §11's liquidation flag from step 15 (cause filed, involuntary,
// converted or p1Counter) ends the run as 'lost' / 'liquidated' with its path. Ouster and scenario results join it
// with their phases (P4, P6). An open reorganization case leaves the run 'active' (D-2.30).
import { produceState } from '../../state/immutability';
import type { GameState } from '../../state/types';

export function runEndCheck(state: GameState): GameState {
  if (state.company.runStatus !== 'active') return state;
  const liquidation = state.finance.distress.liquidation;
  if (liquidation === null) return state;
  return produceState(state, (draft) => {
    draft.company.runStatus = 'lost';
    draft.company.endReason = 'liquidated';
    draft.company.liquidationPath = liquidation.cause;
  });
}
