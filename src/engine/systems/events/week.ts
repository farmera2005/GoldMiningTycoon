// §12 in the pipeline (DESIGN §12 12.19, §2.6; P1 contract §3 parts 4.2, 10.6, 16.12).
//   4.2 `eventsStep`: expire modifiers and instances, apply scheduled effects, roll weekly candidates, run the director,
//       accept, apply effects, create response decisions (P3+; a no-op with an empty catalog in P1).
//   10.6 `tallyShocks` (P3): count §9 failures and §8 injuries for the director's stacking rule.
//   16.12 `wrapUp`: history ring (156 weeks), annual counts, alerts.
import type { GameState } from '../../state/types';
import type { StepContext } from '../../turn/types';

export function eventsStep(_draft: GameState, _ctx: StepContext): void {
  // CONTRACT-STUB(§12) events.eventsStep
}

export function wrapUp(_draft: GameState, _ctx: StepContext): void {
  // CONTRACT-STUB(§12) events.wrapUp
}
