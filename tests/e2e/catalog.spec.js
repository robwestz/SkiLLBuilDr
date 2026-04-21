import { test, expect } from '@playwright/test';
import { gotoApp } from './_helpers.mjs';

test.describe('Catalog loads', () => {
  test('page title contains Skill Browser', async ({ page }) => {
    await gotoApp(page);
    await expect(page).toHaveTitle(/Skill Browser/i);
  });

  test('browse list renders at least one item row', async ({ page }) => {
    await gotoApp(page);
    const rows = page.locator('#browseList .row');
    await expect(rows.first()).toBeVisible();
    expect(await rows.count()).toBeGreaterThan(0);
  });

  test('meta counter shows a positive item count', async ({ page }) => {
    await gotoApp(page);
    const meta = page.locator('#meta');
    // Wait until the count line is rendered (format: "536 items · ...")
    await expect(meta).toContainText('items');
    const text = await meta.innerText();
    const match = text.match(/^(\d+)\s+items/);
    expect(match).not.toBeNull();
    expect(parseInt(match[1], 10)).toBeGreaterThan(0);
  });

  test('Browse tab is active by default', async ({ page }) => {
    await gotoApp(page);
    const browseBtn = page.locator('nav.tabs button[data-tab="browse"]');
    await expect(browseBtn).toHaveClass(/active/);
    await expect(page.locator('#browsePane')).toHaveClass(/active/);
  });
});
