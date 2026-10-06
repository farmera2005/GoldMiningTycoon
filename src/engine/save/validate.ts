// Structural validation of a loaded state (DESIGN §2.9 D-2.43; P1 contract §1.7): load → migrate forward → validate.
// It checks the §2.5 frame and the invariants the engine relies on (tuning hash, clock, id counters), then every slice:
// first the generic rule that each top-level `…Ids` array equals the sorted key set of its Record (`claimIds` ↔
// `claims`, `buyerIds` ↔ `buyers`, …), then the slice owner's own check from its folder's validate.ts (the per-slice
// validator registry below). Returns the first problem as text (reported as SAVE_CORRUPT), or null.
import { hashValue } from '../core/hash';
import { isIdPrefix } from '../core/ids';
import { idsMatchRecord, isSortedIds, sortedKeysByCodeUnit } from '../core/iter';
import { turnToYearWeek } from '../core/calendar';
import { isRulesPhase } from '../state/rules';
import { CURRENT_SCHEMA_VERSION } from '../state/schema';
import { SLICE_KEYS } from '../state/types';
import { climateSliceProblem } from '../systems/climate/validate';
import { companySliceProblem } from '../systems/company/validate';
import { competitorsSliceProblem } from '../systems/competitors/validate';
import { eventsSliceProblem } from '../systems/events/validate';
import { financeSliceProblem } from '../systems/finance/validate';
import { fleetSliceProblem } from '../systems/fleet/validate';
import { goldSliceProblem } from '../systems/gold/validate';
import { historySliceProblem } from '../systems/history/validate';
import { inboxSliceProblem } from '../systems/inbox/validate';
import { knowledgeSliceProblem } from '../systems/knowledge/validate';
import { landSliceProblem } from '../systems/land/validate';
import { opsSliceProblem } from '../systems/ops/validate';
import { permitsSliceProblem } from '../systems/permits/validate';
import { staffSliceProblem } from '../systems/staff/validate';
import { worldSliceProblem } from '../systems/world/validate';

type Rec = Record<string, unknown>;
type SliceKey = (typeof SLICE_KEYS)[number];

const isRec = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v);

/** Each slice owner's own check (its folder's validate.ts), keyed by slice. */
export const SLICE_VALIDATORS: Readonly<Record<SliceKey, (slice: Readonly<Rec>) => string | null>> = {
  climate: climateSliceProblem,
  company: companySliceProblem,
  world: worldSliceProblem,
  knowledge: knowledgeSliceProblem,
  land: landSliceProblem,
  permits: permitsSliceProblem,
  ops: opsSliceProblem,
  staff: staffSliceProblem,
  fleet: fleetSliceProblem,
  gold: goldSliceProblem,
  finance: financeSliceProblem,
  events: eventsSliceProblem,
  competitors: competitorsSliceProblem,
  inbox: inboxSliceProblem,
  history: historySliceProblem,
};

function metaProblem(meta: unknown): string | null {
  if (!isRec(meta)) return 'meta is missing';
  if (typeof meta['seed'] !== 'string' || meta['seed'] === '') return 'meta.seed';
  if (!isRec(meta['setup']) || typeof meta['setup']['companyName'] !== 'string') return 'meta.setup';
  if (!isRec(meta['tuning'])) return 'meta.tuning';
  if (typeof meta['tuningHash'] !== 'string' || meta['tuningHash'] !== hashValue(meta['tuning'])) {
    return 'meta.tuningHash does not match meta.tuning';
  }
  if (typeof meta['rulesVersion'] !== 'string') return 'meta.rulesVersion';
  if (!isRulesPhase(meta['rulesPhase'])) return 'meta.rulesPhase';
  return null;
}

function clockProblem(clock: unknown): string | null {
  if (!isRec(clock)) return 'clock is missing';
  const { turn, year, week, actionSeq, phase } = clock;
  if (!isInt(turn) || turn < 0) return 'clock.turn';
  const derived = turnToYearWeek(turn);
  if (year !== derived.year || week !== derived.week) return 'clock.year/week do not match clock.turn';
  if (!isInt(actionSeq) || actionSeq < 0) return 'clock.actionSeq';
  if (!isRec(phase)) return 'clock.phase';
  return null;
}

function idsProblem(ids: unknown): string | null {
  if (!isRec(ids)) return 'ids is missing';
  for (const prefix of sortedKeysByCodeUnit(ids)) {
    if (!isIdPrefix(prefix)) return `ids.${prefix} is not a registered prefix`;
    const n = ids[prefix];
    if (!isInt(n) || n < 0) return `ids.${prefix}`;
  }
  return null;
}

/**
 * The generic mirror rule (§2.5): for every top-level key `xIds` holding an array, when the slice also has a Record
 * `xs` or `x`, the array is the Record's key set in ascending id order. Arrays with no sibling Record (an ordered
 * subset such as `familyRunClaimIds`) are the owner's to check.
 */
export function idsMirrorProblem(name: string, slice: Readonly<Rec>): string | null {
  for (const key of sortedKeysByCodeUnit(slice)) {
    if (!key.endsWith('Ids') || key.length === 3) continue;
    const ids = slice[key];
    if (!Array.isArray(ids)) continue;
    const stem = key.slice(0, -3);
    const rec = isRec(slice[`${stem}s`]) ? slice[`${stem}s`] : slice[stem];
    if (!isRec(rec)) continue;
    if (!ids.every((x) => typeof x === 'string')) return `${name}.${key} holds a non-string id`;
    if (!isSortedIds(ids as string[]) || !idsMatchRecord(ids as string[], rec)) return `${name}.${key} ≠ its Record`;
  }
  return null;
}

/** The first structural problem of a state that should be at `schemaVersion`, or null. */
export function stateProblem(state: unknown, schemaVersion: number): string | null {
  if (!isRec(state)) return 'state is not an object';
  if (state['schemaVersion'] !== schemaVersion) return `state.schemaVersion is not ${schemaVersion}`;
  const problem = metaProblem(state['meta']) ?? clockProblem(state['clock']) ?? idsProblem(state['ids']);
  if (problem !== null) return problem;
  for (const key of SLICE_KEYS) if (!isRec(state[key])) return `${key} slice is missing`;
  if (state['hardRock'] !== undefined && !isRec(state['hardRock'])) return 'hardRock slice';
  const company = state['company'] as Rec;
  if (!['active', 'won', 'lost', 'retired'].includes(company['runStatus'] as string)) return 'company.runStatus';
  // The owners' slice checks describe the current schema; a codec reading an older schema (a P0 build's) applies only
  // the generic rules above.
  const ownersApply = schemaVersion === CURRENT_SCHEMA_VERSION;
  for (const key of SLICE_KEYS) {
    const slice = state[key] as Rec;
    const p = idsMirrorProblem(key, slice) ?? (ownersApply ? SLICE_VALIDATORS[key](slice) : null);
    if (p !== null) return p;
  }
  return null;
}
