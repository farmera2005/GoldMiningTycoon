// `game.*` tuning constants (DESIGN §1 1.20, §2 2.16, §13 13.25 `game.alerts.*`). Keys must start with 'game.'.
import type { TuningTable } from './types';

export const gameTuning = {
  // §2 2.16: the weekly history ring holds turns t − weeklyKeep … t (157 entries).
  'game.history.weeklyKeep': 156,
  // §1 1.3: display year = startCalendarYear + year − 1. The setup's world.startCalendarYear overrides it (§1 1.6).
  'game.startCalendarYear': 2027,
  // §1 1.8 start table (D-1.42). Personal cash is "the rest of the start table" that 1.20 places in this file.
  'game.start.bootstrapper.companyCashUsd': 400000,
  'game.start.bootstrapper.personalCashUsd': 120000,
  // §1 1.11 difficulty multipliers on starting cash (1.25 / 1.0 / 0.85 and 1.1 / 1.0 / 0.9 via data/difficulty.ts).
  'game.startCompanyCashMult': 1.0,
  'game.startPersonalCashMult': 1.0,
  // §1 1.13: parts inventory counts at 60% of book in scoring net worth.
  'game.nw.partsResaleFactor': 0.6,
  // §13 13.10 collation: closed inbox records are dropped this many weeks after they close.
  'game.alerts.inboxRetentionWeeks': 104,
} as const satisfies TuningTable;
