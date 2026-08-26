import { test, expect, Page } from '@playwright/test';
import { loginAsE2ETester } from './auth.helper';

test.describe('Human-Like Exploratory & Chaos User Journey', () => {
  const runId = Date.now();

  test.beforeEach(async ({ page }) => {
    await loginAsE2ETester(page);
  });

  test('Human Behavior: Impulsive selection, partial unchecking, and rapid toggle chaos', async ({ page }) => {
    // 1. Seed grid with a few slips so the user has content to play with
    const saveBtn = page.getByRole('button', { name: /save/i }).first();
    for (let i = 1; i <= 4; i++) {
      await saveBtn.click();
      await page.getByRole('button', { name: /new note/i }).click();
      await page.getByPlaceholder(/note title/i).fill(`Chaotic Idea ${i} - ${runId}`);
      await page.getByPlaceholder(/start typing your note/i).fill(`Human random thought #${i * 42}`);
      await page.getByRole('button', { name: /save note/i }).click();
      await expect(page.locator('.modal-content')).not.toBeVisible({ timeout: 10000 });
    }

    const checkboxes = page.locator('button.card-select-checkbox-btn');
    await expect(checkboxes.first()).toBeVisible({ timeout: 5000 });
    const count = await checkboxes.count();

    // 2. Random selection behavior: human clicks 1st card, then 3rd card
    await checkboxes.nth(0).click();
    await page.waitForTimeout(200);

    const bulkBar = page.locator('.bulk-action-bar-container');
    await expect(bulkBar).toBeVisible();
    await expect(bulkBar.locator('.bulk-dock-count-number')).toHaveText('1');

    if (count > 2) {
      await checkboxes.nth(2).click();
      await page.waitForTimeout(150);
      await expect(bulkBar.locator('.bulk-dock-count-number')).toHaveText('2');
    }

    // 3. Human changes their mind: hits "Select All"
    const selectAllBtn = bulkBar.locator('.bulk-dock-select-all-btn');
    await selectAllBtn.click();
    await page.waitForTimeout(200);
    await expect(bulkBar.getByText(/Deselect All/i)).toBeVisible();

    // 4. Human manually unchecks one random card while in Select All mode
    await checkboxes.nth(1).click();
    await page.waitForTimeout(150);
    // Counter should decrement by 1
    const updatedCount = await bulkBar.locator('.bulk-dock-count-number').innerText();
    expect(Number(updatedCount)).toBe(count - 1);

    // 5. Human impulsively clicks the Cancel (✕) button in dock
    const cancelBtn = bulkBar.locator('button.bulk-dock-close-btn');
    await cancelBtn.click();
    await expect(bulkBar).not.toBeVisible({ timeout: 5000 });
  });

  test('Human Behavior: Search thrashing, filter clicking while items are selected', async ({ page }) => {
    // 1. Select the first available card
    const firstCheckbox = page.locator('button.card-select-checkbox-btn').first();
    await firstCheckbox.click();
    const bulkBar = page.locator('.bulk-action-bar-container');
    await expect(bulkBar).toBeVisible();

    // 2. Human starts typing in search bar rapidly, makes a typo, backspaces
    const searchInput = page.locator('.search-input');
    await searchInput.focus();
    await page.keyboard.type('Chao', { delay: 60 });
    await page.waitForTimeout(150);
    await page.keyboard.type('tic Iddea', { delay: 60 });
    await page.waitForTimeout(100);
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Backspace');
    await page.keyboard.type('ea', { delay: 60 });

    // 3. Human switches content tabs back and forth
    const notesTab = page.getByRole('button', { name: /^notes$/i });
    if (await notesTab.isVisible()) {
      await notesTab.click();
      await page.waitForTimeout(200);
    }

    const websitesTab = page.getByRole('button', { name: /^websites$/i });
    if (await websitesTab.isVisible()) {
      await websitesTab.click();
      await page.waitForTimeout(200);
    }

    const allTab = page.getByRole('button', { name: /^all$/i });
    await allTab.click();
    await page.waitForTimeout(200);

    // 4. Human clears search
    const clearBtn = page.locator('.search-clear-btn');
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
    } else {
      await searchInput.fill('');
    }

    // App should remain responsive and stable
    await expect(page.locator('.top-nav')).toBeVisible();
  });

  test('Human Behavior: Fast theme switcher binge & modal open/close frenzy', async ({ page }) => {
    const settingsBtn = page.locator('.nav-settings-btn, button[aria-label="Settings"]').first();
    await settingsBtn.click();

    const modal = page.locator('.settings-modal-content');
    await expect(modal).toBeVisible({ timeout: 5000 });

    // Switch to Appearance Tab
    const appearanceTab = page.locator('.settings-nav-btn', { hasText: /appearance/i });
    await appearanceTab.click();

    // Human rapidly clicks through various theme buttons
    const themeRows = page.locator('.theme-mini-row');
    const themeCount = await themeRows.count();

    for (let i = 0; i < Math.min(themeCount, 4); i++) {
      await themeRows.nth(i).click();
      await page.waitForTimeout(150); // Human visual pause
    }

    // Toggle dark/light modes
    const darkBtn = page.getByRole('button', { name: /dark/i });
    const lightBtn = page.getByRole('button', { name: /light/i });
    if (await lightBtn.isVisible()) {
      await lightBtn.click();
      await page.waitForTimeout(150);
    }
    if (await darkBtn.isVisible()) {
      await darkBtn.click();
      await page.waitForTimeout(150);
    }

    // Close settings modal by clicking the X button
    const closeBtn = page.locator('.settings-modal-content .modal-close, button[aria-label="Close modal"]').first();
    await closeBtn.click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });
  });

  test('Human Chaos Monkey: 12 randomized non-destructive actions with invariant safety checks', async ({ page }) => {
    // A 12-step randomized walk simulating curious human clicks
    for (let step = 1; step <= 12; step++) {
      const actionPick = Math.floor(Math.random() * 6);

      switch (actionPick) {
        case 0: {
          // Scroll up and down like a browsing human
          await page.mouse.wheel(0, 300);
          await page.waitForTimeout(150);
          await page.mouse.wheel(0, -300);
          break;
        }
        case 1: {
          // Toggle a random card checkbox
          const checkboxes = page.locator('button.card-select-checkbox-btn');
          const count = await checkboxes.count();
          if (count > 0) {
            const randomIndex = Math.floor(Math.random() * count);
            await checkboxes.nth(randomIndex).click();
          }
          break;
        }
        case 2: {
          // Switch to a random filter tab
          const tabs = page.locator('.type-tabs-container button, .filter-tab-btn');
          const count = await tabs.count();
          if (count > 0) {
            const randomIndex = Math.floor(Math.random() * count);
            await tabs.nth(randomIndex).click();
          }
          break;
        }
        case 3: {
          // Open "Save to Slip" modal and close without saving
          const saveBtn = page.getByRole('button', { name: /save/i }).first();
          if (await saveBtn.isVisible()) {
            await saveBtn.click();
            const modal = page.locator('.modal-content');
            if (await modal.isVisible({ timeout: 2000 }).catch(() => false)) {
              const close = page.locator('.modal-close, button[aria-label*="close" i]').first();
              if (await close.isVisible()) {
                await close.click();
              } else {
                await page.keyboard.press('Escape');
              }
            }
          }
          break;
        }
        case 4: {
          // Clear any active bulk selection
          const bulkBar = page.locator('.bulk-action-bar-container');
          if (await bulkBar.isVisible()) {
            const cancelBtn = bulkBar.locator('button.bulk-dock-close-btn');
            if (await cancelBtn.isVisible()) {
              await cancelBtn.click();
            }
          }
          break;
        }
        case 5: {
          // Type a quick query in search and clear
          const searchInput = page.locator('.search-input');
          if (await searchInput.isVisible()) {
            await searchInput.fill('Slip');
            await page.waitForTimeout(200);
            await searchInput.fill('');
          }
          break;
        }
      }

      await page.waitForTimeout(200);

      // Invariant Check: The app header and main layout MUST remain mounted without unhandled crash
      await expect(page.locator('.top-nav').first()).toBeVisible();
    }
  });
});
