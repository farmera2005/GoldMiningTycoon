// §10's sales accumulator for §2's history (P1 contract §0.6 item 5, §4.10; s02 #9, D-2.62). Gold can be sold at action
// time (between pipelines) as well as by step 12's standing orders, so §10 adds every sale to `gold.weekSales` and §2's
// step-16 snapshot reads the total and resets it: a sale made after pipeline t − 1 counts in snapshot t. Both bodies are
// real (W0).
import { ZERO_CENTS } from '../../core/money';
import type { GameState } from '../../state/types';

export interface WeekSalesTotals {
  /** Estimated fine oz sold since the last snapshot. */
  fineOz: number;
}

/** Sales since the last history snapshot. */
export function weekSalesSinceSnapshot(state: GameState): WeekSalesTotals {
  return { fineOz: state.gold.weekSales.fineOz };
}

/** Clears the accumulator once §2's snapshot has read it (mutates a draft). */
export function resetWeekSales(draft: GameState): void {
  const w = draft.gold.weekSales;
  if (w.fineOz === 0 && w.rawMilliOz === 0 && w.netCents === ZERO_CENTS) return;
  draft.gold.weekSales = { fineOz: 0, rawMilliOz: 0, netCents: ZERO_CENTS };
}
