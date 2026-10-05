// CI thresholds from DESIGN §2.16 (`sim.*`, `save.*`): application configuration outside TuningResolved and its hash.
// Kept beside the perf job until a shared sim/save config module exists; names match the §2.16 table.
export const perfBudgets = {
  'sim.perf.weekMeanMs': 3.5,
  'sim.perf.weekCeilingMs': 8,
  'sim.perf.opsPerLineMs': 1.0,
  'sim.perf.estimatorWeekMs': 1.5,
  'sim.perf.estimatorEconRerunMs': 0.5,
  'sim.perf.eventsCompetitorsMs': 0.5,
  'sim.perf.marketsMs': 0.5,
} as const;

export const saveBudgets = {
  'save.maxStateKb': 3500,
  'save.maxFileKb': 4000,
  'save.sliceBudgetKb': {
    world: 1000,
    finance: 600,
    knowledge: 300,
    history: 300,
    inbox: 300,
    permits: 250,
    fleet: 250,
    gold: 200,
    other: 300,
  },
} as const;
