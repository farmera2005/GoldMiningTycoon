// Test seam for the scrambled-truth bot test (DESIGN §2.12 "Visibility", §2.14 "Bots"; CLAUDE.md "Hidden
// information"): a bot must give identical decisions on a state whose hidden fields are scrambled, because it may read
// only selectors and its view.
//
// P0 has no hidden fields: the world slice is the generator's contract and every other slice holds only visible
// records, so `scrambleHidden` returns an unchanged deep copy and the test passes trivially. From P1 each owner adds a
// scrambler for its hidden fields here, keyed by the seed so a failure reproduces: §3 true geology (placer and lode),
// §9 component health, §8 candidate and employee attributes, §5 seller honesty, counterparties' reservation values and
// motivation, title defects, §10 true fineness of unassayed lots, §1 season drivers and unrevealed season dates, §10
// the price regime and fair value, §12 news truthfulness and competitors' private state.
import type { GameState } from '../../src/engine';

/** A scrambler rewrites hidden fields only (never a visible one), deterministically from `seed`. */
export type HiddenScrambler = (state: GameState, seed: string) => GameState;

/** Registered scramblers, applied in order (none in P0). */
export const HIDDEN_SCRAMBLERS: readonly HiddenScrambler[] = [];

export function scrambleHidden(state: GameState, seed: string): GameState {
  let s = JSON.parse(JSON.stringify(state)) as GameState;
  for (const scramble of HIDDEN_SCRAMBLERS) s = scramble(s, seed);
  return s;
}
