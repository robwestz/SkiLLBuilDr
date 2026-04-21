import { test, expect } from '@playwright/test';
import { gotoApp } from './_helpers.mjs';

test.describe('Tab navigation', () => {
  test('clicking Compose tab activates compose pane', async ({ page }) => {
    await gotoApp(page);
    await page.locator('nav.tabs button[data-tab="compose"]').click();
    await expect(page.locator('nav.tabs button[data-tab="compose"]')).toHaveClass(/active/);
    await expect(page.locator('#composePane')).toHaveClass(/active/);
    await expect(page.locator('#browsePane')).not.toHaveClass(/active/);
  });

  test('clicking Recipes tab activates recipes pane', async ({ page }) => {
    await gotoApp(page);
    await page.locator('nav.tabs button[data-tab="recipes"]').click();
    await expect(page.locator('nav.tabs button[data-tab="recipes"]')).toHaveClass(/active/);
    await expect(page.locator('#recipesPane')).toHaveClass(/active/);
  });

  test('clicking Browse tab returns to browse pane', async ({ page }) => {
    await gotoApp(page);
    await page.locator('nav.tabs button[data-tab="compose"]').click();
    await page.locator('nav.tabs button[data-tab="browse"]').click();
    await expect(page.locator('#browsePane')).toHaveClass(/active/);
    await expect(page.locator('#composePane')).not.toHaveClass(/active/);
  });

  test('Recipes tab shows seed recipe cards', async ({ page }) => {
    await gotoApp(page);
    await page.locator('nav.tabs button[data-tab="recipes"]').click();
    const cards = page.locator('#seedRecipes .recipe-card');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThan(0);
  });

  test('Compose tab shows intent input and find-skills button', async ({ page }) => {
    await gotoApp(page);
    await page.locator('nav.tabs button[data-tab="compose"]').click();
    await expect(page.locator('#intentInput')).toBeVisible();
    await expect(page.locator('#runIntent')).toBeVisible();
  });
});
