// Shapes and DESIGN-stated ranges of the `market.*` keys (DESIGN §10 10.19). Owned by the §10 package after P1 Wave 0.
import type { z } from 'zod';
import { nonNeg, nonNegInt, pos, score } from '../common';

export const MARKET_TUNING_SCHEMAS: Readonly<Record<string, z.ZodType>> = {
  'market.openingSpotUsdPerFineOz': pos,
  'market.openingDieselRackUsdPerGal': pos,
  'market.preHistory.keepWeeks': nonNegInt,
  'market.cb.normal': nonNeg,
  // §1 1.12 reputation thresholds of the local buyer's adjustments (S10-11).
  'market.localBuyer.repHighMin': score,
  'market.localBuyer.repLowMax': score,
};
