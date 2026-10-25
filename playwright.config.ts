import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests, in a real browser, for what the unit tests can't check (see CLAUDE.md). They run against the dev
 * server, started for them, or the one `npm start` already serves.
 */
export default defineConfig({
  testDir: 'e2e',
  forbidOnly: process.env['CI'] !== undefined,
  reporter: process.env['CI'] === undefined ? 'list' : [['github'], ['list']],
  use: { baseURL: 'http://localhost:4200', trace: 'retain-on-failure' },
  projects: [{ name: 'desktop', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm start',
    url: 'http://localhost:4200',
    reuseExistingServer: process.env['CI'] === undefined,
  },
});
