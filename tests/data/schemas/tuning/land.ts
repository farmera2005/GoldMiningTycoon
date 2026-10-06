// Shapes and DESIGN-stated ranges of the `land.*` keys (DESIGN §5 5.19). Owned by the §5 package after P1 Wave 0.
import type { z } from 'zod';
import { nonNeg, prob } from '../common';

export const LAND_TUNING_SCHEMAS: Readonly<Record<string, z.ZodType>> = {
  'land.askMarkup': prob,
  'land.valCapitalChargePerBcy': nonNeg,
  'land.p1LandmanRoyaltyPointsOff': prob,
};
