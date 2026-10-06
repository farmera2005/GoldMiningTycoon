// Effect hooks (P1 contract §7, S12-5): every owner publishes its hook keys in systems/<folder>/hooks.ts; the keys sit in
// the owner's namespace and no two owners publish one key; the registry in data/events/hooks.ts is the union of the
// owners' lists, both ways, once its rows are written (the parallel data package writes them).
import { describe, expect, it } from 'vitest';
import { hookRegistry } from '../../src/data/events/hooks';
import { CLIMATE_HOOK_KEYS } from '../../src/engine/systems/climate/hooks';
import { COMPANY_HOOK_KEYS } from '../../src/engine/systems/company/hooks';
import { COMPETITORS_HOOK_KEYS } from '../../src/engine/systems/competitors/hooks';
import { EVENTS_HOOK_KEYS } from '../../src/engine/systems/events/hooks';
import { FINANCE_HOOK_KEYS } from '../../src/engine/systems/finance/hooks';
import { FLEET_HOOK_KEYS } from '../../src/engine/systems/fleet/hooks';
import { GOLD_HOOK_KEYS } from '../../src/engine/systems/gold/hooks';
import { INBOX_HOOK_KEYS } from '../../src/engine/systems/inbox/hooks';
import { INVESTORS_HOOK_KEYS } from '../../src/engine/systems/investors/hooks';
import { KNOWLEDGE_HOOK_KEYS } from '../../src/engine/systems/knowledge/hooks';
import { LAND_HOOK_KEYS } from '../../src/engine/systems/land/hooks';
import { OPS_HOOK_KEYS } from '../../src/engine/systems/ops/hooks';
import { PERMITS_HOOK_KEYS } from '../../src/engine/systems/permits/hooks';
import { STAFF_HOOK_KEYS } from '../../src/engine/systems/staff/hooks';
import { WORLD_HOOK_KEYS } from '../../src/engine/systems/world/hooks';

/** Each owner's published keys and the namespaces they may use. */
const OWNERS: Readonly<Record<string, { keys: readonly string[]; section: number; prefixes: readonly string[] }>> = {
  climate: { keys: CLIMATE_HOOK_KEYS, section: 1, prefixes: ['season.', 'access.'] },
  company: { keys: COMPANY_HOOK_KEYS, section: 1, prefixes: ['game.'] },
  investors: { keys: INVESTORS_HOOK_KEYS, section: 1, prefixes: ['game.'] },
  world: { keys: WORLD_HOOK_KEYS, section: 3, prefixes: ['geology.'] },
  knowledge: { keys: KNOWLEDGE_HOOK_KEYS, section: 4, prefixes: ['prospect.'] },
  land: { keys: LAND_HOOK_KEYS, section: 5, prefixes: ['land.'] },
  permits: { keys: PERMITS_HOOK_KEYS, section: 6, prefixes: ['permits.'] },
  ops: { keys: OPS_HOOK_KEYS, section: 7, prefixes: ['ops.'] },
  staff: { keys: STAFF_HOOK_KEYS, section: 8, prefixes: ['staff.'] },
  fleet: { keys: FLEET_HOOK_KEYS, section: 9, prefixes: ['fleet.'] },
  gold: { keys: GOLD_HOOK_KEYS, section: 10, prefixes: ['market.'] },
  finance: { keys: FINANCE_HOOK_KEYS, section: 11, prefixes: ['finance.'] },
  events: { keys: EVENTS_HOOK_KEYS, section: 12, prefixes: ['events.'] },
  competitors: { keys: COMPETITORS_HOOK_KEYS, section: 12, prefixes: ['ai.'] },
  inbox: { keys: INBOX_HOOK_KEYS, section: 13, prefixes: [] },
};

const union = Object.values(OWNERS).flatMap((o) => o.keys);

describe('owners’ hook lists (S12-5)', () => {
  it('keep every key in its owner’s namespace, once', () => {
    for (const [folder, o] of Object.entries(OWNERS)) {
      for (const key of o.keys)
        expect(
          o.prefixes.some((p) => key.startsWith(p)),
          `${folder}: ${key}`,
        ).toBe(true);
    }
    expect(new Set(union).size).toBe(union.length);
  });

  it.runIf(hookRegistry.length > 0)('equal the registry’s keys, both ways, with matching owners', () => {
    expect([...union].sort()).toEqual(hookRegistry.map((h) => h.key).sort());
    for (const [folder, o] of Object.entries(OWNERS)) {
      for (const key of o.keys) {
        expect(hookRegistry.find((h) => h.key === key)?.ownerSection, `${folder}: ${key}`).toBe(o.section);
      }
    }
  });
});
