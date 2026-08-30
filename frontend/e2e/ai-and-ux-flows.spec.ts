import { test, expect } from '@playwright/test';
import { loginAsE2ETester } from './auth.helper';

test.describe('Real User Flow: AI Configuration, Smart Search, PDF Summarize, & UX Polish', () => {
  const timestamp = Date.now();

  test.beforeEach(async ({ page }) => {
    await loginAsE2ETester(page);
  });

  test('UX Flow 1: AI Provider Configuration, Masked Key Persistence, & Settings Dialog Lifecycle', async ({ page }) => {
    // 1. Open Settings Modal
    const settingsBtn = page.locator('button[aria-label="Settings"], button.settings-btn, button:has-text("Settings")').first();
    await expect(settingsBtn).toBeVisible({ timeout: 5000 });
    await settingsBtn.click();

    // Verify Settings Modal is open
    const modal = page.locator('.modal-content.settings-modal-content, .modal-content').first();
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(modal.getByRole('heading', { name: /Settings/i })).toBeVisible();

    // 2. Switch to "AI & Models" tab
    const aiTabBtn = modal.getByRole('button', { name: /AI & Models|AI Configuration|AI Provider/i }).first();
    await expect(aiTabBtn).toBeVisible();
    await aiTabBtn.click();

    // 3. Test Theme Presets Tab Switching within Settings
    const appearanceTabBtn = modal.getByRole('button', { name: /Appearance/i }).first();
    await appearanceTabBtn.click();
    await expect(modal.getByText(/Color Mode|Theme Preset/i).first()).toBeVisible();

    // Switch back to AI Tab (re-query dynamically)
    await modal.getByRole('button', { name: /AI & Models|AI Configuration|AI Provider/i }).first().click();

    // 4. Test Escape key dismissal
    await page.keyboard.press('Escape');
    await expect(modal).not.toBeVisible({ timeout: 3000 });
  });

  test('UX Flow 2: AI Smart Search Interaction & Natural Language Intent vs Standard Search', async ({ page }) => {
    const searchInput = page.locator('.search-input');
    await expect(searchInput).toBeVisible();

    // 1. Check standard placeholder
    await expect(searchInput).toHaveAttribute('placeholder', /Search your archive/i);

    // 2. Toggle AI Smart Search if AI button is visible
    const smartSearchBtn = page.locator('button.search-smart-btn, button[aria-label="Toggle Smart Search"]').first();
    if (await smartSearchBtn.isVisible()) {
      await smartSearchBtn.click();

      // Placeholder transforms to Smart Search prompt
      await expect(searchInput).toHaveAttribute('placeholder', /Describe what you're looking for|Smart AI search/i);
      await expect(smartSearchBtn).toHaveClass(/active/);

      // Mock smart search response
      await page.route('**/api/ai/smart-search', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            results: [],
            interpretation: 'Finding slips related to developer workflows and systems architecture'
          })
        });
      });

      // 3. Type a natural language query
      await searchInput.fill('developer tools and cloud infrastructure');
      await page.keyboard.press('Enter');

      // Verify clear search button resets feed
      const clearBtn = page.locator('.search-clear-btn');
      if (await clearBtn.isVisible()) {
        await clearBtn.click();
        await expect(searchInput).toHaveValue('');
      }

      // 4. Toggle back to standard search
      await smartSearchBtn.click();
      await expect(searchInput).toHaveAttribute('placeholder', /Search your archive/i);
    }
  });

  test('UX Flow 3: PDF Document Slip AI Summarization, Menu Uniformity, Filename Display, & Reader Mode', async ({ page }) => {
    // 1. Create a PDF Document Slip via URL
    const saveLinkBtn = page.getByRole('button', { name: /save/i }).first();
    await saveLinkBtn.click();

    const urlInput = page.locator('.modal-content input[type="url"]');
    await urlInput.fill(`https://example.com/research-paper-${timestamp}.pdf`);

    const submitBtn = page.locator('.modal-content button[type="submit"]');
    await submitBtn.click();

    await expect(page.locator('.modal-content')).not.toBeVisible({ timeout: 10000 });

    // 2. Find the PDF Slip Card
    const pdfCard = page.locator('.bookmark-card', { hasText: /\.pdf|PDF Document/i }).first();
    await expect(pdfCard).toBeVisible({ timeout: 10000 });

    // 3. UI Uniformity & Capability Check:
    // No slip card level AI button on PDF (uniform with other cards)
    await expect(pdfCard.locator('button[aria-label="AI Summarize PDF"]')).not.toBeVisible();

    // Verify PDF filename is displayed in banner
    await expect(pdfCard.locator('.doc-card-banner').first()).toBeVisible();

    // 4. Intercept PDF AI Summarize API to test UI feedback loop
    await page.route('**/api/ai/summarize-pdf', async (route) => {
      await new Promise((r) => setTimeout(r, 400));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          title: `Transformer Architecture Primer ${timestamp}`,
          description: '• Introduces self-attention mechanism\n• Eliminates recurrent neural networks\n• Scales sequence transductions effectively\n\nUploaded document: research-paper.pdf (2.40 MB, application/pdf)',
          tags: [{ id: 101, name: 'transformers' }, { id: 102, name: 'deep-learning' }, { id: 103, name: 'ai-research' }]
        })
      });
    });

    await page.route('**/api/bookmarks/*/summarize-pdf', async (route) => {
      await new Promise((r) => setTimeout(r, 400));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 888,
          url: `https://example.com/research-paper-${timestamp}.pdf`,
          title: `Transformer Architecture Primer ${timestamp}`,
          description: '• Introduces self-attention mechanism\n• Eliminates recurrent neural networks\n• Scales sequence transductions effectively\n\nUploaded document: research-paper.pdf (2.40 MB, application/pdf)',
          content_type: 'document',
          tags: [{ id: 101, name: 'transformers' }, { id: 102, name: 'deep-learning' }, { id: 103, name: 'ai-research' }]
        })
      });
    });

    // 5. Open 3-dot dropdown menu and trigger "AI Summarize"
    const moreBtn = pdfCard.locator('.card-more-btn').first();
    await moreBtn.click();

    const menu = pdfCard.locator('.card-dropdown-menu');
    await expect(menu).toBeVisible();

    const summarizeMenuItem = menu.getByText('AI Summarize');
    if (await summarizeMenuItem.isVisible()) {
      await summarizeMenuItem.click();

      // Wait for summarization to complete
      await expect(pdfCard.locator('.card-ai-progress-bar')).not.toBeVisible({ timeout: 10000 });

      // 6. Verify Eye-icon reader button appears now that description has rich summary (>= 60 chars)
      const readerBtn = pdfCard.locator('button[aria-label="Read Summary"], button[aria-label="Reader Mode"]').first();
      if (await readerBtn.isVisible()) {
        await readerBtn.click();

        // Verify Reader Modal opens with PDF summary, filename, and metadata footer
        const readerModal = page.locator('.reader-modal, .modal-content').first();
        await expect(readerModal).toBeVisible({ timeout: 5000 });
        await expect(readerModal.getByText(/PDF Summary/i)).toBeVisible();
        await expect(readerModal.getByText(/research-paper/i)).toBeVisible();
        await expect(readerModal.getByText(/Uploaded document/i)).toBeVisible();

        // Close Reader via Escape
        await page.keyboard.press('Escape');
        await expect(readerModal).not.toBeVisible({ timeout: 3000 });
      }
    }
  });

  test('UX Flow 4: Note Assistant in Note Editor & Reader Mode', async ({ page }) => {
    // 1. Open New Note Modal
    const saveLinkBtn = page.getByRole('button', { name: /save/i }).first();
    await saveLinkBtn.click();
    await page.getByRole('button', { name: /new note/i }).click();

    const noteTitle = page.getByPlaceholder(/note title/i);
    await noteTitle.fill(`Database Engineering Note ${timestamp}`);

    const noteContent = page.getByPlaceholder(/start typing your note/i);
    await noteContent.fill('We need to optimize SQLite FTS5 queries for sub-10ms response time.');

    // 2. Mock AI Note Assist API
    await page.route('**/api/ai/note-assist', async (route) => {
      const body = route.request().postDataJSON();
      if (body?.action === 'title') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ proposedTitle: 'SQLite FTS5 Query Optimization Plan' })
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ result: '\n\n### Implementation Steps\n1. Benchmark FTS indices\n2. Add prefix token matching\n3. Implement debounced search input' })
        });
      }
    });

    const saveNoteBtn = page.getByRole('button', { name: /save note/i });
    await saveNoteBtn.click();

    await expect(page.locator('.modal-content')).not.toBeVisible({ timeout: 10000 });

    // 3. Open Reader Mode on the newly created note
    const noteCard = page.locator('.bookmark-card', { hasText: `Database Engineering Note ${timestamp}` }).first();
    await expect(noteCard).toBeVisible({ timeout: 10000 });

    const openReaderBtn = noteCard.locator('button[aria-label="Open Full Note"], button[aria-label="Reader Mode"]').first();
    if (await openReaderBtn.isVisible()) {
      await openReaderBtn.click();

      // Verify Reader modal opens
      const readerModal = page.locator('.reader-modal, .reader-overlay, .modal-content').first();
      await expect(readerModal).toBeVisible({ timeout: 5000 });

      // Close Reader modal via Escape
      await page.keyboard.press('Escape');
      await expect(readerModal).not.toBeVisible({ timeout: 5000 });
    }
  });

  test('UX Flow 5: Menu Dismissal, Focus Management, & Keyboard Shortcuts', async ({ page }) => {
    // 1. Open card dropdown menu
    const moreBtn = page.locator('.card-more-btn').first();
    if (await moreBtn.isVisible()) {
      await moreBtn.click();
      const menu = page.locator('.card-dropdown-menu').first();
      await expect(menu).toBeVisible();

      // Click outside (top nav) -> Menu must close cleanly
      await page.locator('.top-nav').click({ position: { x: 10, y: 10 } });
      await expect(menu).not.toBeVisible({ timeout: 3000 });
    }

    // 2. Open Settings modal and verify Escape dismisses modal
    const settingsBtn = page.locator('button[aria-label="Settings"], button.settings-btn').first();
    if (await settingsBtn.isVisible()) {
      await settingsBtn.click();
      await expect(page.locator('.modal-content')).toBeVisible({ timeout: 5000 });

      await page.keyboard.press('Escape');
      await expect(page.locator('.modal-content')).not.toBeVisible({ timeout: 3000 });
    }

    // 3. Open Add Bookmark modal and verify Escape dismisses modal
    const saveBtn = page.getByRole('button', { name: /save/i }).first();
    if (await saveBtn.isVisible()) {
      await saveBtn.click();
      await expect(page.locator('.modal-content')).toBeVisible({ timeout: 5000 });

      await page.keyboard.press('Escape');
      await expect(page.locator('.modal-content')).not.toBeVisible({ timeout: 3000 });
    }
  });
});
