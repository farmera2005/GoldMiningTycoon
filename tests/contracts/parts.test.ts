// The part table and the init table (P1 contract §1.4, §1.5, §3): every contract part is registered, in its slot
// (step, order, owning section, first rules phase), and nothing else; newGame's init parts run N1 … N11 in the
// contract's order with their phases.
import { describe, expect, it } from 'vitest';
import type { RulesPhase } from '../../src/engine';
import { INIT_PARTS } from '../../src/engine/state/initParts';
import { PIPELINE_PARTS } from '../../src/engine/turn/parts';

/** P1 contract §3: id → [step, order, section, fromPhase], in table order. */
const CONTRACT_PARTS: readonly (readonly [string, number, number, number, RulesPhase])[] = [
  ['framework.guard', 0, 1, 2, 0],
  ['framework.calendar', 1, 1, 2, 0],
  ['climate.seasonWeek', 1, 2, 1, 1],
  ['staff.yearStart', 1, 3, 8, 1],
  ['gold.marketStep', 2, 1, 10, 5],
  ['land.marketsRefresh', 3, 1, 5, 1],
  ['knowledge.marketsRefresh', 3, 2, 4, 1],
  ['staff.laborMarket', 3, 3, 8, 1],
  ['fleet.marketsRefresh', 3, 4, 9, 1],
  ['gold.campSafeRevert', 4, 1, 10, 5],
  ['events.eventsStep', 4, 2, 12, 1],
  ['competitors.step', 5, 1, 12, 5],
  ['land.pendingDeals', 6, 1, 5, 1],
  ['fleet.pendingDeals', 6, 2, 9, 1],
  ['gold.pendingDeals', 6, 3, 10, 5],
  ['finance.pendingDeals', 6, 4, 11, 4],
  ['knowledge.pendingDeals', 6, 5, 4, 1],
  ['ops.siteTasks', 6, 6, 7, 1],
  ['company.ownerWeek', 7, 1, 1, 1],
  ['world.resolveSiteVisits', 7, 2, 3, 1],
  ['staff.availability', 7, 3, 8, 1],
  ['fleet.availability', 8, 1, 9, 1],
  ['framework.operations', 9, 1, 2, 1],
  ['fleet.failures', 10, 1, 9, 3],
  ['ops.reResolve', 10, 2, 7, 3],
  ['fleet.meters', 10, 3, 9, 1],
  ['ops.freezeDamage', 10, 4, 7, 3],
  ['staff.hoursAndFatigue', 10, 5, 8, 1],
  ['events.tallyShocks', 10, 6, 12, 3],
  ['fleet.shop', 11, 1, 9, 1],
  ['framework.cleanupChain', 12, 1, 2, 1],
  ['framework.sampleChain', 12, 2, 2, 1],
  ['gold.standingOrders', 12, 3, 10, 1],
  ['gold.forwardDeliveries', 12, 4, 10, 5],
  ['permits.obligationsStep', 13, 1, 6, 1],
  ['finance.financeStep', 14, 1, 11, 1],
  ['finance.distressStep', 15, 1, 11, 1],
  ['company.reputation', 16, 1, 1, 1],
  ['investors.weekly', 16, 2, 1, 1],
  ['company.scenario', 16, 3, 1, 6],
  ['company.runEnd', 16, 4, 1, 0],
  ['world.wrapUp', 16, 5, 3, 1],
  ['knowledge.wrapUp', 16, 6, 4, 1],
  ['land.wrapUp', 16, 7, 5, 1],
  ['ops.wrapUp', 16, 8, 7, 1],
  ['staff.wrapUp', 16, 9, 8, 1],
  ['fleet.wrapUp', 16, 10, 9, 1],
  ['gold.wrapUp', 16, 11, 10, 1],
  ['events.wrapUp', 16, 12, 12, 1],
  ['framework.decisionDefaults', 16, 13, 2, 0],
  ['inbox.collate', 16, 14, 13, 0],
  ['framework.history', 16, 15, 2, 0],
  ['framework.reportCalc', 16, 16, 2, 0],
];

/** P1 contract §1.5: N1 … N11 (N8b = 8.5) → [order, section, fromPhase]. */
const CONTRACT_INIT: readonly (readonly [string, number, number, RulesPhase])[] = [
  ['world.generate', 1, 3, 0],
  ['climate.init', 2, 1, 1],
  ['world.initialCandidates', 3, 3, 1],
  ['company.inheritorGround', 4, 1, 1],
  ['land.createInitialListings', 5, 5, 1],
  ['fleet.initMarket', 6, 9, 1],
  ['gold.init', 7, 10, 1],
  ['staff.initPools', 8, 8, 1],
  ['knowledge.initContractors', 8.5, 4, 1],
  ['company.startSetup', 9, 1, 0],
  ['fixture.apply', 10, 2, 1],
  ['history.init', 11, 2, 0],
];

describe('the part table (P1 contract §3)', () => {
  it('equals the contract table: every part, in its slot, sorted by (step, order)', () => {
    expect(PIPELINE_PARTS.map((p) => [p.id, p.step, p.order, p.section, p.fromPhase])).toEqual(
      CONTRACT_PARTS.map((r) => [...r]),
    );
  });
});

describe('the init table (P1 contract §1.5)', () => {
  it('runs N1 … N11 in the contract’s order with their sections and phases', () => {
    expect(INIT_PARTS.map((p) => [p.id, p.order, p.section, p.fromPhase])).toEqual(CONTRACT_INIT.map((r) => [...r]));
  });

  it('runs exactly the P0 initialization under rules p0 (world, opening books, history)', () => {
    expect(INIT_PARTS.filter((p) => p.fromPhase === 0).map((p) => p.id)).toEqual([
      'world.generate',
      'company.startSetup',
      'history.init',
    ]);
  });
});
