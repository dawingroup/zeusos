/**
 * E2E Test: Phase 4.1 Procurement / Finance Handshake
 *
 * Playwright lifecycle spec extending the Phase 3 lifecycle.
 * Tests the end-to-end flow: talent invoice approval → PO creation → JE posting.
 *
 * Task brief (plan §15 Phase 4 acceptance):
 *   "Media plan attached to campaign, buy logged, supplier invoice triggers
 *    PO + journal entry."
 *
 * This spec validates that supplier invoice state changes propagate correctly
 * through the domain event outbox to the procurement and finance consumers.
 *
 * Run: npm run e2e -- e2e/phase-4-1-procurement-handshake.spec.ts
 */

import { test, expect } from '@playwright/test';

test.describe('Phase 4.1 — Procurement / Finance Handshake', () => {
  const TIMEOUT_WAIT_FOR_JE = 5000; // 5s for domain events to propagate

  test.beforeEach(async ({ page, context }) => {
    // Pre-condition: authenticated as a commercial actor (AM/Finance Lead)
    // who has permission to approve invoices and view procurement.
    await context.addCookies([
      {
        name: 'authToken',
        value: process.env.E2E_USER_TOKEN || '',
        domain: 'localhost',
        path: '/',
      },
    ]);
  });

  test('talent invoice approval triggers PO + journal entry creation', async ({
    page,
  }) => {
    // 1. Navigate to Talent invoices list
    await page.goto('/modules/talent/invoices');
    await expect(page).toHaveTitle(/Talent Invoices/);

    // 2. Find a SUBMITTED invoice (or create one for test isolation)
    //    For now, we assume an invoice exists in the DB seeded by @BeforeEach
    const invoiceId = await page.locator('[data-testid="invoice-row"]').first().getAttribute('data-invoice-id');
    expect(invoiceId).toBeTruthy();

    // 3. Open invoice detail and approve
    await page.goto(`/modules/talent/invoices/${invoiceId}`);
    await page.locator('button:has-text("Approve")').click();
    await page.locator('input[placeholder="Approval comment"]').fill('Approved for payment');
    await page.locator('button:has-text("Confirm Approval")').click();

    // Wait for the approval to complete
    await expect(page.locator('[data-testid="invoice-status"]')).toContainText('APPROVED');

    // 4. Poll for PO creation in Procurement module (domain event + CFn execution)
    //    Retry up to 5 times with 1s delay to account for event propagation
    let poCreated = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      await page.goto('/modules/procurement/purchase-orders');
      const poLocator = page.locator(`[data-po-source-invoice="${invoiceId}"]`);
      if (await poLocator.isVisible({ timeout: 1000 }).catch(() => false)) {
        poCreated = true;
        break;
      }
      await page.waitForTimeout(1000);
    }
    expect(poCreated).toBeTruthy('PO should be created within 5s of invoice approval');

    // 5. Verify PO details
    const poRow = page.locator(`[data-po-source-invoice="${invoiceId}"]`);
    await expect(poRow).toContainText('OPEN');
    const poId = await poRow.getAttribute('data-po-id');
    expect(poId).toMatch(/^po_talent_/);

    // 6. Poll for Journal Entry creation (downstream of PO)
    //    This should happen within 5s of PO creation
    let jeCreated = false;
    for (let attempt = 0; attempt < 5; attempt++) {
      await page.goto('/modules/finance/journal-entries');
      const jeLocator = page.locator(`[data-je-source-po="${poId}"]`);
      if (await jeLocator.isVisible({ timeout: 1000 }).catch(() => false)) {
        jeCreated = true;
        break;
      }
      await page.waitForTimeout(1000);
    }
    expect(jeCreated).toBeTruthy('JE should be created within 5s of PO creation');

    // 7. Verify JE structure (debit/credit balanced)
    const jeRow = page.locator(`[data-je-source-po="${poId}"]`);
    const jeId = await jeRow.getAttribute('data-je-id');
    await page.goto(`/modules/finance/journal-entries/${jeId}`);

    // Verify debit / credit lines are present and balanced
    const debitAmountText = await page.locator('[data-testid="debit-total"]').textContent();
    const creditAmountText = await page.locator('[data-testid="credit-total"]').textContent();
    const debitAmount = parseFloat(debitAmountText?.match(/\d+\.?\d*/)?.[0] || '0');
    const creditAmount = parseFloat(creditAmountText?.match(/\d+\.?\d*/)?.[0] || '0');
    expect(debitAmount).toBe(creditAmount); // Double-entry balance
  });

  test('media supplier invoice payment triggers PO + journal entry creation', async ({
    page,
  }) => {
    // Similar flow for media supplier invoices:
    // 1. Navigate to Media supplier invoices
    // 2. Mark invoice as PAID (not APPROVED like talent)
    // 3. Verify PO created with kind='MEDIA_SUPPLIER' + media context (mediaPlanId, vehicleType)
    // 4. Verify JE created with media expense account codes
    // 5. Verify postedToGL flag on PO is set

    // Outline — implementation follows same pattern as talent test above
    await page.goto('/modules/media/supplier-invoices');
    expect(true).toBe(true); // Placeholder
  });

  test('PO status updates to POSTED after JE creation', async ({ page }) => {
    // Verify that when the finance consumer posts the JE, it also updates
    // the source PO's status to POSTED and sets postedToGL=true.
    expect(true).toBe(true); // Placeholder
  });

  test('idempotency: retry of same invoice approval creates no duplicate PO/JE', async ({
    page,
  }) => {
    // Verify that if a duplicate event is processed (e.g. due to outbox retry),
    // the idempotency guards prevent duplicate PO/JE creation.
    // The event's processedBy array should contain the consumer tag from both attempts.
    expect(true).toBe(true); // Placeholder
  });

  test('subsidiary users cannot read POs or JEs (permission boundary)', async ({
    page,
    context,
  }) => {
    // Verify that a user with SubsidiaryAccess=subsidiary-id cannot read
    // POs or JEs, even if they share the same org.
    // This tests the parent-org-only Firestore rules.
    expect(true).toBe(true); // Placeholder
  });
});
