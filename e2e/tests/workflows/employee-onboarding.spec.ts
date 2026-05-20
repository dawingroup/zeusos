// ============================================================================
// EMPLOYEE ONBOARDING E2E TEST
// DawinOS v2.0 - Testing Strategy
// Complete employee onboarding workflow E2E test
// ============================================================================

import { test, expect } from '@playwright/test';
import { TEST_TIMEOUTS } from '../../fixtures/timeouts';

test.describe('Employee Onboarding Workflow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as HR Manager
    await page.goto('/login');
    await page.fill('[data-testid="email-input"]', 'hr@dawinos.test');
    await page.fill('[data-testid="password-input"]', 'test-password');
    await page.click('[data-testid="login-button"]');

    await page.waitForURL('/dashboard', { timeout: TEST_TIMEOUTS.E2E.NAVIGATION });
  });

  test('should complete full employee onboarding process', async ({ page }) => {
    // Step 1: Navigate to Employee Management
    await page.click('[data-testid="nav-hr-central"]');
    await page.click('[data-testid="nav-employee-management"]');

    await expect(page.locator('h1')).toContainText('Employee Management');

    // Step 2: Click Add New Employee
    await page.click('[data-testid="add-employee-button"]');

    await expect(page.locator('[data-testid="employee-form"]')).toBeVisible();

    // Step 3: Fill Personal Information
    await page.fill('[data-testid="first-name-input"]', 'John');
    await page.fill('[data-testid="last-name-input"]', 'Doe');
    await page.fill('[data-testid="email-input"]', 'john.doe@dawinos.test');
    await page.fill('[data-testid="phone-input"]', '+256700123456');

    // Step 4: Fill Employment Details
    await page.click('[data-testid="employment-tab"]');

    await page.selectOption('[data-testid="employment-type-select"]', 'permanent');
    await page.selectOption('[data-testid="department-select"]', 'Engineering');
    await page.selectOption('[data-testid="position-select"]', 'Software Engineer');
    await page.fill('[data-testid="hire-date-input"]', '2025-01-15');

    // Step 5: Fill Compensation
    await page.click('[data-testid="compensation-tab"]');

    await page.fill('[data-testid="gross-salary-input"]', '5000000');
    await expect(page.locator('[data-testid="currency-display"]')).toContainText('UGX');

    // Step 6: Fill Bank Details
    await page.click('[data-testid="bank-tab"]');

    await page.selectOption('[data-testid="bank-name-select"]', 'Stanbic Bank');
    await page.fill('[data-testid="account-number-input"]', '1234567890123');
    await page.fill('[data-testid="account-name-input"]', 'John Doe');

    // Step 7: Fill Statutory Information
    await page.click('[data-testid="statutory-tab"]');

    await page.fill('[data-testid="national-id-input"]', 'CM12345678901234');
    await page.fill('[data-testid="tin-input"]', '1234567890');
    await page.fill('[data-testid="nssf-input"]', 'NSSF1234567890');

    // Step 8: Submit Form
    await page.click('[data-testid="submit-employee-button"]');

    // Wait for success message
    await expect(page.locator('[data-testid="success-toast"]')).toContainText('Employee created successfully', {
      timeout: TEST_TIMEOUTS.E2E.FORM_SUBMIT,
    });

    // Step 9: Verify Employee in List
    await page.fill('[data-testid="search-input"]', 'John Doe');
    await page.waitForTimeout(500); // Debounce

    await expect(page.locator('[data-testid="employee-list"]')).toContainText('John Doe');
    await expect(page.locator('[data-testid="employee-list"]')).toContainText('Software Engineer');

    // Step 10: Verify Employee Details
    await page.click('[data-testid="employee-row-john-doe"]');

    await expect(page.locator('[data-testid="employee-detail-name"]')).toContainText('John Doe');
    await expect(page.locator('[data-testid="employee-detail-email"]')).toContainText('john.doe@dawinos.test');
    await expect(page.locator('[data-testid="employee-detail-salary"]')).toContainText('5,000,000');
  });

  test('should validate required fields', async ({ page }) => {
    await page.goto('/hr/employees/new');

    // Try to submit empty form
    await page.click('[data-testid="submit-employee-button"]');

    // Check for validation errors
    await expect(page.locator('[data-testid="first-name-error"]')).toContainText('First name is required');
    await expect(page.locator('[data-testid="last-name-error"]')).toContainText('Last name is required');
    await expect(page.locator('[data-testid="email-error"]')).toContainText('Email is required');
  });

  test('should validate Uganda phone number format', async ({ page }) => {
    await page.goto('/hr/employees/new');

    await page.fill('[data-testid="phone-input"]', '0700123456'); // Invalid format
    await page.click('[data-testid="submit-employee-button"]');

    await expect(page.locator('[data-testid="phone-error"]')).toContainText('Phone must be in format +256XXXXXXXXX');

    // Fix the phone number
    await page.fill('[data-testid="phone-input"]', '+256700123456');

    await expect(page.locator('[data-testid="phone-error"]')).not.toBeVisible();
  });

  test('should validate national ID format', async ({ page }) => {
    await page.goto('/hr/employees/new');
    await page.click('[data-testid="statutory-tab"]');

    await page.fill('[data-testid="national-id-input"]', '123456'); // Invalid format
    await page.click('[data-testid="submit-employee-button"]');

    await expect(page.locator('[data-testid="national-id-error"]')).toContainText('National ID must be 14 characters');
  });
});
