// ownerSkill (DESIGN §8.12, §1 1.7; S08-19; P1 contract §4.8, §0.6 item 8): each background gives one edge. The staff
// keys arrive with the parallel data package, so the test patches DESIGN's values into the game's resolved tuning.
import { describe, expect, it } from 'vitest';
import { produceState } from '../../state/immutability';
import { newGame } from '../../state/newGame';
import { defaultNewGameSetup, type OwnerBackground } from '../../state/setup';
import type { GameState } from '../../state/types';
import { ownerSkill, type OwnerSkillRole } from './owner';

const BASE = newGame(defaultNewGameSetup({ companyName: 'Owner Skill Test' }), 'owner-skill');
const KEYS = {
  'staff.ownerOpsSkillByBackground': { operator: 85, default: 40 },
  'staff.ownerMechanicSkill': 85,
  'staff.ownerLandSpecialistSkill': 80,
};

const as = (background: OwnerBackground): GameState =>
  produceState(BASE, (d) => {
    d.company.background = background;
    for (const [k, v] of Object.entries(KEYS)) (d.meta.tuning as Record<string, unknown>)[k] = v;
  });

const ROLES: readonly OwnerSkillRole[] = ['ops', 'foreman', 'mechanic', 'geologist', 'landSpecialist'];
const skills = (background: OwnerBackground) => ROLES.map((r) => ownerSkill(as(background), r));

describe('ownerSkill (§8.12)', () => {
  it('gives each background exactly its edge', () => {
    const geologist = BASE.meta.tuning['geology.ownerGeologistSkill'];
    expect(skills('operator')).toEqual([85, 85, 0, 0, 0]);
    expect(skills('mechanic')).toEqual([40, 40, 85, 0, 0]);
    expect(skills('geologist')).toEqual([40, 40, 0, geologist, 0]);
    expect(skills('landman')).toEqual([40, 40, 0, 0, 80]);
    expect(skills('banker')).toEqual([40, 40, 0, 0, 0]);
    expect(skills('none')).toEqual([40, 40, 0, 0, 0]);
  });
});
