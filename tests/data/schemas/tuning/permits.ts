// Shapes and DESIGN-stated ranges of the `permits.*` keys (DESIGN §6 6.19). Owned by the §6 obligations package after
// P1 Wave 0. Fee keys take the naming rules (…Usd non-negative, …Weeks non-negative integers).
import type { z } from 'zod';
import { pos } from '../common';

export const PERMITS_TUNING_SCHEMAS: Readonly<Record<string, z.ZodType>> = {
  'permits.fed.unitAcres': pos,
  'permits.noticeMaxAcres': pos,
};
