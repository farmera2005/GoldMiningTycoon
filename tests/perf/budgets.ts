// CI thresholds from DESIGN §2.16 (`sim.*`, `save.*`): application configuration outside TuningResolved and its hash.
// The `sim.perf.*` time budgets live in sim/config.ts (one source); names match the §2.16 table.
export { perfBudgets } from '../../sim/config';

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
