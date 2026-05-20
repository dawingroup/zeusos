// ============================================================================
// PAYROLL PROCESSING E2E TEST
// DawinOS v2.0 - Testing Strategy
// Complete payroll processing workflow E2E test
// ============================================================================

import { test, expect } from '@playwright/test';
import { TEST_TIMEOUTS } from '../../fixtures/timeouts';

test.describe('Payroll Processing Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as Finance Manager
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'finance@dawinos.test');
    await page.fill('[data-testid="password-input"]', 'test-password');
    await page.click('[data-testid="login-button"]');

    await page.waitForURL('/dashboard', { timeout: TEST_TIMEOUTS.E2E.NAVIGATION });
  });

  test('should complete monthly payroll processing', async ({ page }) => {
    // Step 1: Navigate to Payroll
    await page.click('[data-testid="nav-hr-central"]');
    await page.click('[data-testid="nav-payroll"]');

    await expect(page.locator('h1')).toContainText('Payroll Management');

    // Step 2: Select Period
    await page.click('[data-testid="period-selector"]');
    await page.click('[data-testid="period-option-2025-01"]');

    // Step 3: Verify Payroll Summary
    await expect(page.locator('[data-testid="payroll-summary"]')).toBeVisible();
    await expect(page.locator('[data-testid="total-employees"]')).toContainText(/\d+/);
    await expect(page.locator('[data-testid="total-gross"]')).toContainText(/UGX/);

    // Step 4: View Employee Breakdown
    await page.click('[data-testid="view-breakdown-button"]');

    await expect(page.locator('[data-testid="payroll-table"]')).toBeVisible();

    // Step 5: Verify PAYE Calculations
    const firstRow = page.locator('[data-testid="payroll-row"]').first();
    await expect(firstRow.locator('[data-testid="paye-amount"]')).toBeVisible();
    await expect(firstRow.locator('[data-testid="nssf-amount"]')).toBeVisible();
    await expect(firstRow.locator('[data-testid="lst-amount"]')).toBeVisible();

    // Step 6: Process Payroll
    await page.click('[data-testid="process-payroll-button"]');

    // Confirm processing
    await page.click('[data-testid="confirm-process-button"]');

    // Wait for processing
    await expect(page.locator('[data-testid="processing-indicator"]')).toBeVisible();
    await expect(page.locator('[data-testid="payroll-status"]')).toContainText('Processed', {
      timeout: TEST_TIMEOUTS.E2E.DATA_LOAD,
    });

    // Step 7: Submit for Approval
    await page.click('[data-testid="submit-approval-button"]');

    await expect(page.locator('[data-testid="payroll-status"]')).toContainText('Pending Approval');

    // Step 8: Verify Approval Workflow
    await expect(page.locator('[data-testid="approver-list"]')).toContainText('CEO');
  });

  test('should generate and download payslips', async ({ page }) => {
    await page.goto('/hr/payroll/2025-01');

    // Select multiple employees
    await page.click('[data-testid="select-all-checkbox"]');

    // Generate payslips
    await page.click('[data-testid="generate-payslips-button"]');

    // Wait for generation
    await expect(page.locator('[data-testid="payslips-ready"]')).toBeVisible({
      timeout: TEST_TIMEOUTS.E2E.DATA_LOAD,
    });

    // Download
    const downloadPromise = page.waitForEvent('download');
    await page.click('[data-testid="download-payslips-button"]');
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toContain('payslips-2025-01');
  });

  test('should display accurate PAYE calculations for Uganda tax brackets', async ({ page }) => {
    await page.goto('/hr/payroll/2025-01');
    await page.click('[data-testid="view-breakdown-button"]');

    // Find an employee with known salary
    const highEarnerRow = page
      .locator('[data-testid="payroll-row"]')
      .filter({
        hasText: 'Executive',
      })
      .first();

    if ((await highEarnerRow.count()) > 0) {
      // Verify tax rate indicators
      await expect(highEarnerRow.locator('[data-testid="tax-bracket"]')).toContainText('40%');
    }

    // Find lower income employee
    const standardRow = page
      .locator('[data-testid="payroll-row"]')
      .filter({
        hasText: 'Associate',
      })
      .first();

    if ((await standardRow.count()) > 0) {
      // Verify different tax bracket
      await expect(standardRow.locator('[data-testid="tax-bracket"]')).toContainText('30%');
    }
  });
});
