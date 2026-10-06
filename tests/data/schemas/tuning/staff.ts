// Shapes and DESIGN-stated ranges of the `staff.*` keys (DESIGN §8 8.18). Owned by the §8 package after P1 Wave 0.
import { z } from 'zod';
import { nonNeg, nonNegInt, posInt, prob, score } from '../common';

/** §1 1.7 owner backgrounds (the simulator's `none` included). */
export const BACKGROUNDS = ['none', 'operator', 'mechanic', 'geologist', 'banker', 'landman'] as const;

const skill = z.number().int().min(0).max(100);

export const STAFF_TUNING_SCHEMAS: Readonly<Record<string, z.ZodType>> = {
  // The owner's operating skill by background, with the value every other background takes.
  'staff.ownerOpsSkillByBackground': z
    .object({ default: skill })
    .catchall(skill)
    .refine((o) => Object.keys(o).every((k) => k === 'default' || (BACKGROUNDS as readonly string[]).includes(k)), {
      message: 'keys are backgrounds or default',
    }),
  'staff.ownerMechanicSkill': skill,
  'staff.ownerShopHoursPerWeek': nonNeg,
  'staff.ownerInspectionsPerWeek': nonNegInt,
  'staff.ownerLandSpecialistSkill': skill,
  'staff.ownerSafety': skill,
  'staff.foremanMaxLines': posInt,
  'staff.smallCrewMaxNoForeman': posInt,
  'staff.crewPerCook': posInt,
  'staff.safetyRecord.start': score,
  'staff.absence.base': prob,
};
