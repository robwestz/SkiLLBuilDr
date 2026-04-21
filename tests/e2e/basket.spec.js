import { test, expect } from '@playwright/test';
import { gotoApp } from './_helpers.mjs';

test.describe('Basket operations', () => {
  test('adding an item updates the basket count', async ({ page }) => {
    await gotoApp(page);
    await page.locator('#browseList .pick-btn').first().click();
    await expect(page.locator('#basketCount')).not.toHaveText('0');
  });

  test('basket drawer opens and shows the added item', async ({ page }) => {
    await gotoApp(page);
    await page.locator('#browseList .pick-btn').first().click();
    await page.locator('#basketBtn').click();
    await expect(page.locator('#basketDrawer')).toHaveClass(/open/);
    await page.waitForTimeout(250); // wait for drawer slide-up transition (200ms)
    await expect(page.locator('#basketBody .basket-item')).toHaveCount(1);
  });

  test('reorder down moves the first item to second position', async ({ page }) => {
    await gotoApp(page);
    const picks = page.locator('#browseList .pick-btn');
    await picks.nth(0).click();
    await picks.nth(1).click();
    await page.locator('#basketBtn').click();
    await page.waitForTimeout(250); // wait for drawer slide-up transition

    const rows = page.locator('#basketBody .basket-item');
    await expect(rows).toHaveCount(2);

    // Slug is on the inner remove-button's data-slug
    const slugBefore = await rows.nth(0).locator('button[data-op="remove"]').getAttribute('data-slug');

    await rows.nth(0).locator('button[data-op="down"]').click();

    const rowsAfter = page.locator('#basketBody .basket-item');
    const slugAfter = await rowsAfter.nth(1).locator('button[data-op="remove"]').getAttribute('data-slug');
    expect(slugAfter).toBe(slugBefore);
  });

  test('remove button removes item from basket', async ({ page }) => {
    await gotoApp(page);
    await page.locator('#browseList .pick-btn').first().click();
    await page.locator('#basketBtn').click();
    await page.waitForTimeout(250); // wait for drawer slide-up transition
    await expect(page.locator('#basketBody .basket-item')).toHaveCount(1);
    // force:true needed: Chrome mobile expands touch targets to 48px min, causing
    // adjacent basket buttons (↓ and ✕) to overlap in pointer-event hit testing
    await page.locator('#basketBody .basket-item button[data-op="remove"]').click({ force: true });
    await expect(page.locator('#basketCount')).toHaveText('0');
  });

  test('Copy as prompt shows modal with non-empty content', async ({ page }) => {
    await gotoApp(page);
    await page.locator('#browseList .pick-btn').first().click();
    await page.locator('#basketBtn').click();
    await page.waitForTimeout(250); // wait for drawer slide-up transition
    await page.locator('#btnCopyPrompt').click();
    const preview = page.locator('#promptPreview');
    await expect(preview).toBeVisible();
    const content = await preview.inputValue();
    expect(content.length).toBeGreaterThan(0);
  });

  test('Close button hides the basket drawer', async ({ page }) => {
    await gotoApp(page);
    await page.locator('#basketBtn').click();
    await expect(page.locator('#basketDrawer')).toHaveClass(/open/);
    await page.waitForTimeout(250); // wait for drawer slide-up transition
    await page.locator('#btnCloseBasket').click();
    await expect(page.locator('#basketDrawer')).not.toHaveClass(/open/);
  });
});
