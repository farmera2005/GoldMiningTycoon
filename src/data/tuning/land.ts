// `land.*` tuning constants (DESIGN §5 5.19). Keys must start with 'land.'. P1 Wave 0 (contracts-data) wrote the
// difficulty-scaled keys and the keys read outside §5 (P1 contract §9.1); §5 adds the rest of 5.19.
import type { TuningTable } from './types';

export const landTuning = {
  // ---- Difficulty-scaled (§1 1.11 via data/difficulty.ts)
  // Seller asking markup over the claimed value.
  'land.askMarkup': 0.3,
  // Lease default cure; runs from §6's miss at dueTurn + 1.
  'land.leaseCureWeeks': 4,

  // ---- Read outside §5
  // Quick sale at this share of the valuation, from P1 (D-5.50).
  'land.quickSaleFrac': 0.6,
  // × cpiIndex; added to §4's planning costs in the valuation (D-5.23, D-5.47).
  'land.valCapitalChargePerBcy': 4.0,
  // §1 1.7 Landman stub, P1–P4 only: asks × 0.925 and royalty offers 1 point lower (floor 0.01).
  'land.p1LandmanPriceMult': 0.925,
  'land.p1LandmanRoyaltyPointsOff': 0.01,
} as const satisfies TuningTable;
