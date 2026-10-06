// §6 step 13 (DESIGN §6.9, §6.16, §2.6; D-6.59, D-6.60; S12-9; P1 contract §3 part 13.1). P1 runs two sub-steps:
//   (f) billable obligations unsatisfied at `dueTurn + graceWeeks + 1` become `missed` and are routed by owner (§5
//       `land.onObligationMissed`, §1 `investor.onMinimumMissed`, a P1 no-op; §11 judges its own in 14f); recurrences
//       are created;
//   (j) `obligation.dueSoon` on §13's ladder (capped at info in P1) and `obligation.missed` for §6, §5 and §1 items.
import type { GameState } from '../../state/types';
import type { StepContext } from '../../turn/types';

export function obligationsStep(_draft: GameState, _ctx: StepContext): void {
  // CONTRACT-STUB(§6) permits.obligationsStep
}
