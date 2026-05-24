// Playwright configuration for the OLD BLOOD // NEW BLOOD e2e suite (Task 19).
//
// Conventions:
//   - Test dir: ./e2e
//   - One project: chromium only for v1
//   - Reporter: list (CI-friendly + readable local output)
//   - webServer: spins up `next dev` and reuses an existing server when one is
//     already running locally (faster iteration). CI gets a fresh server every
//     run via reuseExistingServer: false when process.env.CI is set.
//   - Mobile-first viewport: 390×800 (matches the prototype's phone frame).

import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [['list']],

  use: {
    baseURL: 'http://localhost:3000',
    viewport: { width: 390, height: 800 },
    trace: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        // Default Playwright chromium device profile; viewport overridden above.
        browserName: 'chromium',
      },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
