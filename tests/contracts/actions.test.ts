// The P1 action catalog (P1 contract §5): every row registered once, under its owner's section, with §5.2's reveals and
// commits flags and `fromPhase` 1; every error code a row can return is in its folder's code list (or the framework's)
// and every warning in its folder's warning list.
import { describe, expect, it } from 'vitest';
import { FRAMEWORK_ERROR_CODES, registeredActionTypes } from '../../src/engine';
import { getActionDef } from '../../src/engine/actions/registry';
import { COMPANY_ERROR_CODES, COMPANY_WARNING_CODES } from '../../src/engine/systems/company/actions';
import { FINANCE_ERROR_CODES, FINANCE_WARNING_CODES } from '../../src/engine/systems/finance/actions';
import { FLEET_ERROR_CODES, FLEET_WARNING_CODES } from '../../src/engine/systems/fleet/actions';
import { GOLD_ERROR_CODES, GOLD_WARNING_CODES } from '../../src/engine/systems/gold/actions';
import { KNOWLEDGE_ERROR_CODES, KNOWLEDGE_WARNING_CODES } from '../../src/engine/systems/knowledge/actions';
import { LAND_ERROR_CODES, LAND_WARNING_CODES } from '../../src/engine/systems/land/actions';
import { OPS_ERROR_CODES, OPS_WARNING_CODES } from '../../src/engine/systems/ops/actions';
import { PERMITS_ERROR_CODES, PERMITS_WARNING_CODES } from '../../src/engine/systems/permits/actions';
import { STAFF_ERROR_CODES, STAFF_WARNING_CODES } from '../../src/engine/systems/staff/actions';
import { WORLD_ERROR_CODES, WORLD_WARNING_CODES } from '../../src/engine/systems/world/actions';
import { CONTRACT_ACTIONS } from './actionTable';

/** Each action family's folder: its error and warning code lists. */
const FAMILY: Readonly<Record<string, { errors: readonly string[]; warnings: readonly string[] }>> = {
  owner: { errors: COMPANY_ERROR_CODES, warnings: COMPANY_WARNING_CODES },
  community: { errors: COMPANY_ERROR_CODES, warnings: COMPANY_WARNING_CODES },
  game: { errors: COMPANY_ERROR_CODES, warnings: COMPANY_WARNING_CODES },
  world: { errors: WORLD_ERROR_CODES, warnings: WORLD_WARNING_CODES },
  prospect: { errors: KNOWLEDGE_ERROR_CODES, warnings: KNOWLEDGE_WARNING_CODES },
  land: { errors: LAND_ERROR_CODES, warnings: LAND_WARNING_CODES },
  permits: { errors: PERMITS_ERROR_CODES, warnings: PERMITS_WARNING_CODES },
  ops: { errors: OPS_ERROR_CODES, warnings: OPS_WARNING_CODES },
  staff: { errors: STAFF_ERROR_CODES, warnings: STAFF_WARNING_CODES },
  fleet: { errors: FLEET_ERROR_CODES, warnings: FLEET_WARNING_CODES },
  gold: { errors: GOLD_ERROR_CODES, warnings: GOLD_WARNING_CODES },
  finance: { errors: FINANCE_ERROR_CODES, warnings: FINANCE_WARNING_CODES },
};

const familyOf = (type: string): string => type.split('/')[0] ?? '';

describe('the P1 action catalog (P1 contract §5)', () => {
  it('registers every §5.2 row exactly once', () => {
    const types = registeredActionTypes();
    for (const row of CONTRACT_ACTIONS)
      expect(
        types.filter((t) => t === row.type),
        row.type,
      ).toHaveLength(1);
    expect(new Set(CONTRACT_ACTIONS.map((r) => r.type)).size).toBe(CONTRACT_ACTIONS.length);
  });

  it('gives each row its owner section, flags and phase', () => {
    for (const row of CONTRACT_ACTIONS) {
      const def = getActionDef(row.type);
      expect(def, row.type).toBeDefined();
      expect(
        { section: def?.ownerSection, reveals: def?.reveals, commits: def?.commits, fromPhase: def?.fromPhase },
        row.type,
      ).toEqual({ section: row.section, reveals: row.reveals, commits: row.commits, fromPhase: 1 });
    }
  });

  it('lists every row’s error and warning codes in its folder (or the framework’s)', () => {
    const framework: readonly string[] = FRAMEWORK_ERROR_CODES;
    for (const row of CONTRACT_ACTIONS) {
      const folder = FAMILY[familyOf(row.type)];
      expect(folder, row.type).toBeDefined();
      const errors = new Set([...(folder?.errors ?? []), ...framework]);
      const warnings = new Set(folder?.warnings ?? []);
      expect(
        row.errors.filter((c) => !errors.has(c)),
        `${row.type} errors`,
      ).toEqual([]);
      expect(
        row.warnings.filter((c) => !warnings.has(c)),
        `${row.type} warnings`,
      ).toEqual([]);
    }
  });

  it('writes every code SCREAMING_SNAKE', () => {
    for (const folder of Object.values(FAMILY)) {
      for (const code of [...folder.errors, ...folder.warnings]) expect(code).toMatch(/^[A-Z][A-Z0-9_]*$/);
    }
  });
});
