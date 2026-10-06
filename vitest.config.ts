import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Three projects: the pure engine/data/sim tests run in Node; UI and persistence tests run in jsdom; the `long` project
// holds the full-N statistical versions (10k district-years, thousands of seeds) of tests whose fixed-seed, smaller-N
// versions run in `npm test` with tolerances computed for their N (IR-9). `npm test` excludes `long`; `npm run
// test:long` runs it, nightly and at phase exit. A long test file is named `*.long.test.ts`.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'engine',
          environment: 'node',
          include: [
            'src/engine/**/*.test.ts',
            'src/data/**/*.test.ts',
            'sim/**/*.test.ts',
            'tests/**/*.test.ts',
            'tools/**/*.test.ts',
          ],
          exclude: ['tests/e2e/**', 'tests/perf/**', '**/*.long.test.ts', '**/node_modules/**'],
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: ['src/ui/**/*.test.{ts,tsx}', 'src/persistence/**/*.test.{ts,tsx}'],
        },
      },
      {
        test: {
          name: 'long',
          environment: 'node',
          include: ['src/**/*.long.test.ts', 'sim/**/*.long.test.ts', 'tests/**/*.long.test.ts'],
          exclude: ['tests/e2e/**', 'tests/perf/**', '**/node_modules/**'],
          testTimeout: 3_600_000,
        },
      },
    ],
  },
});
