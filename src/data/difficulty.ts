// Per-difficulty tuning entries (DESIGN §2.10; §1 1.11 is the table, D-1.44). A key maps to one entry per
// difficulty: { mul } scales a numeric base, { set } replaces it with any tuning value. Only §1 1.11 keys appear here,
// and every 1.11 row whose key exists in this build's tuning is here (tests/data/difficulty.test.ts checks both ways
// against DESIGN.md). Standard always resolves to the base value, so a standard game's tuning and tuningHash equal the
// base tables'. Rows of keys whose owners ship later join this table with their keys.
import { geologyTuning } from './tuning/geology';
import type { TuningValue } from './tuning/types';

export type Difficulty = 'easy' | 'standard' | 'hard';
export type DiffEntry = { readonly mul: number } | { readonly set: TuningValue };
export type DifficultyTable = { readonly [key: string]: { readonly [D in Difficulty]: DiffEntry } };

type ProbabilityTable = { readonly [row: string]: { readonly [col: string]: number } };

/**
 * A probability table scaled cell by cell and capped at 1. §1 1.11 gives `geology.seller.tellDetect` a multiplier
 * (× 1.15 / × 1.00 / × 0.85), but the key is a table, and { mul } scales only a numeric base, so the scaled table is
 * written as { set }. The cap keeps a probability a probability (0.9 × 1.15 would be 1.035).
 */
function scaledProbabilities(table: ProbabilityTable, mult: number): ProbabilityTable {
  const out: Record<string, Record<string, number>> = {};
  // The base table's own key order (a literal), so a scaled table reads like the base in the tuning viewer.
  for (const row of Object.keys(table)) {
    const cells = table[row] ?? {};
    const scaled: Record<string, number> = {};
    for (const col of Object.keys(cells)) scaled[col] = Math.min(1, (cells[col] ?? 0) * mult);
    out[row] = scaled;
  }
  return out;
}

const TELL_DETECT: ProbabilityTable = geologyTuning['geology.seller.tellDetect'];

export const difficultyTable = {
  // ---- Information honesty (§3 3.10)
  'geology.seller.honestyMix': {
    easy: { set: { accurate: 0.55, optimistic: 0.3, cherryPicked: 0.12, fraudulent: 0.03 } },
    standard: { set: { accurate: 0.35, optimistic: 0.35, cherryPicked: 0.22, fraudulent: 0.08 } },
    hard: { set: { accurate: 0.2, optimistic: 0.35, cherryPicked: 0.3, fraudulent: 0.15 } },
  },
  'geology.seller.tellDetect': {
    easy: { set: scaledProbabilities(TELL_DETECT, 1.15) },
    standard: { set: TELL_DETECT },
    hard: { set: scaledProbabilities(TELL_DETECT, 0.85) },
  },
  // ---- Start and scoring (§1 1.8, D-1.43, D-1.64): the keys are multipliers with base 1.0, set to 1.11's values.
  'game.startCompanyCashMult': { easy: { set: 1.25 }, standard: { set: 1 }, hard: { set: 0.85 } },
  'game.startPersonalCashMult': { easy: { set: 1.1 }, standard: { set: 1 }, hard: { set: 0.9 } },
} as const satisfies DifficultyTable;
