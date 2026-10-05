import { defineConfig, devices } from '@playwright/test';

// @playwright/test is pinned to 1.56.1 to match the preinstalled Chromium build.
// PW_CHROMIUM overrides the browser binary when the bundled one is unavailable.
const executablePath = process.env.PW_CHROMIUM;

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4173',
    ...devices['Desktop Chrome'],
    viewport: { width: 1440, height: 900 },
    launchOptions: executablePath ? { executablePath } : {},
  },
  webServer: {
    command: 'npx vite build && npx vite preview --port 4173 --strictPort --host 127.0.0.1',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 240_000,
  },
});
