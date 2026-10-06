// §10 price readers (DESIGN §10 10.1–10.4, 10.17; P1 contract §4.10). P1–P4 prices are flat: every reader returns the
// market snapshot's value, which comes from the resolved tuning (the setup's opening spot is folded into
// `market.openingSpotUsdPerFineOz` at newGame), and the dated readers return the same value for every turn. P5's
// regime and GARCH price replaces the snapshot; these signatures stay.
import type { GameState } from '../../state/types';
import { marketSnapshot } from '../history/snapshot';

export function spotUsdPerFineOz(state: GameState): number {
  return marketSnapshot(state).spot;
}

export function dieselRackUsdPerGal(state: GameState): number {
  return marketSnapshot(state).dieselRack;
}

export function cpiIndex(state: GameState): number {
  return marketSnapshot(state).cpiIndex;
}

export function baseRate(state: GameState): number {
  return marketSnapshot(state).baseRate;
}

export function realRate(state: GameState): number {
  return marketSnapshot(state).realRate;
}

/** Spot ÷ the reference spot (1 on the flat market). */
export function goldIdx(state: GameState): number {
  return marketSnapshot(state).goldIdx;
}

/** goldIdx ÷ cpiIndex. */
export function goldIdxReal(state: GameState): number {
  const s = marketSnapshot(state);
  return s.goldIdx / s.cpiIndex;
}

/** goldIdx now ÷ goldIdx `weeks` ago − 1 (0 on the flat market). */
export function goldMomentum(_state: GameState): number {
  return 0;
}

export function goldIdxAt(state: GameState, _turn: number): number {
  return goldIdx(state);
}

export function goldIdxRealAt(state: GameState, _turn: number): number {
  return goldIdxReal(state);
}

export function goldMomentumAt(_state: GameState, _turn: number, _weeks: number): number {
  return 0;
}
