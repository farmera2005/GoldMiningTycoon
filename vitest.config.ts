import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// Two projects: the pure engine/data/sim tests run in Node; UI and persistence tests run in jsdom.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'engine',
          environment: 'node',
          include: ['src/engine/**/*.test.ts', 'src/data/**/*.test.ts', 'sim/**/*.test.ts', 'tests/**/*.test.ts', 'tools/**/*.test.ts'],
          exclude: ['tests/e2e/**', 'tests/perf/**', '**/node_modules/**'],
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
    ],
  },
});
