// newGame's init parts (DESIGN §2.2, D-2.13; P1 contract §1.5): the week-1 initializations that no pipeline runs for
// year 1, N1 … N11 in a fixed order because ids mint in this order (`lst` goes §5 then §9, D-9.43). Each owner folder
// exports its `<FOLDER>_INIT_PARTS`; the framework adds N10 (`fixture.apply`). newGame runs every part whose
// `fromPhase` is at most the game's rules phase, in `order`, on the new game's shell, so `--rules p0` runs exactly the
// P0 initialization (N1 world, N9 opening books, N11 history).
import { sortedKeysByCodeUnit } from '../core/iter';
import { CLIMATE_INIT_PARTS } from '../systems/climate/parts';
import { COMPANY_INIT_PARTS } from '../systems/company/parts';
import { FLEET_INIT_PARTS } from '../systems/fleet/parts';
import { GOLD_INIT_PARTS } from '../systems/gold/parts';
import { HISTORY_INIT_PARTS } from '../systems/history/parts';
import { KNOWLEDGE_INIT_PARTS } from '../systems/knowledge/parts';
import { LAND_INIT_PARTS } from '../systems/land/parts';
import { STAFF_INIT_PARTS } from '../systems/staff/parts';
import { WORLD_INIT_PARTS } from '../systems/world/parts';
import { applyFixtureInit } from './fixtureApply';
import { initPart } from './partKit';
import { isRulesPhase } from './rules';
import type { InitPart } from './types';

/** N10 (§2): a fixture game's builders. */
const FRAMEWORK_INIT_PARTS: readonly InitPart[] = [
  initPart({ id: 'fixture.apply', order: 10, section: 2, fromPhase: 1 }, applyFixtureInit),
];

/** Every source of init parts, by folder ('fixture' = the framework's N10). */
export const INIT_PART_SOURCES: Readonly<Record<string, readonly InitPart[]>> = {
  world: WORLD_INIT_PARTS,
  climate: CLIMATE_INIT_PARTS,
  company: COMPANY_INIT_PARTS,
  land: LAND_INIT_PARTS,
  fleet: FLEET_INIT_PARTS,
  gold: GOLD_INIT_PARTS,
  staff: STAFF_INIT_PARTS,
  knowledge: KNOWLEDGE_INIT_PARTS,
  fixture: FRAMEWORK_INIT_PARTS,
  history: HISTORY_INIT_PARTS,
};

export class InitTableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InitTableError';
  }
}

/** The init table sorted by `order`; refuses duplicate ids or orders, foreign ids and unknown phases. */
export function buildInitTable(sources: Readonly<Record<string, readonly InitPart[]>>): InitPart[] {
  const all: InitPart[] = [];
  const ids: Record<string, true> = {};
  const orders: Record<string, string> = {};
  for (const source of sortedKeysByCodeUnit(sources)) {
    for (const p of sources[source] ?? []) {
      if (p.id.split('.')[0] !== source) throw new InitTableError(`${p.id} is registered by '${source}'`);
      if (ids[p.id] === true) throw new InitTableError(`${p.id} is registered twice`);
      const key = String(p.order);
      const taken = orders[key];
      if (taken !== undefined) throw new InitTableError(`${p.id} and ${taken} share order ${key}`);
      if (!(p.order > 0) || !Number.isFinite(p.order)) throw new InitTableError(`${p.id}: order ${p.order}`);
      if (!isRulesPhase(p.fromPhase)) throw new InitTableError(`${p.id}: fromPhase ${String(p.fromPhase)}`);
      ids[p.id] = true;
      orders[key] = p.id;
      all.push(p);
    }
  }
  return all.sort((a, b) => a.order - b.order);
}

export const INIT_PARTS: readonly InitPart[] = buildInitTable(INIT_PART_SOURCES);
