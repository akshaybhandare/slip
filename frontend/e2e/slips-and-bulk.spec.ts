import { test, expect } from '@playwright/test';
import { loginAsE2ETester } from './auth.helper';

test.describe('Real User Flow: Slips Creation, Multi-Select, & Bulk Operations', () => {
  const timestamp = Date.now();

  test.beforeEach(async ({ page }) => {
    await loginAsE2ETester(page);
  });

  test('User creates a Website slip, creates a Note slip, and toggles pin status', async ({ page }) => {
    // 1. Create a Website Slip
    const saveLinkBtn = page.getByRole('button', { name: /save/i }).first();
    await saveLinkBtn.click();

    // Verify Add Bookmark Modal is open
    await expect(page.getByRole('heading', { name: /save to slip/i })).toBeVisible({ timeout: 5000 });

    const urlInput = page.locator('.modal-content input[type="url"]');
    await urlInput.fill('https://news.ycombinator.com');

    // Click "Save Bookmark"
    const submitBtn = page.getByRole('button', { name: /save bookmark/i });
    await submitBtn.click();

    // Verify modal closes and Website Slip card appears in masonry grid
    await expect(page.locator('.modal-content')).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/news\.ycombinator\.com|Hacker News/i).first()).toBeVisible({ timeout: 10000 });

    // 2. Create a Markdown Note Slip
    await saveLinkBtn.click();
    await expect(page.getByRole('heading', { name: /save to slip/i })).toBeVisible({ timeout: 5000 });

    // Switch to "New Note" tab
    const noteTabBtn = page.getByRole('button', { name: /new note/i });
    await noteTabBtn.click();

    const noteTitleInput = page.getByPlaceholder(/note title/i);
    await noteTitleInput.fill(`Sprint Standup Note ${timestamp}`);

    const noteContentInput = page.getByPlaceholder(/start typing your note/i);
    await noteContentInput.fill('## Key Objectives\n- Finish E2E testing suite\n- Validate bulk operations and undo toast.');

    const saveNoteBtn = page.getByRole('button', { name: /save note/i });
    await saveNoteBtn.click();

    // Verify note slip card appears
    await expect(page.locator('.modal-content')).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText(`Sprint Standup Note ${timestamp}`)).toBeVisible({ timeout: 10000 });

    // 3. Toggle Pin on the newly created note slip
    const noteCard = page.locator('.bookmark-card', { hasText: `Sprint Standup Note ${timestamp}` });
    await expect(noteCard).toBeVisible();

    const pinBtn = noteCard.locator('.slip-pushpin-btn, button[aria-label*="pin" i]').first();
    if (await pinBtn.isVisible()) {
      await pinBtn.click();
      // Should now show pinned indicator or active class
      await expect(noteCard.locator('.slip-pinned-indicator, .is-pinned-svg, .is-pinned-card').first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('User selects slips, verifies dynamic BulkActionBar, and executes Bulk Delete with Undo', async ({ page }) => {
    // Ensure we have selectable slips in the grid
    const selectCheckboxes = page.locator('button.card-select-checkbox-btn');
    const count = await selectCheckboxes.count();

    if (count === 0) {
      // Create a quick slip if empty
      const saveLinkBtn = page.getByRole('button', { name: /save/i }).first();
      await saveLinkBtn.click();
      await page.getByRole('button', { name: /new note/i }).click();
      await page.getByPlaceholder(/note title/i).fill(`Bulk Test Note ${timestamp}`);
      await page.getByPlaceholder(/start typing your note/i).fill('Testing multi-select and delete.');
      await page.getByRole('button', { name: /save note/i }).click();
      await expect(page.locator('.modal-content')).not.toBeVisible({ timeout: 10000 });
    }

    // 1. Select the first slip card
    const firstCheckbox = selectCheckboxes.first();
    await expect(firstCheckbox).toBeVisible({ timeout: 5000 });
    await firstCheckbox.click();

    // 2. Floating Bulk Action Bar should become visible
    const bulkBar = page.locator('.bulk-action-bar-container, [role="toolbar"]');
    await expect(bulkBar).toBeVisible({ timeout: 5000 });

    // Verify counter shows at least 1 selected
    await expect(bulkBar.locator('.bulk-dock-count-number')).toHaveText(/[1-9]\d*/);

    // 3. Click "Select All" toggle
    const selectAllBtn = bulkBar.locator('.bulk-dock-select-all-btn');
    if (await selectAllBtn.isVisible()) {
      await selectAllBtn.click();
      await expect(bulkBar.getByText(/Deselect All/i)).toBeVisible();
    }

    // 4. Trigger Bulk Delete
    const deleteBtn = bulkBar.getByRole('button', { name: /delete/i });
    await deleteBtn.click();

    // 5. Verify Instant Undo Toast appears
    const undoToast = page.locator('.undo-toast');
    await expect(undoToast).toBeVisible({ timeout: 5000 });
    await expect(undoToast.getByText(/moved .* to recycle clip/i)).toBeVisible();

    // 6. Click "Undo" to restore slips
    const undoActionBtn = undoToast.locator('.btn-undo-action');
    await expect(undoActionBtn).toBeVisible();
    await undoActionBtn.click();

    // Toast should dismiss and slips be restored
    await expect(undoToast).not.toBeVisible({ timeout: 5000 });
  });

  test('User performs live search query and switches content filter tabs', async ({ page }) => {
    const searchInput = page.locator('.search-input');
    await expect(searchInput).toBeVisible({ timeout: 5000 });

    // Perform live search
    await searchInput.fill('Standup');
    await page.waitForTimeout(400); // Debounce wait

    // Clear search
    const clearBtn = page.locator('.search-clear-btn');
    if (await clearBtn.isVisible()) {
      await clearBtn.click();
    } else {
      await searchInput.fill('');
    }

    // Switch filter tabs (e.g. "Notes")
    const notesFilterTab = page.getByRole('button', { name: /^notes$/i });
    if (await notesFilterTab.isVisible()) {
      await notesFilterTab.click();
      await expect(notesFilterTab).toHaveClass(/active/);

      // Switch back to "All"
      const allFilterTab = page.getByRole('button', { name: /^all$/i });
      await allFilterTab.click();
      await expect(allFilterTab).toHaveClass(/active/);
    }
  });
});
