// The part table (DESIGN §2.6; P1 contract §1.4, §3; s02 #8, #11): pinned to §2.6's step order and each section's
// sub-order, gated by rules phase, and checked for duplicates. The slot list below is the contract's §3 table; a part
// that is not in it, or sits in another slot, fails here.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { applyAction } from '../actions/apply';
import { asAction, registerTestActions } from '../actions/testActions';
import { hashState } from '../state/hash';
import { produceState } from '../state/immutability';
import { newGame } from '../state/newGame';
import { defaultNewGameSetup } from '../state/setup';
import type { GameState, RulesPhase } from '../state/types';
import { advanceWeek } from './advanceWeek';
import { PART_SOURCES, PIPELINE_PARTS, PartTableError, activeParts, buildPartTable, partsOfStep } from './parts';
import { PIPELINE } from './pipeline';
import { advanceWeekWithSeams, orderStepParts, reverseStepParts } from './seams';
import { NO_SEAMS, type PipelinePart } from './types';

let unregister: () => void;
beforeAll(() => {
  unregister = registerTestActions();
});
afterAll(() => unregister());

const BASE = newGame(defaultNewGameSetup({ companyName: 'Parts Test' }), 'parts');
const withRules = (s: GameState, phase: RulesPhase): GameState =>
  produceState(s, (draft) => {
    draft.meta.rulesPhase = phase;
  });

/** P1 contract §3: part id → [step, order, section, fromPhase]. */
const CONTRACT_SLOTS: Readonly<Record<string, readonly [number, number, number, RulesPhase]>> = {
  'framework.guard': [0, 1, 2, 0],
  'framework.calendar': [1, 1, 2, 0],
  'climate.seasonWeek': [1, 2, 1, 1],
  'staff.yearStart': [1, 3, 8, 1],
  'gold.marketStep': [2, 1, 10, 5],
  'land.marketsRefresh': [3, 1, 5, 1],
  'knowledge.marketsRefresh': [3, 2, 4, 1],
  'staff.laborMarket': [3, 3, 8, 1],
  'fleet.marketsRefresh': [3, 4, 9, 1],
  'gold.campSafeRevert': [4, 1, 10, 5],
  'events.eventsStep': [4, 2, 12, 1],
  'competitors.step': [5, 1, 12, 5],
  'land.pendingDeals': [6, 1, 5, 1],
  'fleet.pendingDeals': [6, 2, 9, 1],
  'gold.pendingDeals': [6, 3, 10, 5],
  'finance.pendingDeals': [6, 4, 11, 4],
  'knowledge.pendingDeals': [6, 5, 4, 1],
  'ops.siteTasks': [6, 6, 7, 1],
  'company.ownerWeek': [7, 1, 1, 1],
  'world.resolveSiteVisits': [7, 2, 3, 1],
  'staff.availability': [7, 3, 8, 1],
  'fleet.availability': [8, 1, 9, 1],
  'framework.operations': [9, 1, 2, 1],
  'fleet.failures': [10, 1, 9, 3],
  'ops.reResolve': [10, 2, 7, 3],
  'fleet.meters': [10, 3, 9, 1],
  'ops.freezeDamage': [10, 4, 7, 3],
  'staff.hoursAndFatigue': [10, 5, 8, 1],
  'events.tallyShocks': [10, 6, 12, 3],
  'fleet.shop': [11, 1, 9, 1],
  'framework.cleanupChain': [12, 1, 2, 1],
  'framework.sampleChain': [12, 2, 2, 1],
  'gold.standingOrders': [12, 3, 10, 1],
  'gold.forwardDeliveries': [12, 4, 10, 5],
  'permits.obligationsStep': [13, 1, 6, 1],
  'finance.financeStep': [14, 1, 11, 1],
  'finance.distressStep': [15, 1, 11, 1],
  'company.reputation': [16, 1, 1, 1],
  'investors.weekly': [16, 2, 1, 1],
  'company.scenario': [16, 3, 1, 6],
  'company.runEnd': [16, 4, 1, 0],
  'world.wrapUp': [16, 5, 3, 1],
  'knowledge.wrapUp': [16, 6, 4, 1],
  'land.wrapUp': [16, 7, 5, 1],
  'ops.wrapUp': [16, 8, 7, 1],
  'staff.wrapUp': [16, 9, 8, 1],
  'fleet.wrapUp': [16, 10, 9, 1],
  'gold.wrapUp': [16, 11, 10, 1],
  'events.wrapUp': [16, 12, 12, 1],
  'framework.decisionDefaults': [16, 13, 2, 0],
  'inbox.collate': [16, 14, 13, 0],
  'framework.history': [16, 15, 2, 0],
  'framework.reportCalc': [16, 16, 2, 0],
};

/** The parts the framework itself ships (the rest arrive with their owners' contracts). */
const FRAME_PARTS = [
  'framework.guard',
  'framework.calendar',
  'framework.operations',
  'framework.cleanupChain',
  'framework.sampleChain',
  'company.runEnd',
  'framework.decisionDefaults',
  'inbox.collate',
  'framework.history',
  'framework.reportCalc',
];

/** True when `seq` can be read off `order` left to right (repeats allowed): the step's §2.6 acting order. */
function isSubsequence(seq: readonly number[], order: readonly number[]): boolean {
  let i = 0;
  for (const x of seq) {
    while (i < order.length && order[i] !== x) i++;
    if (i === order.length) return false;
  }
  return true;
}

const part = (over: Partial<PipelinePart> & { id: string }): PipelinePart => ({
  step: 3,
  order: 1,
  section: 5,
  fromPhase: 1,
  run: (s) => s,
  ...over,
});

describe('the part table (DESIGN §2.6; P1 contract §3)', () => {
  it('holds only contract parts, each in its contract slot, sorted by (step, order)', () => {
    for (const p of PIPELINE_PARTS) {
      expect(CONTRACT_SLOTS[p.id], `${p.id} is not in the contract's part table`).toBeDefined();
      expect([p.step, p.order, p.section, p.fromPhase], p.id).toEqual(CONTRACT_SLOTS[p.id]);
    }
    const keys = PIPELINE_PARTS.map((p) => p.step * 100 + p.order);
    expect(keys).toEqual([...keys].sort((a, b) => a - b));
    expect(new Set(PIPELINE_PARTS.map((p) => p.id)).size).toBe(PIPELINE_PARTS.length);
  });

  it('ships the framework parts and the P0 owner parts', () => {
    const ids = PIPELINE_PARTS.map((p) => p.id);
    for (const id of FRAME_PARTS) expect(ids, id).toContain(id);
    // The P0 pipeline is exactly the parts from phase 0, in P0's order.
    expect(PIPELINE_PARTS.filter((p) => p.fromPhase === 0).map((p) => p.id)).toEqual([
      'framework.guard',
      'framework.calendar',
      'company.runEnd',
      'framework.decisionDefaults',
      'inbox.collate',
      'framework.history',
      'framework.reportCalc',
    ]);
  });

  it('keeps every step’s owner parts in the step’s §2.6 acting order (framework parts excepted)', () => {
    for (const step of PIPELINE) {
      const sections = partsOfStep(step.index)
        .filter((p) => p.section !== 2)
        .map((p) => p.section);
      expect(isSubsequence(sections, step.sections), `step ${step.index}: ${sections.join(',')}`).toBe(true);
    }
  });

  it('registers every part from the folder its id names', () => {
    for (const [source, parts] of Object.entries(PART_SOURCES)) {
      for (const p of parts) expect(p.id.split('.')[0], p.id).toBe(source);
    }
  });

  it('refuses duplicate ids and slots, foreign ids and out-of-range fields', () => {
    const ok = { land: [part({ id: 'land.a' })] };
    expect(buildPartTable(ok).map((p) => p.id)).toEqual(['land.a']);
    expect(() => buildPartTable({ land: [part({ id: 'land.a' }), part({ id: 'land.a', order: 2 })] })).toThrow(/twice/);
    expect(() => buildPartTable({ land: [part({ id: 'land.a' })], ops: [part({ id: 'ops.b' })] })).toThrow(/slot 3\.1/);
    expect(() => buildPartTable({ land: [part({ id: 'ops.a' })] })).toThrow(/registered by 'land'/);
    expect(() => buildPartTable({ land: [part({ id: 'land' })] })).toThrow(PartTableError);
    expect(() => buildPartTable({ land: [part({ id: 'land.a', step: 17 })] })).toThrow(/step 17/);
    expect(() => buildPartTable({ land: [part({ id: 'land.a', order: 0 })] })).toThrow(/order 0/);
    expect(() => buildPartTable({ land: [part({ id: 'land.a', fromPhase: 7 as RulesPhase })] })).toThrow(/fromPhase/);
    expect(() => buildPartTable({ land: [part({ id: 'land.a', section: 15 })] })).toThrow(/section 15/);
  });

  it('sorts by (step, order) whatever order the sources list them in', () => {
    const a = buildPartTable({ ops: [part({ id: 'ops.b', order: 2 })], land: [part({ id: 'land.a', order: 1 })] });
    expect(a.map((p) => p.id)).toEqual(['land.a', 'ops.b']);
  });
});

describe('rules-phase gating (s02 #8, D-2.18)', () => {
  it('runs only phase-0 parts under rules p0, and the P1 parts under rules p1', () => {
    const p0 = withRules(BASE, 0);
    const p1 = withRules(BASE, 1);
    const ids = (s: GameState, step: number) => activeParts(step, s, { seams: NO_SEAMS }).map((p) => p.id);
    expect(ids(p0, 9)).toEqual([]);
    expect(ids(p1, 9)).toEqual(['framework.operations']);
    expect(ids(p0, 12)).toEqual([]);
    expect(ids(p1, 12)).toEqual(['framework.cleanupChain', 'framework.sampleChain', 'gold.standingOrders']);
    for (const step of PIPELINE) {
      const all = partsOfStep(step.index);
      expect(ids(p0, step.index)).toEqual(all.filter((p) => p.fromPhase === 0).map((p) => p.id));
      expect(ids(p1, step.index)).toEqual(all.filter((p) => p.fromPhase <= 1).map((p) => p.id));
    }
  });

  it('advances a P1-rules game with the frame’s P1 parts in place', () => {
    let s = withRules(BASE, 1);
    for (let i = 0; i < 3; i++) s = advanceWeek(s).state;
    expect(s.clock.turn).toBe(3);
    expect(s.meta.rulesPhase).toBe(1);
  });

  it('refuses an action from a later phase with ACTION_NOT_IN_PHASE, and accepts it under its phase', () => {
    expect(applyAction(withRules(BASE, 0), asAction({ type: 'test/later' }))).toMatchObject({
      ok: false,
      error: { code: 'ACTION_NOT_IN_PHASE' },
    });
    expect(applyAction(withRules(BASE, 1), asAction({ type: 'test/later' }))).toMatchObject({ ok: true });
  });
});

describe('the part-order seam (§2.14 declared sub-order independence)', () => {
  it('runs a permuted step and leaves the production pipeline untouched', () => {
    const plain = advanceWeek(BASE);
    // Step 3's parts (§4, §8, §9 may run in any order, D-2.11) and an empty step reverse to the same week.
    const reversed = advanceWeekWithSeams(BASE, { orderParts: reverseStepParts([3, 5]) });
    expect(hashState(reversed.state)).toBe(hashState(plain.state));
    expect(reversed.report).toEqual(plain.report);
    const listed = advanceWeekWithSeams(BASE, { orderParts: orderStepParts(3, ['fleet.marketsRefresh']) });
    expect(hashState(listed.state)).toBe(hashState(plain.state));
  });

  it('refuses a seam that drops or adds a part', () => {
    const drop = (step: number, parts: readonly PipelinePart[]) => (step === 16 ? parts.slice(1) : parts);
    expect(() => advanceWeekWithSeams(BASE, { orderParts: drop })).toThrow(/not a permutation/);
    const add = (step: number, parts: readonly PipelinePart[]) =>
      step === 16 ? [...parts, part({ id: 'land.x', step: 16 })] : parts;
    expect(() => advanceWeekWithSeams(BASE, { orderParts: add })).toThrow(/not a permutation/);
  });
});
