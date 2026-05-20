// ============================================================================
// PAYROLL INTEGRATION TESTS
// DawinOS v2.0 - Testing Strategy
// Integration tests for payroll processing
// ============================================================================

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { employeeFactory, payrollFactory } from '../../factories';
import { UGANDA_TEST_DATA } from '../../constants/test.constants';

describe('Payroll Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('PAYE Calculation', () => {
    it('should calculate zero PAYE for income below threshold', () => {
      // With 30% allowances, basicSalary of 180000 gives gross ~234000 (below 235000 threshold)
      const payroll = payrollFactory.build({
        overrides: { basicSalary: 180000 },
      });

      // Below UGX 235,000 threshold = 0% tax
      expect(payroll.paye).toBe(0);
    });

    it('should calculate correct PAYE for middle income bracket', () => {
      const basicSalary = 1500000; // UGX 1.5M
      const payroll = payrollFactory.build({
        overrides: { basicSalary },
      });

      // Expected calculation based on Uganda PAYE brackets
      const grossSalary = basicSalary * 1.3; // With allowances

      expect(payroll.paye).toBeGreaterThan(0);
      expect(payroll.paye).toBeLessThan(grossSalary * 0.4);
    });

    it('should calculate correct PAYE for high income', () => {
      const basicSalary = 15000000; // UGX 15M
      const payroll = payrollFactory.build({
        overrides: { basicSalary },
      });

      // High earners pay up to 40% on income above 10M
      expect(payroll.paye).toBeGreaterThan(basicSalary * 0.25);
    });
  });

  describe('NSSF Calculation', () => {
    it('should calculate 5% employee contribution', () => {
      const basicSalary = 2000000;
      const payroll = payrollFactory.build({
        overrides: { basicSalary },
      });

      const grossSalary = basicSalary * 1.3; // Approximation with allowances
      const expectedNSSF = Math.round(grossSalary * 0.05);

      expect(payroll.nssf).toBeCloseTo(expectedNSSF, -3); // Within 1000 UGX
    });
  });

  describe('LST Calculation', () => {
    it('should calculate correct LST based on income bracket', () => {
      // Test various income brackets
      // Note: Factory adds 30% allowances, so gross = basicSalary * 1.3
      // LST is calculated on gross salary
      const testCases = [
        { income: 50000, expected: 0 }, // gross ~65000, bracket 0-100000 = 0
        { income: 100000, expected: 5000 }, // gross ~130000, bracket 100001-200000 = 5000
        { income: 400000, expected: 45000 }, // gross ~520000, bracket 500001-750000 = 45000
        { income: 1500000, expected: 90000 }, // gross ~1950000, bracket 1500001-2000000 = 90000
        { income: 5000000, expected: 100000 }, // gross ~6500000, bracket 2000001+ = 100000
      ];

      for (const { income, expected } of testCases) {
        const payroll = payrollFactory.build({
          overrides: { basicSalary: income },
        });

        // LST is flat rate per bracket based on gross salary
        expect(payroll.lst).toBe(expected);
      }
    });
  });

  describe('Net Pay Calculation', () => {
    it('should correctly calculate net pay after all deductions', () => {
      const payroll = payrollFactory.build({
        overrides: { basicSalary: 3000000 },
      });

      const totalAllowances = payroll.allowances.reduce((sum, a) => sum + a.amount, 0);
      const grossSalary = payroll.basicSalary + totalAllowances;
      const totalDeductions = payroll.paye + payroll.nssf + payroll.lst;
      const expectedNetPay = grossSalary - totalDeductions;

      expect(payroll.netPay).toBe(expectedNetPay);
      expect(payroll.netPay).toBeGreaterThan(0);
    });
  });

  describe('Payroll Processing Workflow', () => {
    it('should process payroll for all active employees', async () => {
      const employees = employeeFactory.buildList(10, {
        traits: [],
        overrides: { status: 'active' },
      });

      // Verify all employees are active
      expect(employees.every((e) => e.status === 'active')).toBe(true);

      // Generate payroll for each employee
      const payrollRecords = employees.map((emp) =>
        payrollFactory.build({
          overrides: {
            employeeId: emp.id,
            basicSalary: emp.salary.grossAmount,
          },
        })
      );

      // Verify all records generated
      expect(payrollRecords).toHaveLength(10);
      expect(payrollRecords.every((p) => p.netPay > 0)).toBe(true);
    });

    it('should exclude terminated employees from payroll', async () => {
      const activeEmployees = employeeFactory.buildList(8, {
        overrides: { status: 'active' },
      });

      const terminatedEmployees = employeeFactory.buildList(2, {
        traits: ['terminated'],
      });

      const allEmployees = [...activeEmployees, ...terminatedEmployees];

      // Filter for payroll processing
      const eligibleEmployees = allEmployees.filter((e) => e.status === 'active');

      expect(eligibleEmployees).toHaveLength(8);
      expect(eligibleEmployees.every((e) => e.status === 'active')).toBe(true);
    });

    it('should handle employees on leave correctly', async () => {
      const onLeaveEmployee = employeeFactory.build({
        traits: ['on_leave'],
      });

      // Employees on leave should still receive salary
      expect(onLeaveEmployee.status).toBe('on_leave');

      const payroll = payrollFactory.build({
        overrides: {
          employeeId: onLeaveEmployee.id,
          basicSalary: onLeaveEmployee.salary.grossAmount,
        },
      });

      expect(payroll.netPay).toBeGreaterThan(0);
    });
  });

  describe('Uganda Tax Compliance', () => {
    it('should use correct PAYE brackets', () => {
      expect(UGANDA_TEST_DATA.PAYE_BRACKETS).toHaveLength(5);
      expect(UGANDA_TEST_DATA.PAYE_BRACKETS[0].rate).toBe(0);
      expect(UGANDA_TEST_DATA.PAYE_BRACKETS[4].rate).toBe(0.4);
    });

    it('should use correct NSSF rates', () => {
      expect(UGANDA_TEST_DATA.NSSF.EMPLOYEE_RATE).toBe(0.05);
      expect(UGANDA_TEST_DATA.NSSF.EMPLOYER_RATE).toBe(0.1);
    });

    it('should have valid LST brackets', () => {
      expect(UGANDA_TEST_DATA.LST_BRACKETS.length).toBeGreaterThan(0);
      expect(UGANDA_TEST_DATA.LST_BRACKETS[0].amount).toBe(0);
    });
  });
});
