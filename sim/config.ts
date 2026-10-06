// Simulator application configuration: the `sim.*` keys of DESIGN §2.16 (and BALANCE §3.0, §6.3). Like §13's `ui.*`,
// they sit outside TuningResolved and meta.tuningHash: changing one never changes a game, only how many games run, how
// they are spread over workers, or the CI thresholds the perf job compares against (DESIGN §2.13).

export const simConfig = {
  /** BALANCE §6.3: games per cell for sign-off. */
  'sim.defaultGames': 500,
  /** BALANCE §6.3 `--quick`: development only, never sign-off. */
  'sim.quickGames': 100,
  'sim.defaultYears': 5,
  /** Worker threads; 0 = one per CPU core. Never changes results (D-2.12, BALANCE §6.2). */
  'sim.workers': 0,
  /** BALANCE §6.6: weekly-sample.csv carries the first N seeds of every cell. */
  'sim.weeklySampleSeeds': 20,
  /** BALANCE §3.0: medians and ratios carry a seeded 95% bootstrap interval of this many resamples. */
  'sim.bootstrapResamples': 1000,
  // DESIGN §2.13 budgets (CI thresholds; tests/perf/budgets.ts re-exports them so there is one source).
  'sim.perf.weekMeanMs': 3.5,
  'sim.perf.weekCeilingMs': 8,
  'sim.perf.opsPerLineMs': 1.0,
  'sim.perf.estimatorWeekMs': 1.5,
  'sim.perf.estimatorEconRerunMs': 0.5,
  'sim.perf.eventsCompetitorsMs': 0.5,
  'sim.perf.marketsMs': 0.5,
} as const;

export type SimConfigKey = keyof typeof simConfig;

/** The DESIGN §2.13 time budgets, as the perf job reads them. */
export const perfBudgets = {
  'sim.perf.weekMeanMs': simConfig['sim.perf.weekMeanMs'],
  'sim.perf.weekCeilingMs': simConfig['sim.perf.weekCeilingMs'],
  'sim.perf.opsPerLineMs': simConfig['sim.perf.opsPerLineMs'],
  'sim.perf.estimatorWeekMs': simConfig['sim.perf.estimatorWeekMs'],
  'sim.perf.estimatorEconRerunMs': simConfig['sim.perf.estimatorEconRerunMs'],
  'sim.perf.eventsCompetitorsMs': simConfig['sim.perf.eventsCompetitorsMs'],
  'sim.perf.marketsMs': simConfig['sim.perf.marketsMs'],
} as const;
