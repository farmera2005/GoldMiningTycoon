import { defineConfig } from 'vitest/config';

// DESIGN §2.13 budgets on fixed fixtures. A separate job: a miss fails this run, not the unit suite.
export default defineConfig({
  test: {
    name: 'perf',
    environment: 'node',
    include: ['tests/perf/**/*.perf.test.ts'],
    testTimeout: 600_000,
  },
});
