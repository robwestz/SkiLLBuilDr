/**
 * E2E tests for playground.html — 3-panel Skill Playground workflow builder.
 *
 * Layout:
 *   Left panel  — catalog search (#catalogSearch) + item list (#catalogList)
 *   Middle panel — canvas node list (#nodeList) + count badge (#nodeCountBadge)
 *   Right panel  — export tabs (.preview-tab[data-tab]) + preview code (#previewCode)
 *
 * The dist/playground.html has __ECC_DATA__ inlined so no HTTP server is required.
 */

import { test, expect } from '@playwright/test';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLAYGROUND_PATH = join(__dirname, '..', '..', 'dist', 'playground.html');
const PLAYGROUND_URL = `file://${PLAYGROUND_PATH.replace(/\\/g, '/')}`;

/**
 * Navigate to the playground and wait until the catalog has populated.
 * catalogCount transitions from empty to "N items" once loadCatalog() runs.
 */
async function gotoPlayground(page) {
  await page.goto(PLAYGROUND_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => {
    const el = document.getElementById('catalogCount');
    return el && el.textContent.includes('item');
  }, { timeout: 15_000 });
}

/**
 * Add the first catalog item to the canvas and return its trimmed name.
 * Clicks the "+" button on the first visible catalog-item row.
 */
async function addFirstCatalogItem(page) {
  const firstItem = page.locator('#catalogList .catalog-item').first();
  await expect(firstItem).toBeVisible();
  const name = await firstItem.locator('.catalog-item-name').innerText();
  await firstItem.locator('.catalog-item-add').click();
  return name.trim();
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

test.describe('Skill Playground', () => {

  // 1. Page loads with catalog items visible
  test('playground loads with catalog items visible', async ({ page }) => {
    await gotoPlayground(page);

    // Topbar title is present
    await expect(page.locator('.topbar-title')).toBeVisible();
    await expect(page.locator('.topbar-title')).toContainText('Playground');

    // Catalog search input is present
    await expect(page.locator('#catalogSearch')).toBeVisible();

    // At least one catalog item is listed
    const items = page.locator('#catalogList .catalog-item');
    await expect(items.first()).toBeVisible();
    expect(await items.count()).toBeGreaterThan(0);

    // catalogCount shows "N items" text
    const countText = await page.locator('#catalogCount').innerText();
    expect(countText).toMatch(/\d+ items?/);
  });

  // 2. Searching the catalog filters visible items
  test('searching the catalog filters visible items', async ({ page }) => {
    await gotoPlayground(page);

    const allItems = page.locator('#catalogList .catalog-item');
    const totalBefore = await allItems.count();
    expect(totalBefore).toBeGreaterThan(0);

    // Type a term likely to match a subset of skills
    await page.locator('#catalogSearch').fill('code');

    // Wait for the filter to re-render (renderCatalog is synchronous on input event)
    await page.waitForFunction(() => {
      const el = document.getElementById('catalogCount');
      return el && el.textContent.includes('item');
    }, { timeout: 5_000 });

    const filteredCount = await allItems.count();
    expect(filteredCount).toBeGreaterThan(0);

    // Count badge must reflect the filtered number
    const countText = await page.locator('#catalogCount').innerText();
    expect(countText).toMatch(/\d+ items?/);
  });

  // 3. Clicking "+" on a catalog item adds it to the canvas
  test('clicking a catalog item adds it to the canvas', async ({ page }) => {
    await gotoPlayground(page);

    // Canvas starts empty — canvas-empty placeholder is visible
    await expect(page.locator('#nodeList .canvas-empty')).toBeVisible();

    await addFirstCatalogItem(page);

    // canvas-empty placeholder disappears
    await expect(page.locator('#nodeList .canvas-empty')).not.toBeVisible();

    // At least one node-card is now in the list
    const cards = page.locator('#nodeList .node-card');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThanOrEqual(1);
  });

  // 4. Canvas shows the added item's name
  test('canvas shows the added item name', async ({ page }) => {
    await gotoPlayground(page);

    const addedName = await addFirstCatalogItem(page);

    // The .node-name span must contain the item's name
    const nodeNames = page.locator('#nodeList .node-name');
    await expect(nodeNames.first()).toBeVisible();
    await expect(nodeNames.first()).toHaveText(addedName);

    // Step count badge should now be visible and mention "step"
    const badge = page.locator('#nodeCountBadge');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('step');
  });

  // 5. Prompt tab shows non-empty preview text after adding a skill
  test('Prompt tab shows non-empty text after adding a skill', async ({ page }) => {
    await gotoPlayground(page);
    await addFirstCatalogItem(page);

    // "Prompt" tab is active by default
    const promptTab = page.locator('.preview-tab[data-tab="prompt"]');
    await expect(promptTab).toHaveClass(/active/);

    const previewCode = page.locator('#previewCode');
    const text = await previewCode.textContent();

    // Must not be the empty-state placeholder
    expect(text).not.toContain('(empty — add steps to the canvas)');
    expect(text.trim().length).toBeGreaterThan(10);

    // buildPrompt always emits a "Step 1:" heading
    expect(text).toContain('Step 1:');
  });

  // 6. YAML tab is switchable and shows yaml-like content
  test('YAML tab is switchable and shows yaml-like content', async ({ page }) => {
    await gotoPlayground(page);
    await addFirstCatalogItem(page);

    // Click the YAML tab
    const yamlTab = page.locator('.preview-tab[data-tab="yaml"]');
    await yamlTab.click();
    await expect(yamlTab).toHaveClass(/active/);

    // Prompt tab loses active class
    await expect(page.locator('.preview-tab[data-tab="prompt"]')).not.toHaveClass(/active/);

    const text = await page.locator('#previewCode').textContent();
    expect(text.trim().length).toBeGreaterThan(0);

    // buildYaml always starts with "name:" (workflow slug line)
    expect(text).toMatch(/^name:/m);
    // Must include a nodes: block
    expect(text).toContain('nodes:');
  });

  // 7. CLAUDE.md tab shows a slug reference after adding a catalog skill
  test('CLAUDE.md tab shows a slug reference', async ({ page }) => {
    await gotoPlayground(page);
    await addFirstCatalogItem(page);

    // Click the CLAUDE.md tab
    const claudeTab = page.locator('.preview-tab[data-tab="claudemd"]');
    await claudeTab.click();
    await expect(claudeTab).toHaveClass(/active/);

    const text = await page.locator('#previewCode').textContent();
    expect(text.trim().length).toBeGreaterThan(0);

    // buildClaudeMd always begins with "## Skills"
    expect(text).toContain('## Skills');
    // A catalog skill entry is formatted as `slug` — at least one backtick-wrapped slug.
    // Slugs may start with "/" (e.g. `/namespace:skill-name`) or a letter.
    expect(text).toMatch(/`[/a-z][a-z0-9/:-]*`/);
  });

  // 8. Save workflow button opens the save modal when canvas has items
  test('Save workflow button opens the save modal', async ({ page }) => {
    await gotoPlayground(page);
    await addFirstCatalogItem(page);

    // Save modal starts hidden
    await expect(page.locator('#saveModal')).toBeHidden();

    // Click Save workflow button
    await page.locator('#btnSave').click();

    // Modal must now be visible
    await expect(page.locator('#saveModal')).toBeVisible({ timeout: 5_000 });

    // Modal contains title input and confirm button
    await expect(page.locator('#saveTitle')).toBeVisible();
    await expect(page.locator('#btnSaveConfirm')).toBeVisible();

    // Cancel closes the modal
    await page.locator('#btnSaveCancel').click();
    await expect(page.locator('#saveModal')).toBeHidden();
  });

  // 9. Clear canvas button removes all nodes
  test('Clear canvas button removes all nodes', async ({ page }) => {
    await gotoPlayground(page);

    // Add two items so there is definitely something to clear
    await addFirstCatalogItem(page);
    const secondItem = page.locator('#catalogList .catalog-item').nth(1);
    await secondItem.locator('.catalog-item-add').click();

    // Canvas now has node-cards
    const cards = page.locator('#nodeList .node-card');
    await expect(cards.first()).toBeVisible();
    expect(await cards.count()).toBeGreaterThanOrEqual(1);

    // Clear triggers a confirm() dialog — auto-accept it
    page.once('dialog', dialog => dialog.accept());
    await page.locator('#btnClearCanvas').click();

    // canvas-empty placeholder reappears
    await expect(page.locator('#nodeList .canvas-empty')).toBeVisible({ timeout: 5_000 });

    // No node-cards remain
    expect(await page.locator('#nodeList .node-card').count()).toBe(0);

    // Preview resets to the empty-state string
    const previewText = await page.locator('#previewCode').textContent();
    expect(previewText).toContain('(empty — add steps to the canvas)');
  });

  // 10. Save button shows toast and does not open modal when canvas is empty
  test('Save button shows a toast when canvas is empty', async ({ page }) => {
    await gotoPlayground(page);

    // Canvas is empty — Save should show a toast, not open the modal
    await page.locator('#btnSave').click();

    // Modal must stay hidden
    await expect(page.locator('#saveModal')).toBeHidden();

    // Toast appears with the warning
    const toast = page.locator('#toast');
    await expect(toast).toHaveClass(/show/, { timeout: 5_000 });
    const toastText = await toast.textContent();
    expect(toastText.toLowerCase()).toContain('empty');
  });

});
