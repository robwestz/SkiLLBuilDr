import { test, expect } from '@playwright/test';
import { gotoApp } from './_helpers.mjs';

test.describe('Theme toggle', () => {
  test('default theme is dark (no theme-light class)', async ({ page }) => {
    await gotoApp(page);
    const html = page.locator('html');
    await expect(html).not.toHaveClass(/theme-light/);
  });

  test('clicking theme toggle switches to light theme', async ({ page }) => {
    await gotoApp(page);
    await page.locator('#themeToggle').click();
    await expect(page.locator('html')).toHaveClass(/theme-light/);
  });

  test('light theme persists after page reload', async ({ page }) => {
    await gotoApp(page);
    await page.locator('#themeToggle').click();
    await expect(page.locator('html')).toHaveClass(/theme-light/);

    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => {
      const list = document.getElementById('browseList');
      return list && list.children.length > 0;
    });

    await expect(page.locator('html')).toHaveClass(/theme-light/);
  });

  test('toggling twice returns to dark theme', async ({ page }) => {
    await gotoApp(page);
    await page.locator('#themeToggle').click();
    await page.locator('#themeToggle').click();
    await expect(page.locator('html')).not.toHaveClass(/theme-light/);
  });

  test('theme stored in localStorage as settings.theme field', async ({ page }) => {
    await gotoApp(page);
    await page.locator('#themeToggle').click();
    const stored = await page.evaluate(() => {
      const raw = localStorage.getItem('skillbrowser.settings.v1');
      return JSON.parse(raw || '{}').theme;
    });
    expect(stored).toBe('light');
  });
});
