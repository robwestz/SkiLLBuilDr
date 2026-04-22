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

  test('Playground link lives after Recipes, has hover state, and opens the playground page', async ({ page }) => {
    await gotoApp(page);

    const playground = page.locator('nav.tabs a.tab-link-btn[href="playground.html"]');
    await expect(playground).toBeVisible();
    await expect(playground).toContainText('Playground');

    const followsRecipes = await playground.evaluate(
      (el) => el.previousElementSibling?.matches('button[data-tab="recipes"]') ?? false
    );
    expect(followsRecipes).toBe(true);

    const colorBeforeHover = await playground.evaluate((el) => getComputedStyle(el).color);
    await playground.hover();
    const colorAfterHover = await playground.evaluate((el) => getComputedStyle(el).color);
    expect(colorAfterHover).not.toBe(colorBeforeHover);

    await Promise.all([
      page.waitForURL(/playground\.html$/),
      playground.click(),
    ]);
    await expect(page).toHaveTitle(/Skill Playground/i);
    await expect(page.locator('.topbar-title')).toContainText('Playground');
  });

  test('top navigation does not overflow the viewport on narrow screens', async ({ page }) => {
    await gotoApp(page);

    const layout = await page.evaluate(() => {
      const nav = document.querySelector('nav.tabs');
      return {
        pageScrollWidth: document.documentElement.scrollWidth,
        pageClientWidth: document.documentElement.clientWidth,
        navScrollWidth: nav?.scrollWidth ?? 0,
        navClientWidth: nav?.clientWidth ?? 0,
      };
    });

    expect(layout.pageScrollWidth).toBeLessThanOrEqual(layout.pageClientWidth + 1);
    expect(layout.navScrollWidth).toBeLessThanOrEqual(layout.navClientWidth + 1);
  });
});
