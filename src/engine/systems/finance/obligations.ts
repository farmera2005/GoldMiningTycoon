// §11's side of the obligation store (DESIGN §6.9, §11.4; D-11.44, D-11.90; S11-18; P1 contract §4.11). §6 calls these
// after it changes an obligation §11 owns or bills: a satisfied obligation closes its open bill; a cancelled one cancels
// it. Loans (P1: the estate note and the banker stub) and their obligations arrive with §11's package; until then there
// is nothing to close.
import type { GameState } from '../../state/types';
import type { Obligation } from '../permits/types';

export function onObligationSatisfied(_draft: GameState, _obligation: Obligation): void {
  // CONTRACT-STUB(§11) finance.onObligationSatisfied
}

export function onObligationCancelled(_draft: GameState, _obligation: Obligation): void {
  // CONTRACT-STUB(§11) finance.onObligationCancelled
}
