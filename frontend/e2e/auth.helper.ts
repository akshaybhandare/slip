import { Page, expect } from '@playwright/test';

export async function loginAsE2ETester(page: Page) {
  // Pre-authenticate browser context with session cookie
  try {
    await page.request.post('/api/auth/login', {
      data: {
        username: 'e2e_tester',
        password: 'password123'
      }
    });
  } catch {}

  // Navigate to application
  await page.goto('/');

  // If Auth modal is displayed in UI, submit login
  const authOverlay = page.locator('.modal-overlay', { hasText: /Welcome to Slip|Sign In|Create Admin/i });
  if (await authOverlay.isVisible({ timeout: 2000 }).catch(() => false)) {
    const usernameInput = page.locator('.modal-content input[type="text"]');
    const passwordInput = page.locator('.modal-content input[type="password"]');
    const submitBtn = page.locator('.modal-content button[type="submit"]');

    await usernameInput.fill('e2e_tester');
    await passwordInput.fill('password123');
    await submitBtn.click();

    await expect(authOverlay).not.toBeVisible({ timeout: 10000 });
  }

  // Ensure top-nav dashboard is visible and ready
  await expect(page.locator('.top-nav').first()).toBeVisible({ timeout: 10000 });
}
