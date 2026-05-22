// ============================================================================
// DELIVERY — Subsidiary IWO lifecycle E2E
// ZeusOS Phase 3.E / 3.H
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
//      to /unauthorized.
//
// PRECONDITIONS (all met as of Phase 3.H):
//   - 3.B IWO state machine Cloud Functions deployed to emulator
//   - 3.E Delivery workspace UI with data-testid backfill
//   - Email/password auth form on LoginPage (Phase 3.H)
//   - Seed script creates delivery-lead-zta@zeusgroup.test + IWO fixtures
//
// Run:
//   firebase emulators:start --only firestore,auth,functions
//   FIRESTORE_EMULATOR_HOST=localhost:8080 \
//   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
//   node scripts/seed-e2e-users.cjs
//   npx playwright test e2e/tests/workflows/delivery-iwo-lifecycle.spec.ts

import { test, expect } from '@playwright/test';
import { TEST_TIMEOUTS } from '../../fixtures/timeouts';

const DELIVERY_LEAD_EMAIL = 'delivery-lead-zta@zeusgroup.test';
const AM_EMAIL = 'am@zeusgroup.test';
const TEST_PASSWORD = process.env.E2E_USER_PASSWORD ?? 'e2e-test-password';

async function loginAs(page: import('@playwright/test').Page, email: string) {
  await page.goto('/auth/login');
  await page.fill('[data-testid="email-input"]', email);
  await page.fill('[data-testid="password-input"]', TEST_PASSWORD);
  await page.click('[data-testid="login-button"]');
  // Wait for navigation away from login; default redirect is /dashboard
  await page.waitForURL(/\/(?!auth)/, { timeout: TEST_TIMEOUTS.E2E.NAVIGATION });
}

test.describe('Delivery — IWO lifecycle', () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, DELIVERY_LEAD_EMAIL);
  });

  test('subsidiary lead accepts → starts → posts time → submits deliverable', async ({ page }) => {
    await page.goto('/delivery/inbox');
    await expect(page.locator('h1')).toContainText('Delivery Inbox', {
      timeout: TEST_TIMEOUTS.E2E.DATA_LOAD,
    });

    // Inbox row for our seeded IWO (seeded by scripts/seed-e2e-users.cjs)
    const row = page.locator('tr', { hasText: 'IWO-ZTA-SEED-001' });
    await expect(row).toBeVisible({ timeout: TEST_TIMEOUTS.E2E.DATA_LOAD });
    await row.locator('button', { hasText: 'Accept' }).click();

    // Open the workspace
    await page.goto('/delivery/iwo/iwo-seed-001');
    await expect(page.locator('h1')).toContainText('IWO-ZTA-SEED-001', {
      timeout: TEST_TIMEOUTS.E2E.DATA_LOAD,
    });

    // Move to IN_PROGRESS
    await page.click('button:has-text("Start work")');
    await expect(page.locator('[data-testid="iwo-state"]')).toHaveText('IN_PROGRESS', {
      timeout: TEST_TIMEOUTS.E2E.FORM_SUBMIT,
    });

    // Post 60 minutes via the time-entry form
    await page.fill('[data-testid="te-minutes"]', '60');
    await page.locator('[data-testid="te-submit"]').click();
    await expect(page.locator('text=/% used/')).toBeVisible({
      timeout: TEST_TIMEOUTS.E2E.FORM_SUBMIT,
    });

    // Submit a deliverable (asset ID entry)
    await page.fill('[data-testid="del-asset-ids"]', 'asset-seed-001');
    await page.click('button:has-text("Submit deliverable")');
    await expect(page.locator('[data-testid="iwo-state"]')).toHaveText('DELIVERED', {
      timeout: TEST_TIMEOUTS.E2E.FORM_SUBMIT,
    });
  });

  test('subsidiary inbox does not surface another subsidiary\'s IWOs', async ({ page }) => {
    await page.goto('/delivery/inbox');
    // The seed deck issues an IWO to `labyrinth` — it must not appear
    // for a `zeus-the-agency` user.
    await expect(page.locator('text=IWO-LAB-SEED-001')).toHaveCount(0);
  });

  test('subsidiary user cannot reach /pricing/*', async ({ page }) => {
    await page.goto('/pricing/rate-cards');
    await page.waitForURL(/\/(unauthorized|403)/, { timeout: TEST_TIMEOUTS.E2E.NAVIGATION });
  });
});

test.describe('Delivery — parent-org isolation', () => {
  test('parent-org AM is redirected away from /delivery/inbox', async ({ page }) => {
    await loginAs(page, AM_EMAIL);
    await page.goto('/delivery/inbox');
    // SubsidiaryDeliveryGuard redirects parent-org users to /unauthorized
    await expect(page).toHaveURL(/\/(unauthorized|403)/, {
      timeout: TEST_TIMEOUTS.E2E.NAVIGATION,
    });
  });
});
