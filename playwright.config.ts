import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

// Cloud sessions come with a Chromium of their own, which may not be the one this Playwright version expects: use it
// when it's there, rather than installing another.
const preinstalledChromium = '/opt/pw-browsers/chromium';

/**
 * End-to-end tests, in a real browser, for what the unit tests can't check (see CLAUDE.md). They run against the dev
 * server, started for them, or the one `npm start` already serves.
 */
export default defineConfig({
  testDir: 'e2e',
  forbidOnly: process.env['CI'] !== undefined,
  // Tests on trial, thought not worth their time, only run with `npm run test:e2e:all` (see CLAUDE.md).
  ...(process.env['npm_lifecycle_event'] === 'test:e2e:all' ? {} : { grepInvert: /@disabled/ }),
  reporter: process.env['CI'] === undefined ? 'list' : [['github'], ['list']],
  // Without motion, as nothing they check hangs on time (see CLAUDE.md): what moves on its own, such as a button picked
  // out breathing, holds still.
  use: { baseURL: 'http://localhost:4200', trace: 'retain-on-failure', reducedMotion: 'reduce' },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        ...(existsSync(preinstalledChromium)
          ? { launchOptions: { executablePath: preinstalledChromium } }
          : {}),
      },
    },
  ],
  webServer: {
    command: 'npm start',
    url: 'http://localhost:4200',
    reuseExistingServer: process.env['CI'] === undefined,
  },
});
