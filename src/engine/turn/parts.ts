// The part table (DESIGN §2.6; P1 contract §1.4, §3; s02 #8, #11): §2's framework parts and every owner folder's
// parts, concatenated and sorted by (step, order). Each of the 17 steps runs its parts in that order, skipping a part
// whose `fromPhase` is later than the game's rules phase, so `--rules p0` runs exactly the P0 parts. The table is
// checked when this module loads (unique ids and slots, steps 0–16, known phases); a test pins it to §2.6 and to each
// section's sub-order. After Wave 0 owners edit only their own folder's parts.ts, never this file.
import { sortedKeysByCodeUnit } from '../core/iter';
import { isRulesPhase, rulesAtLeast } from '../state/rules';
import type { GameState } from '../state/types';
import { CLIMATE_PARTS } from '../systems/climate/parts';
import { COMPANY_PARTS } from '../systems/company/parts';
import { COMPETITORS_PARTS } from '../systems/competitors/parts';
import { EVENTS_PARTS } from '../systems/events/parts';
import { FINANCE_PARTS } from '../systems/finance/parts';
import { FLEET_PARTS } from '../systems/fleet/parts';
import { GOLD_PARTS } from '../systems/gold/parts';
import { HISTORY_PARTS } from '../systems/history/parts';
import { INBOX_PARTS } from '../systems/inbox/parts';
import { INVESTORS_PARTS } from '../systems/investors/parts';
import { KNOWLEDGE_PARTS } from '../systems/knowledge/parts';
import { LAND_PARTS } from '../systems/land/parts';
import { OPS_PARTS } from '../systems/ops/parts';
import { PERMITS_PARTS } from '../systems/permits/parts';
import { STAFF_PARTS } from '../systems/staff/parts';
import { WORLD_PARTS } from '../systems/world/parts';
import { STEP00_PARTS } from './steps/step00Guard';
import { STEP01_PARTS } from './steps/step01Calendar';
import { STEP09_PARTS } from './steps/step09Operations';
import { STEP12_PARTS } from './steps/step12Cleanup';
import { STEP16_PARTS } from './steps/step16WrapUp';
import type { PipelinePart, StepContext } from './types';

export const STEP_COUNT = 17;

/** Every source of parts, by folder ('framework' = §2's own parts in the step files). */
export const PART_SOURCES: Readonly<Record<string, readonly PipelinePart[]>> = {
  framework: [...STEP00_PARTS, ...STEP01_PARTS, ...STEP09_PARTS, ...STEP12_PARTS, ...STEP16_PARTS],
  climate: CLIMATE_PARTS,
  company: COMPANY_PARTS,
  investors: INVESTORS_PARTS,
  history: HISTORY_PARTS,
  world: WORLD_PARTS,
  knowledge: KNOWLEDGE_PARTS,
  land: LAND_PARTS,
  permits: PERMITS_PARTS,
  ops: OPS_PARTS,
  staff: STAFF_PARTS,
  fleet: FLEET_PARTS,
  gold: GOLD_PARTS,
  finance: FINANCE_PARTS,
  events: EVENTS_PARTS,
  competitors: COMPETITORS_PARTS,
  inbox: INBOX_PARTS,
};

export class PartTableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PartTableError';
  }
}

const PART_ID = /^[a-z][a-zA-Z]*\.[a-z][a-zA-Z0-9]*$/;

/** The id's folder prefix must be the part's source folder (so an owner cannot register a part in another's name). */
function checkPart(source: string, p: PipelinePart): void {
  if (!PART_ID.test(p.id)) throw new PartTableError(`part '${p.id}' is not '<folder>.<name>'`);
  if (p.id.slice(0, p.id.indexOf('.')) !== source) {
    throw new PartTableError(`part '${p.id}' is registered by '${source}'`);
  }
  if (!Number.isSafeInteger(p.step) || p.step < 0 || p.step >= STEP_COUNT) {
    throw new PartTableError(`part '${p.id}': step ${p.step} is outside 0–${STEP_COUNT - 1}`);
  }
  if (!Number.isSafeInteger(p.order) || p.order < 1) {
    throw new PartTableError(`part '${p.id}': order ${p.order} is not a positive integer`);
  }
  if (!isRulesPhase(p.fromPhase)) throw new PartTableError(`part '${p.id}': fromPhase ${String(p.fromPhase)}`);
  if (!Number.isSafeInteger(p.section) || p.section < 1 || p.section > 14) {
    throw new PartTableError(`part '${p.id}': section ${p.section}`);
  }
}

/** Validates and sorts a part table by (step, order); throws PartTableError on a duplicate id or slot. */
export function buildPartTable(sources: Readonly<Record<string, readonly PipelinePart[]>>): PipelinePart[] {
  const all: PipelinePart[] = [];
  const ids: Record<string, true> = {};
  const slots: Record<string, string> = {};
  // Sources in code-unit order of their names: the table cannot depend on the order the sources were listed in.
  for (const source of sortedKeysByCodeUnit(sources)) {
    for (const p of sources[source] ?? []) {
      checkPart(source, p);
      if (ids[p.id] === true) throw new PartTableError(`part '${p.id}' is registered twice`);
      const slot = `${p.step}.${p.order}`;
      const taken = slots[slot];
      if (taken !== undefined) throw new PartTableError(`parts '${taken}' and '${p.id}' both claim slot ${slot}`);
      ids[p.id] = true;
      slots[slot] = p.id;
      all.push(p);
    }
  }
  return all.sort((a, b) => a.step - b.step || a.order - b.order);
}

/** The table, sorted by (step, order). */
export const PIPELINE_PARTS: readonly PipelinePart[] = buildPartTable(PART_SOURCES);

const PARTS_BY_STEP: readonly (readonly PipelinePart[])[] = Array.from({ length: STEP_COUNT }, (_, step) =>
  PIPELINE_PARTS.filter((p) => p.step === step),
);

/** One step's parts in run order. */
export function partsOfStep(step: number): readonly PipelinePart[] {
  const parts = PARTS_BY_STEP[step];
  if (parts === undefined) throw new PartTableError(`no step ${step}`);
  return parts;
}

/** The step's parts after the test seam's reordering, which must be a permutation (a dropped part is a bug). */
function orderedParts(step: number, ctx: StepContext): readonly PipelinePart[] {
  const parts = partsOfStep(step);
  const reorder = ctx.seams.orderParts;
  if (reorder === null) return parts;
  const out = reorder(step, parts);
  const same =
    out.length === parts.length && parts.every((p) => out.includes(p)) && out.every((p) => parts.includes(p));
  if (!same) throw new PartTableError(`seam: step ${step}'s reordered parts are not a permutation`);
  return out;
}

/** Runs one step: its parts in order, each only when the game's rules phase is at least the part's `fromPhase`. */
export function runStepParts(step: number, state: GameState, ctx: StepContext): GameState {
  let s = state;
  for (const part of orderedParts(step, ctx)) if (rulesAtLeast(s, part.fromPhase)) s = part.run(s, ctx);
  return s;
}
