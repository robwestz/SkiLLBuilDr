import { test, expect } from '@playwright/test';
import { gotoApp } from './_helpers.mjs';

test.describe('Search and filter', () => {
  test('typing in search reduces visible item count', async ({ page }) => {
    await gotoApp(page);
    const totalRows = await page.locator('#browseList .row').count();

    await page.locator('#search').fill('python');
    await page.waitForTimeout(100); // debounce

    const filteredRows = await page.locator('#browseList .row').count();
    expect(filteredRows).toBeLessThan(totalRows);
    expect(filteredRows).toBeGreaterThan(0);
  });

  test('clearing search restores full list', async ({ page }) => {
    await gotoApp(page);
    const totalRows = await page.locator('#browseList .row').count();

    await page.locator('#search').fill('python');
    await page.waitForTimeout(100);

    await page.locator('#search').clear();
    await page.waitForTimeout(100);

    const restoredRows = await page.locator('#browseList .row').count();
    expect(restoredRows).toBe(totalRows);
  });

  test('copy filter URL button appears when search is active', async ({ page }) => {
    await gotoApp(page);
    const btn = page.locator('#btnCopyFilterUrl');
    await expect(btn).toBeHidden();

    await page.locator('#search').fill('review');
    await page.waitForTimeout(100);

    await expect(btn).toBeVisible();
  });

  test('copy filter URL button disappears after clearing search', async ({ page }) => {
    await gotoApp(page);
    await page.locator('#search').fill('review');
    await page.waitForTimeout(100);
    await expect(page.locator('#btnCopyFilterUrl')).toBeVisible();

    await page.locator('#search').clear();
    await page.waitForTimeout(100);
    await expect(page.locator('#btnCopyFilterUrl')).toBeHidden();
  });

  test('search with no matches shows empty-state message', async ({ page }) => {
    await gotoApp(page);
    await page.locator('#search').fill('xyzzy_no_match_expected_here');
    await page.waitForTimeout(100);

    expect(await page.locator('#browseList .row').count()).toBe(0);
    await expect(page.locator('#browseList')).toContainText('No matches');
  });
});
