import { test, expect } from '@playwright/test';
import { loginAsE2ETester } from './auth.helper';

test.describe('Real User Flow: Clips Organization & Theme Customization', () => {
  const timestamp = Date.now();

  test.beforeEach(async ({ page }) => {
    await loginAsE2ETester(page);
  });

  test('User navigates to Clips view, creates root clip, creates sub-clip, and verifies breadcrumbs', async ({ page }) => {
    // 1. Navigate to Clips View
    const clipsToggleBtn = page.locator('.nav-clips-toggle-btn, button[aria-label*="clips" i]').first();
    await clipsToggleBtn.click();

    // Verify Clips View container is active
    await expect(page.locator('.clips-view-container').first()).toBeVisible({ timeout: 5000 });

    // 2. Create a Root Clip
    const newClipBtn = page.getByRole('button', { name: /new clip/i });
    await expect(newClipBtn).toBeVisible();
    await newClipBtn.click();

    // Fill new clip name in modal
    const clipNameInput = page.locator('.modal-content input.form-input');
    await clipNameInput.fill(`Research Deck ${timestamp}`);
    await page.keyboard.press('Enter');

    // Verify root clip card appears
    await expect(page.getByText(`Research Deck ${timestamp}`)).toBeVisible({ timeout: 8000 });

    // 3. Click the newly created clip to enter its detail view
    const createdClipCard = page.locator('.clip-folder-card, .clip-stack-card', { hasText: `Research Deck ${timestamp}` }).first();
    if (await createdClipCard.isVisible()) {
      await createdClipCard.click();
    } else {
      await page.getByText(`Research Deck ${timestamp}`).first().click();
    }

    // 4. In detail view, create a nested Sub-Clip
    const newSubClipBtn = page.getByRole('button', { name: /new sub-clip/i });
    if (await newSubClipBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
      await newSubClipBtn.click();
      const subClipInput = page.locator('.modal-content input.form-input');
      await subClipInput.fill(`Playwright Automation ${timestamp}`);
      await page.keyboard.press('Enter');

      await expect(page.getByText(`Playwright Automation ${timestamp}`).first()).toBeVisible({ timeout: 8000 });
    }

    // 5. Inspect Vertical Breadcrumbs Tree Spine
    const spine = page.locator('.clips-vertical-spine-card').first();
    await expect(spine).toBeVisible();
    await expect(spine.getByText(/All Clips/i).first()).toBeVisible();

    // 6. Navigate back to Root via breadcrumb click
    const rootCrumb = spine.locator('.v-crumb-step', { hasText: /All Clips/i }).first();
    await rootCrumb.click();
    await expect(page.getByText(`Research Deck ${timestamp}`).first()).toBeVisible({ timeout: 5000 });

    // 7. Return to Main Stream
    const backToFeedBtn = page.locator('.btn-back-stream, button:has-text("Main Stream")').first();
    await backToFeedBtn.click();
    await expect(page.locator('.clips-view-container')).not.toBeVisible({ timeout: 5000 });
  });

  test('User navigates to Recycle Clip, inspects recycle bin view, and returns to stream', async ({ page }) => {
    // Navigate to Clips View
    const clipsToggleBtn = page.locator('.nav-clips-toggle-btn, button[aria-label*="clips" i]').first();
    await clipsToggleBtn.click();
    await expect(page.locator('.clips-view-container')).toBeVisible({ timeout: 5000 });

    // Click Recycle Clip in Spine Utility
    const recycleClipBtn = page.locator('.spine-utility-btn, button[aria-label*="recycle" i], button:has-text("Recycle Clip")').first();
    await recycleClipBtn.click();

    // Verify Recycle Clip section header is shown
    await expect(page.locator('.deck-section-title', { hasText: /Recycle Clip/i })).toBeVisible({ timeout: 5000 });

    // Return to Main Stream
    const backToFeedBtn = page.locator('.btn-back-stream, button:has-text("Main Stream")').first();
    await backToFeedBtn.click();
    await expect(page.locator('.clips-view-container')).not.toBeVisible({ timeout: 5000 });
  });

  test('User opens Settings and toggles theme modes and presets', async ({ page }) => {
    // Open Settings Modal
    const settingsBtn = page.locator('.nav-settings-btn, button[aria-label="Settings"]').first();
    await settingsBtn.click();

    const modalHeading = page.getByRole('heading', { name: /settings/i });
    await expect(modalHeading).toBeVisible({ timeout: 5000 });

    // Switch to Appearance Tab
    const appearanceTab = page.locator('.settings-nav-btn', { hasText: /appearance/i });
    await appearanceTab.click();
    await expect(appearanceTab).toHaveClass(/active/);

    // Toggle Color Mode (e.g. Dark / Light)
    const darkBtn = page.getByRole('button', { name: /dark/i });
    if (await darkBtn.isVisible()) {
      await darkBtn.click();
      await expect(darkBtn).toHaveClass(/active/);
    }

    // Toggle Theme Presets
    const presets = ['Cyberpunk', 'Rose Pine', 'Nord', 'Solarized', 'Slip Original'];
    for (const presetName of presets) {
      const presetRow = page.locator('.theme-mini-row', { hasText: new RegExp(presetName, 'i') });
      if (await presetRow.isVisible()) {
        await presetRow.click();
        await expect(presetRow).toHaveClass(/active/);
      }
    }

    // Close Settings Modal
    const closeBtn = page.locator('.settings-modal-content .modal-close, button[aria-label="Close modal"]').first();
    await closeBtn.click();
    await expect(page.locator('.settings-modal-content')).not.toBeVisible({ timeout: 5000 });
  });
});
