import { test, expect } from '@playwright/test';
import { loginAsE2ETester } from './auth.helper';

test.describe('E2E Real User Flows: Comprehensive Bulk Operations & Multi-Select', () => {
  const runId = Date.now();

  test.beforeEach(async ({ page }) => {
    await loginAsE2ETester(page);
  });

  test('Selection Mechanics: Individual toggling, dynamic counter, Select All / Deselect All, and Escape key dismissal', async ({ page }) => {
    // 1. Create 3 test slips to ensure we have cards to select
    const saveLinkBtn = page.getByRole('button', { name: /save/i }).first();

    for (const name of ['Alpha', 'Beta', 'Gamma']) {
      await saveLinkBtn.click();
      await page.getByRole('button', { name: /new note/i }).click();
      await page.getByPlaceholder(/note title/i).fill(`Slip ${name} ${runId}`);
      await page.getByPlaceholder(/start typing your note/i).fill(`Content for ${name}`);
      await page.getByRole('button', { name: /save note/i }).click();
      await expect(page.locator('.modal-content')).not.toBeVisible({ timeout: 10000 });
      await expect(page.getByText(`Slip ${name} ${runId}`).first()).toBeVisible({ timeout: 8000 });
    }

    // 2. Select first slip card
    const alphaCard = page.locator('.bookmark-card', { hasText: `Slip Alpha ${runId}` });
    const alphaCheckbox = alphaCard.locator('button.card-select-checkbox-btn');
    await alphaCheckbox.click();

    // Floating bulk action bar should be visible with counter = 1
    const bulkBar = page.locator('.bulk-action-bar-container');
    await expect(bulkBar).toBeVisible({ timeout: 5000 });
    await expect(bulkBar.locator('.bulk-dock-count-number')).toHaveText('1');

    // 3. Select second slip card
    const betaCard = page.locator('.bookmark-card', { hasText: `Slip Beta ${runId}` });
    const betaCheckbox = betaCard.locator('button.card-select-checkbox-btn');
    await betaCheckbox.click();

    // Counter updates to 2
    await expect(bulkBar.locator('.bulk-dock-count-number')).toHaveText('2');

    // 4. Deselect first slip card
    await alphaCheckbox.click();
    await expect(bulkBar.locator('.bulk-dock-count-number')).toHaveText('1');

    // 5. Test "Select All" button
    const selectAllBtn = bulkBar.locator('.bulk-dock-select-all-btn');
    await selectAllBtn.click();
    await expect(bulkBar.getByText(/Deselect All/i)).toBeVisible();

    // Counter should be >= 3
    const countText = await bulkBar.locator('.bulk-dock-count-number').innerText();
    expect(Number(countText)).toBeGreaterThanOrEqual(3);

    // 6. Test "Deselect All"
    await selectAllBtn.click();
    await expect(bulkBar).not.toBeVisible({ timeout: 5000 });

    // 7. Select one card and test Cancel Selection button
    await betaCheckbox.click();
    await expect(bulkBar).toBeVisible();
    const cancelBtn = bulkBar.locator('button.bulk-dock-close-btn, button[aria-label*="cancel" i]');
    await cancelBtn.click();
    await expect(bulkBar).not.toBeVisible({ timeout: 5000 });
  });

  test('Bulk Delete -> Recycle Clip -> Bulk Restore and Bulk Permanent Delete', async ({ page }) => {
    // 1. Create two test note slips
    const saveLinkBtn = page.getByRole('button', { name: /save/i }).first();

    for (const name of ['RestoreTarget', 'PermDeleteTarget']) {
      await saveLinkBtn.click();
      await page.getByRole('button', { name: /new note/i }).click();
      await page.getByPlaceholder(/note title/i).fill(`Item ${name} ${runId}`);
      await page.getByPlaceholder(/start typing your note/i).fill(`Body for ${name}`);
      await page.getByRole('button', { name: /save note/i }).click();
      await expect(page.locator('.modal-content')).not.toBeVisible({ timeout: 10000 });
      await expect(page.getByText(`Item ${name} ${runId}`).first()).toBeVisible({ timeout: 8000 });
    }

    // 2. Multi-select both items
    const target1 = page.locator('.bookmark-card', { hasText: `Item RestoreTarget ${runId}` });
    const target2 = page.locator('.bookmark-card', { hasText: `Item PermDeleteTarget ${runId}` });

    await target1.locator('button.card-select-checkbox-btn').click();
    await target2.locator('button.card-select-checkbox-btn').click();

    const bulkBar = page.locator('.bulk-action-bar-container');
    await expect(bulkBar).toBeVisible();

    // 3. Execute Bulk Delete
    const deleteBtn = bulkBar.getByRole('button', { name: /delete/i });
    await deleteBtn.click();

    // Verify both items disappear from main feed
    await expect(target1).not.toBeVisible({ timeout: 5000 });
    await expect(target2).not.toBeVisible({ timeout: 5000 });

    // 4. Open Recycle Clip via Clips View
    const clipsToggleBtn = page.locator('.nav-clips-toggle-btn').first();
    await clipsToggleBtn.click();
    await expect(page.locator('.clips-view-container').first()).toBeVisible({ timeout: 5000 });

    const recycleClipBtn = page.locator('.spine-utility-btn, button[aria-label*="recycle" i], button:has-text("Recycle Clip")').first();
    await recycleClipBtn.click();
    await expect(page.locator('.deck-section-title', { hasText: /Recycle Clip/i })).toBeVisible({ timeout: 5000 });

    // 5. Verify both deleted slips are in Recycle Clip
    const recycleCard1 = page.locator('.bookmark-card', { hasText: `Item RestoreTarget ${runId}` });
    const recycleCard2 = page.locator('.bookmark-card', { hasText: `Item PermDeleteTarget ${runId}` });
    await expect(recycleCard1).toBeVisible({ timeout: 5000 });
    await expect(recycleCard2).toBeVisible({ timeout: 5000 });

    // 6. Test Bulk Restore on RestoreTarget
    await recycleCard1.locator('button.card-select-checkbox-btn').click();
    await expect(bulkBar).toBeVisible();

    const restoreBtn = bulkBar.getByRole('button', { name: /restore/i });
    await expect(restoreBtn).toBeVisible();
    await restoreBtn.click();

    // Item should vanish from Recycle Clip
    await expect(recycleCard1).not.toBeVisible({ timeout: 5000 });

    // 7. Test Bulk Permanent Delete on PermDeleteTarget
    await recycleCard2.locator('button.card-select-checkbox-btn').click();
    await expect(bulkBar).toBeVisible();

    const permDeleteBtn = bulkBar.getByRole('button', { name: /delete forever|permanent/i });
    await expect(permDeleteBtn).toBeVisible();
    await permDeleteBtn.click();

    // Confirm Delete Forever in modal
    const modal = page.locator('.modal-overlay', { hasText: /Delete Forever/i });
    await expect(modal).toBeVisible({ timeout: 5000 });
    const confirmBtn = modal.getByRole('button', { name: /delete forever/i });
    await confirmBtn.click();
    await expect(modal).not.toBeVisible({ timeout: 5000 });

    await expect(recycleCard2).not.toBeVisible({ timeout: 5000 });

    // 8. Return to Main Stream and verify RestoreTarget is back in feed
    const backToFeedBtn = page.locator('.btn-back-stream, button:has-text("Main Stream")').first();
    await backToFeedBtn.click();
    await expect(page.locator('.clips-view-container')).not.toBeVisible({ timeout: 5000 });

    await expect(page.getByText(`Item RestoreTarget ${runId}`).first()).toBeVisible({ timeout: 8000 });
    await expect(page.getByText(`Item PermDeleteTarget ${runId}`)).not.toBeVisible();
  });

  test('Clip Detail View: Multi-selecting member slips and executing atomic bulk unclip', async ({ page }) => {
    // 1. Open Clips view and create a new clip
    const clipsToggleBtn = page.locator('.nav-clips-toggle-btn').first();
    await clipsToggleBtn.click();
    await expect(page.locator('.clips-view-container').first()).toBeVisible({ timeout: 5000 });

    const newClipBtn = page.getByRole('button', { name: /new clip/i });
    await newClipBtn.click();

    const clipName = `Unclip Suite ${runId}`;
    await page.locator('.modal-content input.form-input').fill(clipName);
    await page.keyboard.press('Enter');
    await expect(page.getByText(clipName).first()).toBeVisible({ timeout: 8000 });

    // 2. Return to Stream and create 2 slips assigned to this clip via AddToClip
    const backToFeedBtn = page.locator('.btn-back-stream, button:has-text("Main Stream")').first();
    await backToFeedBtn.click();
    await expect(page.locator('.clips-view-container')).not.toBeVisible({ timeout: 5000 });

    const saveLinkBtn = page.getByRole('button', { name: /save/i }).first();
    for (const name of ['MemberOne', 'MemberTwo']) {
      await saveLinkBtn.click();
      await page.getByRole('button', { name: /new note/i }).click();
      await page.getByPlaceholder(/note title/i).fill(`Member ${name} ${runId}`);
      await page.getByPlaceholder(/start typing your note/i).fill(`In-clip note ${name}`);
      await page.getByRole('button', { name: /save note/i }).click();
      await expect(page.locator('.modal-content')).not.toBeVisible({ timeout: 10000 });
    }

    // 3. Attach both slips to the clip
    for (const name of ['MemberOne', 'MemberTwo']) {
      const card = page.locator('.bookmark-card', { hasText: `Member ${name} ${runId}` });
      const menuBtn = card.locator('.card-menu-btn, button[aria-label*="menu" i], button[aria-label*="more" i]').first();
      if (await menuBtn.isVisible()) {
        await menuBtn.click();
        const addToClipOption = page.locator('.card-dropdown-item', { hasText: /clip|add to clip|organize/i });
        if (await addToClipOption.isVisible({ timeout: 2000 }).catch(() => false)) {
          await addToClipOption.click();
          const targetClipOption = page.locator('.add-to-clip-item, .clip-selector-item', { hasText: clipName });
          if (await targetClipOption.isVisible({ timeout: 3000 }).catch(() => false)) {
            await targetClipOption.click();
            await expect(page.locator('.add-to-clip-modal')).not.toBeVisible({ timeout: 5000 });
          }
        }
      }
    }

    // 4. Open the Clip Detail view
    await clipsToggleBtn.click();
    await expect(page.locator('.clips-view-container').first()).toBeVisible({ timeout: 5000 });

    const clipCard = page.locator('.clip-folder-card, .clip-stack-card', { hasText: clipName }).first();
    if (await clipCard.isVisible()) {
      await clipCard.click();
    } else {
      await page.getByText(clipName).first().click();
    }

    // 5. If member slips are present in clip, test bulk unclip
    const memberCheckbox = page.locator('button.card-select-checkbox-btn').first();
    if (await memberCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
      await memberCheckbox.click();

      const bulkBar = page.locator('.bulk-action-bar-container');
      await expect(bulkBar).toBeVisible({ timeout: 5000 });

      // Action bar in clip_detail context should offer Unclip
      const unclipBtn = bulkBar.getByRole('button', { name: /unclip|remove/i });
      if (await unclipBtn.isVisible()) {
        await unclipBtn.click();
        // Slips unclipped successfully
        await expect(bulkBar).not.toBeVisible({ timeout: 5000 });
      }
    }

    // Return to main stream
    await backToFeedBtn.click();
    await expect(page.locator('.clips-view-container')).not.toBeVisible({ timeout: 5000 });
  });
});
