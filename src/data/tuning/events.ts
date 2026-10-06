// `events.*` tuning constants (DESIGN §12 12.22). Keys must start with 'events.'. P1 ships the §12 framework with empty
// event tables; P1 Wave 0 (contracts-data) wrote the difficulty-scaled keys (§1 1.11; P1 contract §9.1), and §12 adds
// the rest of 12.22 with its catalog.
import type { TuningTable } from './types';

export const eventsTuning = {
  // ---- Difficulty-scaled (§1 1.11 via data/difficulty.ts)
  'events.frequencyMult': 1.0,
  // Tilt base of the severity draw.
  'events.severityMult': 1.0,
  // Points budget per half-year; binds only in clusters (≈ 6 expected per half at the reference operation).
  'events.budgetPerHalf': 24,
  'events.catastropheEarliestTurn': 26,
  // × exogenous negative-event odds at distress ≥ 3, or in a reorganization case before confirmation.
  'events.distressMercyMult': 0.6,
} as const satisfies TuningTable;
