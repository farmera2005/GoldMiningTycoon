// `game.*` tuning constants (DESIGN §1 1.20, §2 2.16). Keys must start with 'game.'.
import type { TuningTable } from './types';

export const gameTuning = {
  'game.history.weeklyKeep': 156,
  'game.startCalendarYear': 2027,
} as const satisfies TuningTable;
