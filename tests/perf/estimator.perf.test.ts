// §4 estimator time budgets (DESIGN §4.22 "Performance", §4.5.2, §2.13; s04 #2), `npm run test:perf`: a full solve of
// a 20-block claim with 20 pits ≤ 10 ms and of a 160-block claim with 60 samples (large-claim mode) ≤ 60 ms; an
// appended production batch ≤ 1 ms on a 20-block claim; an economic-layer rerun ≤ sim.perf.estimatorEconRerunMs.
// The 8-tracked-claim estimator week is checked on the synthetic year of sim/calibration/estimator-week.ts: its memo
// pattern (how many refreshes take a full solve, an appended batch, and so on) is deterministic and pinned, and its
// time has a regression ceiling. The sim.perf.estimatorWeekMs budget itself is measured on simulator games of the
// `cautious` and `heavyProspector` bots (4.22, s04 #2); the synthetic year is heavier (a prospecting claim taking a
// pit batch every four weeks, two operating claims cleaning up every other week) and starts from a cold memo.
// Medians gate the per-estimate times so a single GC pause on a loaded machine does not fail the job.
import { beforeAll, describe, expect, it } from 'vitest';
import { benchEconRerun, benchFullSolves, formatStats, timingStats } from '../../sim/calibration/estimator-bench';
import {
  buildEstimatorWeekScenario,
  REFRESH_KINDS,
  runEstimatorWeeks,
  type EstimatorWeekResult,
} from '../../sim/calibration/estimator-week';
import { perfBudgets } from './budgets';

const now = (): number => performance.now();

/** DESIGN §4.22 per-estimate targets (ms). */
const FULL_SOLVE_SMALL_MS = 10;
const FULL_SOLVE_LARGE_MS = 60;
const APPENDED_BATCH_MS = 1;

/**
 * Regression ceilings for the synthetic year (ms per game-week): about 2.2× the 2026-10-06 measurement on an idle
 * machine (3.6 ms from a cold memo, 1.3 ms from week 2), against P0's 14.7 ms without the incremental path.
 */
const SYNTHETIC_WEEK_CEILING_MS = 8;
const SYNTHETIC_STEADY_CEILING_MS = 3;

/**
 * The synthetic year's memo pattern (8 claims × 52 weeks = 416 refreshes): 8 prior-only solves in week 0, 8 first
 * evidence solves in week 1, 6 for the prospecting batches, 2 re-anchors at 12 production rows and 2 at the season
 * end on the operating claims; every cleanup that does not re-anchor appends a batch.
 */
const EXPECTED_KINDS = { full: 26, append: 26, state: 28, econ: 59, hit: 277 } as const;

describe('§4 estimator performance (4.22, §2.13)', () => {
  it('solves a 20-block claim with 20 pits in ≤ 10 ms, cold and with the prior model cached', () => {
    const b = benchFullSolves('small', 20, now, 10);
    const cold = timingStats(b.coldMs);
    const cached = timingStats(b.cachedMs);
    console.log(
      `full solve, ${b.blocks} blocks, ${b.samples} pits: cold ${formatStats(cold)}; cached ${formatStats(cached)}`,
    );
    expect(b.blocks).toBeGreaterThanOrEqual(20);
    expect(cold.median).toBeLessThanOrEqual(FULL_SOLVE_SMALL_MS);
    expect(cached.median).toBeLessThanOrEqual(FULL_SOLVE_SMALL_MS);
  });

  it('solves a 160-block claim with 60 samples in large-claim mode in ≤ 60 ms from a cold memo', () => {
    const b = benchFullSolves('large', 5, now, 2);
    const cold = timingStats(b.coldMs);
    console.log(
      `full solve, ${b.blocks} blocks, ${b.samples} samples, ${b.hypotheses} hypotheses: cold ${formatStats(cold)}; cached ${formatStats(timingStats(b.cachedMs))}`,
    );
    expect(b.blocks).toBe(160);
    expect(cold.median).toBeLessThanOrEqual(FULL_SOLVE_LARGE_MS);
  });

  it('reruns the economic layer within sim.perf.estimatorEconRerunMs', () => {
    const t = timingStats(benchEconRerun(10, now));
    console.log(`economic-layer rerun: ${formatStats(t)}`);
    expect(t.mean).toBeLessThanOrEqual(perfBudgets['sim.perf.estimatorEconRerunMs']);
  });

  describe('8 tracked claims for a year (synthetic estimator week)', () => {
    let week: EstimatorWeekResult;
    beforeAll(() => {
      const sc = buildEstimatorWeekScenario();
      runEstimatorWeeks(sc, now); // compile the incremental path before the timed year
      week = runEstimatorWeeks(sc, now);
      console.log(
        `estimator week: mean ${week.meanMs.toFixed(2)} ms from a cold memo, ${week.steadyMeanMs.toFixed(2)} ms from week 2, p95 ${week.p95Ms.toFixed(2)} (budget ${perfBudgets['sim.perf.estimatorWeekMs']} ms, measured on bot games)`,
      );
      for (const kind of REFRESH_KINDS) {
        const xs = week.calls.filter((c) => c.kind === kind).map((c) => c.ms);
        if (xs.length > 0) console.log(`  ${kind}: ${formatStats(timingStats(xs))}`);
      }
    });

    it('takes the incremental path: the memo pattern is pinned', () => {
      expect(week.countByKind).toEqual(EXPECTED_KINDS);
    });

    it('appends a production batch in ≤ 1 ms', () => {
      const t = timingStats(week.calls.filter((c) => c.kind === 'append').map((c) => c.ms));
      expect(t.n).toBe(EXPECTED_KINDS.append);
      expect(t.median).toBeLessThanOrEqual(APPENDED_BATCH_MS);
    });

    it('stays under the regression ceilings per game-week', () => {
      expect(week.meanMs).toBeLessThanOrEqual(SYNTHETIC_WEEK_CEILING_MS);
      expect(week.steadyMeanMs).toBeLessThanOrEqual(SYNTHETIC_STEADY_CEILING_MS);
    });
  });
});
