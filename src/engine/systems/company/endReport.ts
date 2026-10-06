// §1 end-of-run report (DESIGN §1 1.14, D-1.84; P1 contract §4.2): the outcome, dates, seed, score and medal, the
// claims table, the reveal (geology only in P1), the timeline and the rule-based lessons. Available once
// `runStatus ≠ 'active'`; §13 renders it.
import type { GameState } from '../../state/types';
import type { EndReport } from './types';

/** The end report, or null while the run is active. */
export function endReport(_state: GameState): EndReport | null {
  // CONTRACT-STUB(§1) company.endReport
  return null;
}
