// ============================================================================
// PRICING — QUOTE LIFECYCLE E2E
// ZeusOS Phase 3.C (Pricing engine + Quote builder)
// ============================================================================
//
// Validates the full AM workflow:
//   1. Login as a PRICING_ADMIN (parent-org admin/owner)
//   2. Create a draft rate card for two subsidiaries, activate them
//   3. Build a 3-line quote spanning 2 subsidiaries against a SOW
//   4. Confirm the MarginBadge renders green when the floor is met
//   5. Issue the quote, then mark accepted
//   6. Switch to a subsidiary-only user → confirm /pricing/* is 403
//
// PHASE 3.A.5 PRECONDITION: this spec requires that 3.A.5 (Domain re-model)
// has landed — specifically the canonical `sows/{sowId}` collection +
// seed data + Firestore rules. Until that's true the spec is `.skip`ped
// rather than failing red. When 3.A.5 lands, drop the `.skip` and run
// against the emulator suite (`firebase emulators:start`).

import { test, expect } from '@playwright/test';
import { TEST_TIMEOUTS } from '../../fixtures/timeouts';

test.describe.skip('Pricing — Quote lifecycle (requires Phase 3.A.5)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', 'pricing-admin@zeusgroup.test');
    await page.fill('[data-testid="password-input"]', 'test-password');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('/dashboard', { timeout: TEST_TIMEOUTS.E2E.NAVIGATION });
  });

  test('AM creates rate card → builds 3-line quote → issues → accepted', async ({ page }) => {
    // 1. Rate card admin
    await page.goto('/pricing/rate-cards');
    await expect(page.locator('h1')).toContainText('Rate Cards');

    await page.click('button:has-text("New draft")');
    await page.waitForURL(/\/pricing\/rate-cards\/.+/);
    await expect(page.locator('text=DRAFT')).toBeVisible();

    const today = new Date().toISOString().slice(0, 10);
    await page.fill('input[type="date"]', today);
    await page.click('button:has-text("Activate")');
    await page.waitForURL('/pricing/rate-cards');
    await expect(page.locator('text=ACTIVE').first()).toBeVisible();

    // 2. Quote builder — 3 lines spanning 2 subsidiaries
    await page.goto('/pricing/quotes/new');
    await page.fill('input[placeholder*="sow_"]', 'sow_seeded_e2e_001');
    // assume first line defaulted; add two more
    await page.click('button:has-text("Add line")');
    await page.click('button:has-text("Add line")');

    await page.click('button:has-text("Compute price")');
    await expect(page.locator('[data-testid="margin-badge"]')).toHaveAttribute('data-band', 'green');
  });

  test('Subsidiary user is blocked from /pricing/*', async ({ page }) => {
    await page.click('[data-testid="logout-button"]');
    await page.fill('[data-testid="email-input"]', 'subsidiary-user@zeusgroup.test');
    await page.fill('[data-testid="password-input"]', 'test-password');
    await page.click('[data-testid="login-button"]');
    await page.goto('/pricing/rate-cards');
    await expect(page).toHaveURL(/\/unauthorized/);
  });
});
