// The owner as a professional (DESIGN §8.12 "Owner as pseudo-employee", §1 1.7; D-8.67, S08-19; P1 contract §4.8, §0.6
// item 8). One implementation, re-exported by §1. Each background gives exactly one edge: an operator works the
// foreman and operator roles at `staff.ownerOpsSkillByBackground.operator` (85), every other owner at its `default`
// (40); a mechanic is a skill-85 mechanic; a geologist is §4's `geology.ownerGeologistSkill` (75); a landman is a
// skill-80 land specialist. An owner without the edge has no skill in that role (0). Owner and hire do not stack: the
// callers use the higher skill.
import { contractTuningNumber, contractTuningValue } from '../../state/partKit';
import { tuningNumber } from '../../state/tuning';
import type { GameState } from '../../state/types';

export type OwnerSkillRole = 'ops' | 'foreman' | 'mechanic' | 'geologist' | 'landSpecialist';

export class OwnerSkillError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'OwnerSkillError';
  }
}

/** `staff.ownerOpsSkillByBackground`: { operator, default } (contract §9.1). */
function opsSkill(state: GameState): number {
  const table = contractTuningValue(state.meta.tuning, 'staff.ownerOpsSkillByBackground');
  if (typeof table !== 'object' || table === null || Array.isArray(table)) {
    throw new OwnerSkillError('staff.ownerOpsSkillByBackground is not a table');
  }
  const row = table as Readonly<Record<string, unknown>>;
  const key = state.company.background === 'operator' ? 'operator' : 'default';
  const v = row[key];
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new OwnerSkillError(`staff.ownerOpsSkillByBackground.${key}`);
  return v;
}

/** The owner's skill in a role (0–100); 0 where the owner has no edge in it. */
export function ownerSkill(state: GameState, role: OwnerSkillRole): number {
  const background = state.company.background;
  switch (role) {
    case 'ops':
    case 'foreman':
      return opsSkill(state);
    case 'mechanic':
      return background === 'mechanic' ? contractTuningNumber(state.meta.tuning, 'staff.ownerMechanicSkill') : 0;
    case 'geologist':
      return background === 'geologist' ? tuningNumber(state.meta.tuning, 'geology.ownerGeologistSkill') : 0;
    case 'landSpecialist':
      return background === 'landman' ? contractTuningNumber(state.meta.tuning, 'staff.ownerLandSpecialistSkill') : 0;
  }
}
