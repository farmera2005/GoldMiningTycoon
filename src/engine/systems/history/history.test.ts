// §2 history (DESIGN §2.5; P1 contract §1.8): the snapshot reads the week's handoffs and the owners' selectors, the
// rollup moves to week 1 under P1 rules (s02 #9), and every metric has a label and unit (S13-8).
import { describe, expect, it } from 'vitest';
import type { ClaimId, LotId } from '../../core/ids';
import type { Cents } from '../../core/money';
import { produceState } from '../../state/immutability';
import { newGame } from '../../state/newGame';
import { defaultNewGameSetup } from '../../state/setup';
import type { GameState, RulesPhase } from '../../state/types';
import { advanceWeek } from '../../turn/advanceWeek';
import { deriveWeekCalendar } from '../../turn/steps/step01Calendar';
import { emptyWeekScratch } from '../../turn/week';
import { HISTORY_METRIC_INFO } from './metrics';
import { companySnapshot, yearRollup } from './snapshot';
import type { HistoryMetric } from './types';
import { rollupYearDue } from './week';

const BASE = newGame(defaultNewGameSetup({ companyName: 'History Test' }), 'history');
const withRules = (s: GameState, phase: RulesPhase): GameState =>
  produceState(s, (draft) => {
    draft.meta.rulesPhase = phase;
  });
const C1 = 'clm_000001' as ClaimId;
const C2 = 'clm_000002' as ClaimId;

/** A week in which two claims operated, two cleanups weighed and one sample lot was made. */
function busyWeek() {
  const week = emptyWeekScratch();
  week.ops.results[C2] = { claimId: C2, turn: 1, payWashedBcy: 1_200 };
  week.ops.results[C1] = { claimId: C1, turn: 1, payWashedBcy: 800 };
  week.cleanup.results.push(
    {
      claimId: C1,
      result: { turn: 1, lineId: 'L1', rawOzWeighed: 52.901 },
      fineOzRecovered: 52.901 * 0.85,
      inKindFineOz: 6.348 * 0.85,
      inKindValueCents: 2_000_000 as Cents,
    },
    {
      claimId: C1,
      result: { turn: 1, lineId: 'L2', rawOzWeighed: 10 },
      fineOzRecovered: 8.5,
      inKindFineOz: 0,
      inKindValueCents: 0 as Cents,
    },
  );
  week.knowledge.sampleLots.push({
    claimId: C2,
    lotId: 'lot_000003' as LotId,
    weighedRawOz: 0.25,
    fineOzRecovered: 0.2,
  });
  return week;
}

describe('the weekly snapshot (s02 #19, s01 #21, S11-15)', () => {
  it('is all zeros outside a pipeline and in a quiet week', () => {
    const quiet = companySnapshot(BASE, emptyWeekScratch());
    expect(companySnapshot(BASE)).toEqual(quiet);
    expect(quiet).toMatchObject({
      cashCents: 40_000_000,
      ownerNwCents: 52_000_000,
      payWashedBcy: 0,
      weighedRawOz: 0,
      soldFineOz: 0,
      sampleRawOz: 0,
      fineOzRecovered: 0,
      byClaim: {},
    });
  });

  it('sums the week’s handoffs: cleanups in weighedRawOz, samples apart, both in fineOzRecovered', () => {
    const snap = companySnapshot(BASE, busyWeek());
    expect(snap.payWashedBcy).toBe(2_000);
    expect(snap.weighedRawOz).toBeCloseTo(62.901, 12);
    expect(snap.sampleRawOz).toBe(0.25);
    expect(snap.fineOzRecovered).toBeCloseTo(52.901 * 0.85 + 8.5 + 0.2, 12);
    expect(Object.keys(snap.byClaim)).toEqual([C1, C2]); // ascending ids, whichever handoff named a claim first
    expect(snap.byClaim[C1]).toEqual({
      payWashedBcy: 800,
      weighedRawOz: 62.901,
      fineOzRecovered: 52.901 * 0.85 + 8.5,
      inKindFineOz: 6.348 * 0.85,
      inKindValueCents: 2_000_000,
    });
    expect(snap.byClaim[C2]).toEqual({
      payWashedBcy: 1_200,
      weighedRawOz: 0,
      fineOzRecovered: 0.2,
      inKindFineOz: 0,
      inKindValueCents: 0,
    });
  });

  it('never stores the week scratch: a fresh one each week, and none in state', () => {
    const { state } = advanceWeek(BASE);
    expect(JSON.stringify(state)).not.toContain('sampleLots');
    expect(state.history.weekly.at(-1)?.company).toEqual(companySnapshot(state));
  });
});

describe('the annual rollup (s02 #9, s01 #20, S11-15)', () => {
  it('is due at week 52 under P0 rules and at week 1 of the next year under P1 rules', () => {
    const at = (s: GameState, turn: number) =>
      deriveWeekCalendar({ ...s, clock: { ...s.clock, turn, year: Math.floor(turn / 52) + 1, week: (turn % 52) + 1 } });
    const p0 = withRules(BASE, 0);
    const p1 = withRules(BASE, 1);
    expect(rollupYearDue(p0, at(p0, 51))).toBe(1);
    expect(rollupYearDue(p0, at(p0, 52))).toBeNull();
    expect(rollupYearDue(p1, at(p1, 51))).toBeNull();
    expect(rollupYearDue(p1, at(p1, 52))).toBe(1);
    expect(rollupYearDue(p1, at(p1, 0))).toBeNull(); // no year 0
    expect(rollupYearDue(p1, at(p1, 104))).toBe(2);
  });

  it('writes year 1 at turn 52 in a P1 game, from the turn-51 snapshot', () => {
    let s = withRules(BASE, 1);
    for (let w = 0; w < 51; w++) s = advanceWeek(s).state;
    expect(s.clock.turn).toBe(51);
    expect(s.history.annual).toEqual([]);
    s = advanceWeek(s).state;
    expect(s.history.annual).toEqual([
      {
        year: 1,
        cashEndCents: 40_000_000,
        ownerNwEndCents: 52_000_000,
        companyNwEndCents: 40_000_000,
        payWashedBcy: 0,
        weighedRawOz: 0,
        soldFineOz: 0,
        revenueCents: 0,
        netIncomeCents: 0,
        claimsHeld: 0,
        fineOzRecovered: 0,
        cashCostCents: 0,
        aiscCents: 0,
        cashCostPerOzCents: null,
        aiscPerOzCents: null,
        byClaim: {},
      },
    ]);
  });

  it('adds up the year’s production by claim and leaves the cost per ounce null without ounces', () => {
    const snap = companySnapshot(BASE, busyWeek());
    const s = produceState(BASE, (draft) => {
      draft.history.weekly.push({ turn: 1, market: draft.history.weekly[0]!.market, company: snap });
      draft.history.weekly.push({ turn: 2, market: draft.history.weekly[0]!.market, company: snap });
    });
    const r = yearRollup(s, 1);
    expect(r.payWashedBcy).toBe(4_000);
    expect(r.weighedRawOz).toBeCloseTo(2 * 62.901, 12);
    expect(r.fineOzRecovered).toBeCloseTo(2 * snap.fineOzRecovered, 12);
    expect(r.byClaim).toEqual({
      [C1]: { payWashedBcy: 1_600, fineOzRecovered: 2 * snap.byClaim[C1]!.fineOzRecovered },
      [C2]: { payWashedBcy: 2_400, fineOzRecovered: 0.4 },
    });
    // §11's cost totals are zero until §11 lands, so the per-ounce figures are 0 over a positive recovery.
    expect(r.cashCostPerOzCents).toBe(0);
    expect(yearRollup(BASE, 1).cashCostPerOzCents).toBeNull();
  });
});

describe('HISTORY_METRIC_INFO (S13-8)', () => {
  it('labels every metric with its unit, raw or fine for gold', () => {
    const metrics = Object.keys(HISTORY_METRIC_INFO) as HistoryMetric[];
    const snapshotKeys = [
      ...Object.keys(BASE.history.weekly.at(-1)!.market),
      ...Object.keys(companySnapshot(BASE)).filter((k) => k !== 'byClaim'),
    ];
    expect([...metrics].sort()).toEqual([...snapshotKeys].sort());
    for (const m of metrics) expect(HISTORY_METRIC_INFO[m].label.length, m).toBeGreaterThan(3);
    expect(HISTORY_METRIC_INFO.weighedRawOz.unit).toBe('rawOz');
    expect(HISTORY_METRIC_INFO.sampleRawOz.unit).toBe('rawOz');
    expect(HISTORY_METRIC_INFO.fineOzRecovered.unit).toBe('fineOz');
    expect(HISTORY_METRIC_INFO.soldFineOz.unit).toBe('fineOz');
  });
});
