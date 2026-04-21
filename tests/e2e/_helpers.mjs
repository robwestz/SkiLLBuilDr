import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST_PATH = join(__dirname, '..', '..', 'dist', 'skill-browser.html');

// Forward-slash path required for file:// on all platforms
export const DIST_URL = `file://${DIST_PATH.replace(/\\/g, '/')}`;

/**
 * Navigate to the bundled app, suppressing the welcome overlay.
 * @param {import('@playwright/test').Page} page
 * @param {{ hash?: string }} [opts]
 */
export async function gotoApp(page, opts = {}) {
  // Inject before page scripts run so welcomeSeen is already true
  await page.addInitScript(() => {
    try {
      const key = 'skillbrowser.settings.v1';
      const existing = JSON.parse(localStorage.getItem(key) || '{}');
      localStorage.setItem(key, JSON.stringify({ ...existing, welcomeSeen: true }));
    } catch {}
  });

  const url = opts.hash ? `${DIST_URL}${opts.hash}` : DIST_URL;
  await page.goto(url, { waitUntil: 'domcontentloaded' });

  // Wait until data has loaded — meta is set synchronously after data parse,
  // regardless of which tab is active (browseList may not render off-screen).
  await page.waitForFunction(() => {
    const meta = document.getElementById('meta');
    return meta && meta.textContent !== 'loading...';
  }, { timeout: 15_000 });
}
