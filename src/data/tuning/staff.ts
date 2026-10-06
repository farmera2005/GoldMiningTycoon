// `staff.*` tuning constants (DESIGN §8 8.18, whose keys are written there without the prefix). Keys must start with
// 'staff.'. P1 Wave 0 (contracts-data) wrote the keys read outside §8 (§1's owner skills, §7's crew rules, bots and
// fixtures), the difficulty-scaled keys and the hook bases (P1 contract §9.1); §8 adds the rest of 8.18.
import type { TuningTable } from './types';

export const staffTuning = {
  // ---- The owner as a worker (§1 1.7, 1.9; values are §1's, keys live here; §8's ownerSkill reads them, S08-19)
  // Operator background 85, every other background 40; a geologist owner is geology.ownerGeologistSkill (§4).
  'staff.ownerOpsSkillByBackground': { operator: 85, default: 40 },
  'staff.ownerMechanicSkill': 85,
  'staff.ownerShopHoursPerWeek': 50,
  'staff.ownerInspectionsPerWeek': 2,
  'staff.ownerLandSpecialistSkill': 80,
  'staff.ownerSafety': 60,

  // ---- Supervision and camp crew rules (8.5, 8.12; owner rulings 2026-10-05, D-8.48, D-8.49)
  // A third plant line needs a second foreman or runs under a line lead hand (P3).
  'staff.foremanMaxLines': 2,
  // Employees on the claim (owner excluded) that may run one line, one shift with no foreman (§7 F = 0.92).
  'staff.smallCrewMaxNoForeman': 3,
  // × injury hazard (M_sup) and §12 site incidents for a crew with no foreman (P2 with injuries).
  'staff.noForemanIncidentMult': 1.15,
  // R4 §13: one cook per 8–15 people; the bots' minimum crew includes ceil(onSite / crewPerCook) cooks (S08-21).
  'staff.crewPerCook': 12,

  // ---- Difficulty-scaled (§1 1.11 via data/difficulty.ts) and hook bases (§12 12.3: staff.poolSizeMult,
  // staff.wageAskMult and staff.quitHazardMult are read through effective(), base = the resolved value)
  'staff.poolSizeMult': 1.0,
  'staff.wageAskMult': 1.0,
  'staff.quitHazardMult': 1.0,
  // × the résumé bias on shown attributes (staff.resume.bias).
  'staff.resumeBiasMult': 1.0,

  // ---- Company safety record (8.10) and absence (8.9). BALANCE §2.1 fixtures set absence.base 0 (S08-21).
  'staff.safetyRecord.start': 50,
  'staff.absence.base': 0.02,
} as const satisfies TuningTable;
