// Shapes and DESIGN-stated ranges of the `events.*` keys (DESIGN §12 12.22). Owned by the §12 package after P1 Wave 0.
import type { z } from 'zod';
import { nonNegInt, posInt } from '../common';

export const EVENTS_TUNING_SCHEMAS: Readonly<Record<string, z.ZodType>> = {
  'events.budgetPerHalf': posInt,
  'events.catastropheEarliestTurn': nonNegInt,
};
