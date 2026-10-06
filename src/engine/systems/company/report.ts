// §1 company's week scratch (P1 contract §1.3, s02 #10): the owner's desk tasks completed in step 7, which §3 (site
// visits, step 7) and §4 (records reviews, step 16) read in the same week. It lives on `StepContext.week`, never in
// GameState, so it is never saved or hashed.
import type { DeskTask } from './types';

export type { DeskTask } from './types';

export interface DeskWeekScratch {
  done: DeskTask[];
}

export function emptyDeskWeekScratch(): DeskWeekScratch {
  return { done: [] };
}
