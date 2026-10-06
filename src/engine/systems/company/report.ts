// §1 company's week scratch (P1 contract §1.3, s02 #10): the owner's desk tasks completed in step 7, which §3 (site
// visits, step 7) and §4 (records reviews, step 16) read in the same week. It lives on `StepContext.week`, never in
// GameState, so it is never saved or hashed.

/** A desk task completed this week. Placeholder until §1's `DeskTask` (P1 contract §4.2) replaces it. */
export type DeskTask = Readonly<Record<string, unknown>>;

export interface DeskWeekScratch {
  done: DeskTask[];
}

export function emptyDeskWeekScratch(): DeskWeekScratch {
  return { done: [] };
}
