/**
 * E2E tests for assembler.html — 4-step package wizard.
 *
 * Navigation model (from the source):
 *   Step 1: describe goal  → #btnNext triggers rerankSelections(true) → advances to step 2
 *   Step 2: select skills  → #btnNext requires ≥1 selected item → step 3
 *   Step 3: review         → #btnNext requires ≥1 selected item → step 4
 *   Step 4: download       → #btnReset returns to step 1
 *
 * The dist/assembler.html has __ECC_DATA__ inlined so no HTTP server is required.
 */

import { test, expect } from '@playwright/test';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSEMBLER_PATH = join(__dirname, '..', '..', 'dist', 'assembler.html');
const ASSEMBLER_URL = `file://${ASSEMBLER_PATH.replace(/\\/g, '/')}`;

const GOAL = 'build a Python code review tool';

/** Navigate to assembler and wait until the catalog has loaded. */
async function gotoAssembler(page) {
  await page.goto(ASSEMBLER_URL, { waitUntil: 'domcontentloaded' });
  // Wait until catalogCount is populated (not "Loading...")
  await page.waitForFunction(() => {
    const el = document.getElementById('catalogCount');
    return el && el.textContent !== 'Loading...' && el.textContent !== '';
  }, { timeout: 15_000 });
}

/** Fill the goal and click Next to advance to step 2. */
async function advanceToStep2(page) {
  await page.locator('#goalInput').fill(GOAL);
  await page.locator('#btnNext').click();
  // rerankSelections sets step 2 when suggestions exist
  await expect(page.locator('.stage[data-step="2"]')).toHaveClass(/active/, { timeout: 10_000 });
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('Assembler wizard', () => {

  // 1. Load check
  test('assembler loads and shows step 1', async ({ page }) => {
    await gotoAssembler(page);

    // goalInput is visible
    await expect(page.locator('#goalInput')).toBeVisible();

    // Step 1 stage is active
    await expect(page.locator('.stage[data-step="1"]')).toHaveClass(/active/);

    // Stepper pill for step 1 should carry the "active" class
    const firstPill = page.locator('.step-pill').nth(0);
    await expect(firstPill).toHaveClass(/active/);
  });

  // 2. Step 1 → Step 2 navigation
  test('typing a goal and clicking Next advances to step 2', async ({ page }) => {
    await gotoAssembler(page);
    await advanceToStep2(page);

    // Step 2 is now the active stage
    await expect(page.locator('.stage[data-step="2"]')).toHaveClass(/active/);

    // Step 1 stage is no longer active
    await expect(page.locator('.stage[data-step="1"]')).not.toHaveClass(/active/);
  });

  // 3. Suggestion summary and cards visible in step 2
  test('step 2 shows skill suggestions for the goal', async ({ page }) => {
    await gotoAssembler(page);
    await advanceToStep2(page);

    // suggestionSummary should contain non-empty text (not "No ranking yet.")
    const summary = page.locator('#suggestionSummary');
    await expect(summary).not.toHaveText('No ranking yet.');
    const text = await summary.innerText();
    expect(text.trim().length).toBeGreaterThan(0);

    // At least one result card in the grid
    const cards = page.locator('#resultsGrid .result-card');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThan(0);
  });

  // 4. Clicking a skill card selects it (gets "added" class)
  test('clicking a skill card selects it', async ({ page }) => {
    await gotoAssembler(page);
    await advanceToStep2(page);

    // rerankSelections pre-selects the top 6 — find the first card that is NOT yet selected
    const cards = page.locator('#resultsGrid .result-card');
    await expect(cards.first()).toBeVisible();

    const firstCard = cards.nth(0);
    const isAlreadyAdded = await firstCard.evaluate(el => el.classList.contains('added'));

    if (isAlreadyAdded) {
      // De-select then re-select to confirm the toggle works both ways
      await firstCard.locator('button[data-action="toggle"]').click();
      await expect(firstCard).not.toHaveClass(/added/);
      await firstCard.locator('button[data-action="toggle"]').click();
      await expect(firstCard).toHaveClass(/added/);
    } else {
      await firstCard.locator('button[data-action="toggle"]').click();
      await expect(firstCard).toHaveClass(/added/);
    }
  });

  // 5. Next in step 2 with ≥1 selected advances to step 3
  test('Next in step 2 with at least one skill advances to step 3', async ({ page }) => {
    await gotoAssembler(page);
    await advanceToStep2(page);

    // Ensure at least one card is selected; if none are, click the first one
    const selectedCount = await page.locator('#resultsGrid .result-card.added').count();
    if (selectedCount === 0) {
      await page.locator('#resultsGrid .result-card').first()
        .locator('button[data-action="toggle"]').click();
    }

    await page.locator('#btnNext').click();
    await expect(page.locator('.stage[data-step="3"]')).toHaveClass(/active/, { timeout: 10_000 });
  });

  // 6. Step 3 shows the selected skill names in the review list
  test('step 3 shows selected skills', async ({ page }) => {
    await gotoAssembler(page);
    await advanceToStep2(page);

    // Make sure at least one card is selected and capture its name
    const cards = page.locator('#resultsGrid .result-card');
    await expect(cards.first()).toBeVisible();

    const firstCard = cards.nth(0);
    const isAdded = await firstCard.evaluate(el => el.classList.contains('added'));
    if (!isAdded) {
      await firstCard.locator('button[data-action="toggle"]').click();
    }

    // Capture the name from the first card that has "added"
    const addedCard = page.locator('#resultsGrid .result-card.added').first();
    const skillName = await addedCard.locator('h3').innerText();

    // Advance to step 3
    await page.locator('#btnNext').click();
    await expect(page.locator('.stage[data-step="3"]')).toHaveClass(/active/, { timeout: 10_000 });

    // Review list must have at least one review-card
    await expect(page.locator('#reviewList .review-card').first()).toBeVisible();

    // The selected skill name must appear in the review list
    await expect(page.locator('#reviewList')).toContainText(skillName.trim());
  });

  // 7. Next in step 3 advances to step 4
  test('Next in step 3 advances to step 4', async ({ page }) => {
    await gotoAssembler(page);
    await advanceToStep2(page);

    // Ensure something is selected
    const selectedCount = await page.locator('#resultsGrid .result-card.added').count();
    if (selectedCount === 0) {
      await page.locator('#resultsGrid .result-card').first()
        .locator('button[data-action="toggle"]').click();
    }

    // Step 2 → Step 3
    await page.locator('#btnNext').click();
    await expect(page.locator('.stage[data-step="3"]')).toHaveClass(/active/, { timeout: 10_000 });

    // Step 3 → Step 4
    await page.locator('#btnNext').click();
    await expect(page.locator('.stage[data-step="4"]')).toHaveClass(/active/, { timeout: 10_000 });
  });

  // 8. Step 4 has a Download ZIP button
  test('step 4 has a Download ZIP button', async ({ page }) => {
    await gotoAssembler(page);
    await advanceToStep2(page);

    // Ensure something is selected
    const selectedCount = await page.locator('#resultsGrid .result-card.added').count();
    if (selectedCount === 0) {
      await page.locator('#resultsGrid .result-card').first()
        .locator('button[data-action="toggle"]').click();
    }

    await page.locator('#btnNext').click(); // → step 3
    await expect(page.locator('.stage[data-step="3"]')).toHaveClass(/active/, { timeout: 10_000 });

    await page.locator('#btnNext').click(); // → step 4
    await expect(page.locator('.stage[data-step="4"]')).toHaveClass(/active/, { timeout: 10_000 });

    // Download ZIP button must be visible in step 4
    await expect(page.locator('#btnDownloadZip')).toBeVisible();
    const zipText = await page.locator('#btnDownloadZip').innerText();
    expect(zipText.toLowerCase()).toMatch(/zip|download/);
  });

  // 9. Reset button returns to step 1
  test('Reset returns to step 1', async ({ page }) => {
    await gotoAssembler(page);
    await advanceToStep2(page);

    // Currently on step 2 — click Reset
    await page.locator('#btnReset').click();

    // Step 1 should be active again
    await expect(page.locator('.stage[data-step="1"]')).toHaveClass(/active/, { timeout: 10_000 });
    await expect(page.locator('#goalInput')).toBeVisible();

    // goalInput should be empty after reset
    await expect(page.locator('#goalInput')).toHaveValue('');
  });

  // 10. LLM settings button is visible and opens a modal overlay
  test('LLM settings button is visible and opens a modal', async ({ page }) => {
    await gotoAssembler(page);

    // Button must exist and be visible in the topbar
    const btn = page.locator('#llmSettingsBtn');
    await expect(btn).toBeVisible();

    // The overlay starts hidden
    await expect(page.locator('#llmSettingsOverlay')).toBeHidden();

    // Clicking the button shows the modal overlay
    await btn.click();
    await expect(page.locator('#llmSettingsOverlay')).toBeVisible({ timeout: 5_000 });

    // Modal contains the settings heading
    await expect(page.locator('#llmSettingsTitle')).toBeVisible();
    await expect(page.locator('#llmSettingsTitle')).toContainText(/AI.*Settings/i);
  });

  // 11. LLM settings — save roundtrip persists provider + key to localStorage
  test('LLM settings save roundtrip persists to localStorage', async ({ page, isMobile }) => {
    test.skip(isMobile, 'AI Settings button may overflow topbar on mobile — desktop-only');
    await gotoAssembler(page);

    await page.evaluate(() => localStorage.removeItem('assembler-llm-config-v1'));

    await page.locator('#llmSettingsBtn').click();
    await expect(page.locator('#llmSettingsOverlay')).toBeVisible({ timeout: 5_000 });

    await page.locator('#llmProviderSelect').selectOption('groq');
    await page.locator('#llmApiKeyInput').fill('gsk_test_fake_for_e2e');
    await page.locator('#llmSaveBtn').click();

    const cfg = await page.evaluate(() =>
      JSON.parse(localStorage.getItem('assembler-llm-config-v1') || '{}')
    );
    expect(cfg.provider).toBe('groq');
    expect(cfg.apiKey).toBe('gsk_test_fake_for_e2e');

    await page.evaluate(() => localStorage.removeItem('assembler-llm-config-v1'));
  });

  // 12. LLM settings — clear button empties the stored apiKey
  test('LLM settings clear button empties localStorage', async ({ page, isMobile }) => {
    test.skip(isMobile, 'AI Settings button may overflow topbar on mobile — desktop-only');
    await gotoAssembler(page);

    await page.evaluate(() => {
      localStorage.setItem('assembler-llm-config-v1', JSON.stringify({
        provider: 'groq',
        apiKey: 'gsk_to_be_cleared',
      }));
    });

    await page.locator('#llmSettingsBtn').click();
    await expect(page.locator('#llmSettingsOverlay')).toBeVisible({ timeout: 5_000 });
    await expect(page.locator('#llmApiKeyInput')).toHaveValue('gsk_to_be_cleared');

    await page.locator('#llmClearBtn').click();

    const hasKey = await page.evaluate(() => {
      const raw = localStorage.getItem('assembler-llm-config-v1');
      if (!raw) return false;
      try { return !!JSON.parse(raw).apiKey; } catch { return false; }
    });
    expect(hasKey).toBe(false);
  });

});
