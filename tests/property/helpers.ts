// Shared helpers for the engine property tests (DESIGN §2.14). Property runs use fixed fast-check seeds so a failure
// reproduces exactly; fast-check prints the seed and path of a counterexample.
import fc from 'fast-check';
import {
  advanceWeek,
  applyAction,
  defaultNewGameSetup,
  hashState,
  newGame,
  type GameState,
  type WeekReport,
} from '../../src/engine';
import { asAction, type TestAction } from '../../src/engine/actions/testActions';

/** fast-check parameters: a fixed seed per property (recorded here, printed on failure). */
export function fcParams(seed: number, numRuns: number): { seed: number; numRuns: number; endOnFailure: boolean } {
  return { seed, numRuns, endOnFailure: true };
}

export const P0_SETUP = defaultNewGameSetup({ companyName: 'Property Placers' });

/** Per-test timeout for properties that build worlds (§3 generation may take ~1.5 s per newGame, §3 3.18). */
export const WORLD_TIMEOUT_MS = 180_000;

/**
 * World generation dominates newGame's cost, so properties draw seeds from a small pool and reuse each start state:
 * newGame is deterministic (checked on fresh builds in determinism.test.ts) and states are immutable.
 */
export const SEED_POOL = ['p0-a', 'p0-b', 'p0-c', 'p0-d'] as const;
export const seedArb: fc.Arbitrary<string> = fc.constantFrom(...SEED_POOL);
const starts: Record<string, GameState> = {};

export function newP0(seed: string): GameState {
  starts[seed] ??= newGame(P0_SETUP, seed);
  return starts[seed];
}

/** Test actions a random player might take; the arbitrary never produces a blocking decision. */
export const testActionArb: fc.Arbitrary<TestAction> = fc.oneof(
  fc
    .integer({ min: -2_000_000, max: 2_000_000 })
    .filter((n) => n !== 0)
    .map((cents): TestAction => ({ type: 'test/transfer', cents })),
  fc.integer({ min: 0, max: 4 }).map((n): TestAction => ({ type: 'test/draw', n })),
  fc.constant<TestAction>({ type: 'test/reveal' }),
  fc.constant<TestAction>({ type: 'test/commit' }),
  fc
    .record({ deadlineInWeeks: fc.integer({ min: 0, max: 6 }), cents: fc.integer({ min: 1, max: 900_000 }) })
    .map((r): TestAction => ({ type: 'test/decide', blocking: false, ...r })),
);

/** A week plan: the actions to try before each advance (invalid ones are skipped, as a careful client would). */
export const weekPlanArb = (weeks: number): fc.Arbitrary<TestAction[][]> =>
  fc.array(fc.array(testActionArb, { maxLength: 3 }), { minLength: weeks, maxLength: weeks });

export interface Played {
  state: GameState;
  hashes: string[];
  reports: WeekReport[];
}

/** Plays a plan: valid actions are applied, invalid ones skipped; then the week advances. */
export function play(start: GameState, plan: readonly (readonly TestAction[])[], explain = false): Played {
  let s = start;
  const hashes: string[] = [];
  const reports: WeekReport[] = [];
  for (const actions of plan) {
    for (const a of actions) {
      const r = applyAction(s, asAction(a));
      if (r.ok) s = r.state;
    }
    const w = advanceWeek(s, { explain });
    s = w.state;
    reports.push(w.report);
    hashes.push(hashState(s));
  }
  return { state: s, hashes, reports };
}

/**
 * Structural equality that short-circuits on shared references (immutable states share untouched subtrees), returning
 * the first differing path or null.
 */
export function firstDifference(a: unknown, b: unknown, path = '$'): string | null {
  if (a === b) return null;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) {
    return Number.isNaN(a) && Number.isNaN(b) ? null : path;
  }
  if (Array.isArray(a) !== Array.isArray(b)) return path;
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return `${path}.length`;
    for (let i = 0; i < a.length; i++) {
      const d = firstDifference(a[i], b[i], `${path}[${i}]`);
      if (d !== null) return d;
    }
    return null;
  }
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const keys = [...new Set([...Object.keys(ra), ...Object.keys(rb)])].sort();
  for (const k of keys) {
    if (Object.prototype.hasOwnProperty.call(ra, k) !== Object.prototype.hasOwnProperty.call(rb, k))
      return `${path}.${k}`;
    const d = firstDifference(ra[k], rb[k], `${path}.${k}`);
    if (d !== null) return d;
  }
  return null;
}

/** A deep copy of plain data with every object's keys inserted in a shuffled order (iteration-order property). */
export function permuteRecords<T>(value: T, rand: () => number): T {
  if (Array.isArray(value)) return value.map((v) => permuteRecords(v, rand)) as T;
  if (typeof value !== 'object' || value === null) return value;
  const keys = Object.keys(value as Record<string, unknown>);
  for (let i = keys.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const t = keys[i] as string;
    keys[i] = keys[j] as string;
    keys[j] = t;
  }
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = permuteRecords((value as Record<string, unknown>)[k], rand);
  return out as T;
}

/** A small deterministic PRNG for test-side shuffles (never used by the engine). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Every `…Ids` array beside a Record must equal the Record's keys in compareIds order (§2.3 item 3). Pairs are found
 * by name: `xIds` ↔ `xs` or `x` (decisionIds ↔ decisions, activeIds ↔ active).
 */
export function idsArrayProblems(value: unknown, compare: (a: string, b: string) => number, path = '$'): string[] {
  if (Array.isArray(value)) return value.flatMap((v, i) => idsArrayProblems(v, compare, `${path}[${i}]`));
  if (typeof value !== 'object' || value === null) return [];
  const rec = value as Record<string, unknown>;
  const out: string[] = [];
  for (const key of Object.keys(rec)) {
    if (key.endsWith('Ids') && Array.isArray(rec[key])) {
      const stem = key.slice(0, -3);
      const sibling = rec[`${stem}s`] ?? rec[stem];
      if (typeof sibling === 'object' && sibling !== null && !Array.isArray(sibling)) {
        const expected = Object.keys(sibling).sort(compare);
        if (JSON.stringify(expected) !== JSON.stringify(rec[key])) out.push(`${path}.${key}`);
      }
    }
    out.push(...idsArrayProblems(rec[key], compare, `${path}.${key}`));
  }
  return out;
}
