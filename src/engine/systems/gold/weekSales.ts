// §10's sales accumulator for §2's history (P1 contract §0.6 item 5, §4.10; s02 #9). Gold can be sold at action time
// (between pipelines) as well as by step 12's standing orders, so §10 adds every sale to `gold.weekSales` and §2's
// step-16 snapshot reads the total and resets it: a sale made after pipeline t − 1 counts in snapshot t. The P0 slice
// has no sales, so both bodies are neutral until §10's package adds the field.
import type { GameState } from '../../state/types';

export interface WeekSalesTotals {
  /** Estimated fine oz sold since the last snapshot. */
  fineOz: number;
}

/** Sales since the last history snapshot. */
export function weekSalesSinceSnapshot(_state: GameState): WeekSalesTotals {
  // CONTRACT-STUB(§10)
  return { fineOz: 0 };
}

/** Clears the accumulator once §2's snapshot has read it (mutates a draft). */
export function resetWeekSales(_draft: GameState): void {
  // CONTRACT-STUB(§10)
}
