// `market.*` tuning constants (DESIGN §10 10.19). Keys must start with 'market.'.
// P0 needs only the opening constants that fill the flat pre-history and the history snapshots (§10 10.5: "P1 skips
// all of this: the history is a flat line"); the price and macro model keys arrive with §10 in P5.
import type { TuningTable } from './types';

export const marketTuning = {
  // Opening spot, also §10's referenceSpot; the setup's world.openingSpotUsdPerFineOz overrides it (§1 1.6).
  'market.openingSpotUsdPerFineOz': 4200,
  // Neutral macro at turn 0 (§10 10.4–10.5): base rate 4% and trend inflation 3% (so the real rate is 1%), central-bank
  // buying in its normal state, the quiet geopolitical baseline, neutral equity mood, the diesel rack on its anchor.
  'market.openingBaseRate': 0.04,
  'market.cpiTrendAnnual': 0.03,
  'market.cb.normal': 650,
  'market.geo.baseline': 30,
  'market.eq.mean': 0.2,
  'market.openingDieselRackUsdPerGal': 3.6,
  // §10 10.5: weeks of pre-history kept as visible history at turns −156…−1.
  'market.preHistory.keepWeeks': 156,
} as const satisfies TuningTable;
