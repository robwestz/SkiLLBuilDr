import { test, expect } from '@playwright/test';
import { gotoApp } from './_helpers.mjs';

// Navigate to base URL first, then set the hash via JS.
// This avoids a Windows+Playwright crash when addInitScript + file:// + fragment
// are combined in a single page.goto call.
async function gotoHash(page, hash) {
  await gotoApp(page);
  await page.evaluate((h) => { window.location.hash = h; }, hash);
  // Give the hash-router one tick to apply state
  await page.waitForFunction(
    (h) => window.location.hash === h,
    hash,
    { timeout: 5_000 }
  );
}

test.describe('Deep-link hash routing', () => {
  test('#tab=compose switches to compose pane', async ({ page }) => {
    await gotoHash(page, '#tab=compose');
    await expect(page.locator('#composePane')).toHaveClass(/active/);
    await expect(page.locator('nav.tabs button[data-tab="compose"]')).toHaveClass(/active/);
  });

  test('#tab=recipes switches to recipes pane', async ({ page }) => {
    await gotoHash(page, '#tab=recipes');
    await expect(page.locator('#recipesPane')).toHaveClass(/active/);
  });

  test('#q=python populates the search field and filters results', async ({ page }) => {
    await gotoHash(page, '#q=python');
    await expect(page.locator('#search')).toHaveValue('python');
    const rows = page.locator('#browseList .row');
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test('#category=Security filters browse list', async ({ page }) => {
    await gotoApp(page);
    const totalRows = await page.locator('#browseList .row').count();

    await gotoHash(page, '#category=Security');
    await page.waitForFunction(() => {
      const list = document.getElementById('browseList');
      return list && list.children.length > 0;
    }, { timeout: 10_000 });

    const filteredRows = await page.locator('#browseList .row').count();
    expect(filteredRows).toBeGreaterThan(0);
    expect(filteredRows).toBeLessThan(totalRows);
  });

  test('browser back restores previous filter state', async ({ page }) => {
    await gotoApp(page);
    // Navigate forward to compose via hash push
    await page.evaluate(() => {
      history.pushState(null, '', window.location.href.split('#')[0] + '#tab=compose');
      window.dispatchEvent(new PopStateEvent('popstate'));
    });
    await expect(page.locator('#composePane')).toHaveClass(/active/);

    // Go back
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const meta = document.getElementById('meta');
      return meta && meta.textContent !== 'loading...';
    }, { timeout: 10_000 });
    await expect(page.locator('#browsePane')).toHaveClass(/active/);
  });
});
