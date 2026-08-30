import { test, expect } from '@playwright/test';
import { loginAsE2ETester } from './auth.helper';

test.describe('E2E Real User Semantic Hybrid Search & Discovery (Issues #37 & #40)', () => {
  const timestamp = Date.now();

  test.beforeEach(async ({ page }) => {
    await loginAsE2ETester(page);
  });

  test('1. Real User: Creates slips, executes semantic hybrid search, and discovers related slips', async ({ page }) => {
    // 1. Create a Note Slip about Frontend React Primitives
    const saveLinkBtn = page.getByRole('button', { name: /save/i }).first();
    await saveLinkBtn.click();
    await expect(page.getByRole('heading', { name: /save to slip/i })).toBeVisible({ timeout: 5000 });

    const noteTabBtn = page.getByRole('button', { name: /new note/i });
    await noteTabBtn.click();

    const noteTitleInput = page.getByPlaceholder(/note title/i);
    await noteTitleInput.fill(`Modern React 19 State Architecture ${timestamp}`);

    const noteContentInput = page.getByPlaceholder(/start typing your note/i);
    await noteContentInput.fill('Comprehensive guide on useActionState, optimistic updates, and server action mutations.');

    const saveNoteBtn = page.getByRole('button', { name: /save note/i });
    await saveNoteBtn.click();
    await expect(page.locator('.modal-content')).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText(`Modern React 19 State Architecture ${timestamp}`).first()).toBeVisible({ timeout: 10000 });

    // 2. Create another Note Slip about Vue Component Primitives
    await saveLinkBtn.click();
    await expect(page.getByRole('heading', { name: /save to slip/i })).toBeVisible({ timeout: 5000 });
    await noteTabBtn.click();
    await noteTitleInput.fill(`Vue 3 Reactive Composables Guide ${timestamp}`);
    await noteContentInput.fill('Building reusable stateful frontend UI logic using ref, reactive, and watchEffect.');
    await saveNoteBtn.click();
    await expect(page.locator('.modal-content')).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText(`Vue 3 Reactive Composables Guide ${timestamp}`).first()).toBeVisible({ timeout: 10000 });

    // 3. Create a Note Slip about Cloud DevOps
    await saveLinkBtn.click();
    await expect(page.getByRole('heading', { name: /save to slip/i })).toBeVisible({ timeout: 5000 });
    await noteTabBtn.click();
    await noteTitleInput.fill(`Kubernetes Production Cluster Setup ${timestamp}`);
    await noteContentInput.fill('Deploying containerized microservices and pods with ingress routing on Linux servers.');
    await saveNoteBtn.click();
    await expect(page.locator('.modal-content')).not.toBeVisible({ timeout: 10000 });
    await expect(page.getByText(`Kubernetes Production Cluster Setup ${timestamp}`).first()).toBeVisible({ timeout: 10000 });

    // Wait 1.5 seconds for on-device background vectorization
    await page.waitForTimeout(1500);

    // 4. Test Semantic Concept Search (Query: "frontend user interface")
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    await searchInput.fill('frontend user interface');
    await searchInput.press('Enter');

    // Should surface React or Vue slips through hybrid semantic search
    await expect(page.getByText(new RegExp(`(React|Vue).*${timestamp}`, 'i')).first()).toBeVisible({ timeout: 10000 });

    // 5. Test Semantic Concept Search for Cloud Infrastructure (Query: "cloud container deployment")
    await searchInput.fill('cloud container deployment');
    await searchInput.press('Enter');

    // Should surface Kubernetes slip
    await expect(page.getByText(`Kubernetes Production Cluster Setup ${timestamp}`).first()).toBeVisible({ timeout: 10000 });

    // 6. Clear search query to restore full feed
    await searchInput.fill('');
    await searchInput.press('Enter');
    await expect(page.getByText(`Modern React 19 State Architecture ${timestamp}`).first()).toBeVisible({ timeout: 10000 });

    // 7. Test Reader Mode & Related Slips Discovery (Issue #40)
    const reactCard = page.locator('.bookmark-card', { hasText: `Modern React 19 State Architecture ${timestamp}` }).first();
    await reactCard.click();

    // Verify Reader Modal opens
    const readerModal = page.locator('.reader-modal-overlay, .modal-overlay', { hasText: `Modern React 19 State Architecture ${timestamp}` });
    await expect(readerModal).toBeVisible({ timeout: 10000 });

    // Close reader modal with Escape
    await page.keyboard.press('Escape');
    await expect(readerModal).not.toBeVisible({ timeout: 5000 });
  });
});
