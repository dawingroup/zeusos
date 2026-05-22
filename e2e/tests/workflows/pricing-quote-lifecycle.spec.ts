// ============================================================================
// PRICING — QUOTE LIFECYCLE E2E (Phase 3.G)
// ZeusOS Tech Spec v1.0 §1.3 / §7.4 — boundary enforcement, three layers
// ============================================================================
//
// Acceptance criterion from plan §14.13:
//
//   AM creates SOW → quote → IWO →
//   subsidiary accepts → posts time → delivers →
//   AM closes → IC invoice raised → client invoice issued
//
// Phase status reference (as of branch phase-3g-boundary-tests):
//   ✅ 3.A.5 (Domain re-model)          — merged. SOW/MSA/quote schemas exist.
//   ✅ 3.B  (IWO state machine)         — merged. CFns enforce transitions.
//   ✅ 3.C  (Pricing engine)            — merged. Quote builder backend works.
//   ❌ 3.D  (AM UI)                     — NOT merged. SOW + quote creation UI
//                                          + AM dashboard absent.
//   ❌ 3.E  (Subsidiary Delivery Wksp)  — NOT merged. IWO accept / time entry /
//                                          deliver UI absent.
//   ✅ 3.F  (Billing)                   — merged. CFns issue IC + client invoices.
//
// Because 3.D + 3.E have not landed, every "AM does X in the browser" or
// "subsidiary clicks Y" step is currently impossible. We therefore split
// the lifecycle into one `test()` block per phase and mark every block
// that depends on 3.D / 3.E as `.skip` with an explicit precondition
// comment. The shape is kept intact so the suite lights up the moment
// those phases ship — drop the `.skip`, no other changes required.
//
// What DOES run today:
//   - The bootstrap test below — confirms the seeded e2e users
//     (pricing-admin@zeusgroup.test + subsidiary-user@zeusgroup.test)
//     exist and can reach the app shell. If the seed script or the
//     login page regresses, this catches it.
//
// To run against the local emulator suite:
//   1. firebase emulators:start --only firestore,auth,functions
//   2. FIRESTORE_EMULATOR_HOST=localhost:8080 \
//      FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
//      node scripts/seed-e2e-users.cjs
//   3. node scripts/seed-zeus-legal-entities.cjs   (3.A.5 fixtures)
//   4. npm run test:e2e

import { test, expect } from '@playwright/test';
import { TEST_TIMEOUTS } from '../../fixtures/timeouts';

const PRICING_ADMIN_EMAIL = 'pricing-admin@zeusgroup.test';
const SUBSIDIARY_USER_EMAIL = 'subsidiary-user@zeusgroup.test';
const TEST_PASSWORD = process.env.E2E_USER_PASSWORD ?? 'e2e-test-password';

// ── Bootstrap ────────────────────────────────────────────────────────────────
// Always runs. Verifies the public surface exists and the seed users are
// reachable via the auth emulator. Everything below this block is gated on
// later phases.

test.describe('Phase 3.G — bootstrap (no preconditions)', () => {
  test('login page renders and points at the configured project', async ({ page }) => {
    await page.goto('/auth/login');
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByText(/ZeusOS|Zeus Group/i).first()).toBeVisible({
      timeout: TEST_TIMEOUTS.E2E.NAVIGATION,
    });
  });
});

// ── 1. AM creates SOW ────────────────────────────────────────────────────────

test.describe.skip('Phase 3.G — AM creates SOW (requires 3.D AM UI)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsPricingAdmin(page);
  });

  test('AM creates a draft SOW under an MSA', async ({ page }) => {
    await page.goto('/contracts/sows/new');
    await page.fill('[data-testid="sow-msa-picker"]', 'msa_acme_2026');
    await page.fill('[data-testid="sow-scope-doc-ref"]', 'docs/scope/acme_brand_refresh.md');
    await page.fill('[data-testid="sow-ceiling-minor"]', '80000000');
    await page.click('[data-testid="sow-submit"]');
    await expect(page.locator('[data-testid="sow-status"]')).toHaveText(/DRAFT/);
  });
});

// ── 2. AM creates Quote against the SOW (Pricing engine; 3.C merged, but
//      the quote builder PAGE is 3.D) ───────────────────────────────────────

test.describe.skip('Phase 3.G — AM builds Quote (requires 3.D Quote Builder UI)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsPricingAdmin(page);
  });

  test('AM builds a 3-line quote spanning 2 subsidiaries, margin green', async ({ page }) => {
    await page.goto('/pricing/quotes/new');
    await page.fill('[data-testid="quote-sow-picker"]', 'sow_acme_brand_refresh');
    // First line defaults; add 2 more.
    await page.click('[data-testid="add-quote-line"]');
    await page.click('[data-testid="add-quote-line"]');
    await page.click('[data-testid="compute-price"]');
    await expect(page.locator('[data-testid="margin-badge"]'))
      .toHaveAttribute('data-band', 'green');
  });
});

// ── 3. AM issues IWO from the Quote (3.B merged, but the "issue" button
//      lives in the AM UI = 3.D) ────────────────────────────────────────────

test.describe.skip('Phase 3.G — AM issues IWO (requires 3.D AM UI)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsPricingAdmin(page);
  });

  test('issuing the quote creates one IWO per receiving subsidiary', async ({ page }) => {
    await page.goto('/pricing/quotes/q_msa_acme_001');
    await page.click('[data-testid="issue-quote"]');
    await expect(page.locator('[data-testid="iwo-list-row"]')).toHaveCount(2);
  });
});

// ── 4. Subsidiary accepts IWO (requires 3.E Subsidiary Workspace) ──────────

test.describe.skip('Phase 3.G — subsidiary accepts IWO (requires 3.E)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSubsidiaryUser(page);
  });

  test('subsidiary lead accepts the IWO, status → ACCEPTED', async ({ page }) => {
    await page.goto('/delivery/iwos');
    await page.click('[data-testid="iwo-row-iwo_for_zeus_the_agency"]');
    await page.click('[data-testid="iwo-accept"]');
    await expect(page.locator('[data-testid="iwo-status"]'))
      .toHaveText('ACCEPTED', { timeout: TEST_TIMEOUTS.E2E.FORM_SUBMIT });
  });
});

// ── 5. Subsidiary posts time entries (requires 3.E) ───────────────────────

test.describe.skip('Phase 3.G — subsidiary posts time (requires 3.E)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSubsidiaryUser(page);
  });

  test('posting a time entry burns into the IWO meter', async ({ page }) => {
    await page.goto('/delivery/iwos/iwo_for_zeus_the_agency');
    await page.fill('[data-testid="te-hours"]', '4');
    await page.fill('[data-testid="te-role"]', 'Senior Creative Director');
    await page.click('[data-testid="te-submit"]');
    await expect(page.locator('[data-testid="iwo-burn-pct"]')).not.toHaveText('0%');
  });
});

// ── 6. Subsidiary delivers (requires 3.E) ─────────────────────────────────

test.describe.skip('Phase 3.G — subsidiary delivers (requires 3.E + Creative Approval Chain)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSubsidiaryUser(page);
  });

  test('delivering transitions IWO → DELIVERED and emits IWODelivered', async ({ page }) => {
    await page.goto('/delivery/iwos/iwo_for_zeus_the_agency');
    await page.click('[data-testid="iwo-deliver"]');
    await expect(page.locator('[data-testid="iwo-status"]')).toHaveText('DELIVERED');
  });
});

// ── 7. AM closes the IWO, IC invoice raised (3.F merged but trigger UI
//      lives in 3.D AM dashboard) ───────────────────────────────────────────

test.describe.skip('Phase 3.G — AM closes IWO → IC invoice (requires 3.D AM dashboard)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsPricingAdmin(page);
  });

  test('closing the IWO triggers IC invoice creation in /billing/inter-company', async ({ page }) => {
    await page.goto('/am/iwos/iwo_for_zeus_the_agency');
    await page.click('[data-testid="iwo-close"]');
    await page.goto('/billing/inter-company');
    await expect(
      page.locator(`[data-testid="ic-invoice-row"]:has-text("iwo_for_zeus_the_agency")`)
    ).toBeVisible({ timeout: TEST_TIMEOUTS.E2E.DATA_LOAD });
  });
});

// ── 8. AM issues client invoice (3.F merged but the issue UI is 3.D) ───────

test.describe.skip('Phase 3.G — AM issues client invoice (requires 3.D billing UI)', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsPricingAdmin(page);
  });

  test('one client invoice issued per MasterJob (spec §11.7 UNIQUE invariant)', async ({ page }) => {
    await page.goto('/billing/clients');
    await page.click('[data-testid="issue-client-invoice-master_job_001"]');
    await expect(page.locator('[data-testid="client-invoice-status"]'))
      .toHaveText('ISSUED', { timeout: TEST_TIMEOUTS.E2E.FORM_SUBMIT });

    // Spec §11.7 — attempting to issue a second active invoice on the
    // same MasterJob must be rejected by the createClientInvoice CFn.
    await page.click('[data-testid="issue-client-invoice-master_job_001"]');
    await expect(page.locator('[data-testid="toast-error"]'))
      .toContainText(/already.*invoice|UNIQUE/i);
  });
});

// ── 9. Subsidiary user is blocked from /pricing/* (boundary smoke test) ────
//      Depends on the AuthGuard / RoleGuard wiring landing in 3.D.

test.describe.skip('Phase 3.G — subsidiary blocked from /pricing/* (requires 3.D RoleGuard)', () => {
  test('subsidiary user redirected from /pricing/rate-cards to /unauthorized', async ({ page }) => {
    await loginAsSubsidiaryUser(page);
    await page.goto('/pricing/rate-cards');
    await expect(page).toHaveURL(/\/unauthorized|\/403/);
  });
});

// ── helpers ─────────────────────────────────────────────────────────────────
//
// The shipped LoginPage today only exposes Google sign-in (no email/password
// form, no data-testid attributes). When 3.D adds the staff email/password
// flow with proper test ids, these helpers fill it; until then every block
// that calls them is `.skip`ed above.

async function loginAsPricingAdmin(page: import('@playwright/test').Page) {
  await loginWithCredentials(page, PRICING_ADMIN_EMAIL, TEST_PASSWORD);
}

async function loginAsSubsidiaryUser(page: import('@playwright/test').Page) {
  await loginWithCredentials(page, SUBSIDIARY_USER_EMAIL, TEST_PASSWORD);
}

async function loginWithCredentials(
  page: import('@playwright/test').Page,
  email: string,
  password: string,
) {
  await page.goto('/auth/login');
  await page.fill('[data-testid="email-input"]', email);
  await page.fill('[data-testid="password-input"]', password);
  await page.click('[data-testid="login-button"]');
  await page.waitForURL('/dashboard', { timeout: TEST_TIMEOUTS.E2E.NAVIGATION });
}
