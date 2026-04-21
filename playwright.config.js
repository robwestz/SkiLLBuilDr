import { defineConfig, devices } from '@playwright/test';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, 'dist', 'skill-browser.html');
const BASE_URL = `file://${DIST.replace(/\\/g, '/')}`;

const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI ? 'github' : 'list',
  globalSetup: './tests/e2e/_setup.mjs',

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    video: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    // WebKit only in CI (not shipped for Windows by Playwright)
    ...(isCI
      ? [{ name: 'webkit', use: { ...devices['Desktop Safari'] } }]
      : []),
    {
      name: 'mobile-chrome-360',
      use: { ...devices['Galaxy S9+'] },
    },
    {
      name: 'mobile-chrome-414',
      // Pixel 5 is Chromium-based (414px width) — avoids requiring WebKit on Windows
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'tablet-768',
      // Explicit 768×1024 Chromium viewport — avoids requiring WebKit on Windows
      use: {
        browserName: 'chromium',
        viewport: { width: 768, height: 1024 },
        deviceScaleFactor: 1,
        isMobile: false,
        hasTouch: false,
      },
    },
  ],
});
