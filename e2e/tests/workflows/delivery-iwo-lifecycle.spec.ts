// ============================================================================
// DELIVERY — Subsidiary IWO lifecycle E2E
// ZeusOS Phase 3.E (Subsidiary delivery workspace)
// ============================================================================
//
// Validates the receiving end of the handoff engine:
//   1. Login as a delivery lead of `zeus-the-agency`.
//   2. Confirm the delivery inbox lists their issued IWOs and nothing
//      from another subsidiary.
//   3. Accept an IWO.
//   4. Start work (ACCEPTED → IN_PROGRESS).
//   5. Post a time entry; confirm the burn meter advances.
//   6. Submit a deliverable.
//   7. Switch to a parent-org user; confirm /delivery/inbox redirects
//      to /unauthorized (or /admin/iwo/:id once 3.D ships).
//
// PHASE 3.B + emulator PRECONDITION: end-to-end seeding requires a
// running Cloud Functions emulator with 3.B's IWO state machine deployed
// AND seed IWOs in `internal_work_orders`. Until the workflow emulator
// is part of CI this spec is `.skip`ped rather than failing red.

import { test, expect } from '@playwright/test';
import { TEST_TIMEOUTS } from '../../fixtures/timeouts';

test.describe.skip('Delivery — IWO lifecycle (requires Phase 3.B + emulator seed)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', 'delivery-lead-zta@zeusgroup.test');
    await page.fill('[data-testid="password-input"]', 'test-password');
    await page.click('[data-testid="login-button"]');
    await page.waitForURL(/\/(strategy|delivery)/, { timeout: TEST_TIMEOUTS.E2E.NAVIGATION });
  });

  test('subsidiary lead accepts → starts → posts time → submits deliverable', async ({ page }) => {
    await page.goto('/delivery/inbox');
    await expect(page.locator('h1')).toContainText('Delivery Inbox');

    // Inbox row for our seeded IWO
    const row = page.locator('tr', { hasText: 'IWO-ZTA-SEED-001' });
    await expect(row).toBeVisible();
    await row.locator('button', { hasText: 'Accept' }).click();

    // Open the workspace
    await page.goto('/delivery/iwo/iwo-seed-001');
    await expect(page.locator('h1')).toContainText('IWO-ZTA-SEED-001');

    // Move to IN_PROGRESS
    await page.click('button:has-text("Start work")');
    await expect(page.locator('text=IN_PROGRESS')).toBeVisible();

    // Post 60 minutes
    await page.fill('input[type="number"]', '60');
    await page.click('button:has-text("Post time")');
    await expect(page.locator('text=/% used/')).toBeVisible();

    // Submit a deliverable
    const assetInput = page.locator('input[type="text"]').last();
    await assetInput.fill('asset-seed-001');
    await page.click('button:has-text("Submit deliverable")');
    await expect(page.locator('text=DELIVERED')).toBeVisible();
  });

  test('subsidiary inbox does not surface another subsidiary\'s IWOs', async ({ page }) => {
    await page.goto('/delivery/inbox');
    // The seed deck issues an IWO to `labyrinth` — it must not appear
    // for a `zeus-the-agency` user.
    await expect(page.locator('text=IWO-LAB-SEED-001')).toHaveCount(0);
  });

  test('subsidiary user cannot reach /pricing/*', async ({ page }) => {
    await page.goto('/pricing/rate-cards');
    await page.waitForURL('/unauthorized', { timeout: TEST_TIMEOUTS.E2E.NAVIGATION });
  });

  test('parent-org user is redirected away from /delivery/inbox', async ({ page }) => {
    // Sign out, sign back in as AM
    await page.goto('/auth/login');
    await page.fill('[data-testid="email-input"]', 'am@zeusgroup.test');
    await page.fill('[data-testid="password-input"]', 'test-password');
    await page.click('[data-testid="login-button"]');
    await page.goto('/delivery/inbox');
    // Either /unauthorized or (when 3.D ships) /admin/iwo/...
    await expect(page.url()).toMatch(/(unauthorized|admin\/iwo)/);
  });
});
