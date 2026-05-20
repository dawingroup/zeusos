/**
 * Test Data Seeder
 * DawinOS v2.0 - Testing Framework
 * Utilities for seeding test data across all modules
 */

import { db } from '@/core/services/firebase/firestore';
import {
  collection,
  doc,
  writeBatch,
  Timestamp,
  serverTimestamp,
} from 'firebase/firestore';

// ============================================================================
// TYPES
// ============================================================================

export interface SeedResult {
  success: boolean;
  module: string;
  recordsCreated: number;
  error?: string;
  duration: number;
}

export interface SeedOptions {
  clearExisting?: boolean;
  count?: number;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const generateId = () => Math.random().toString(36).substring(2, 15);

const randomDate = (start: Date, end: Date) => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

const randomItem = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];

const randomNumber = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

// ============================================================================
// FINANCE MODULE SEEDERS
// ============================================================================

export const seedAccounts = async (_options: SeedOptions = {}): Promise<SeedResult> => {
  const startTime = Date.now();

  try {
    const batch = writeBatch(db);
    const accountsRef = collection(db, 'accounts');

    // Sample chart of accounts structure
    const accountTemplates = [
      // Assets (1000-1999)
      { code: '1000', name: 'Assets', type: 'asset', subType: 'current_asset', level: 1, parentCode: null },
      { code: '1100', name: 'Current Assets', type: 'asset', subType: 'current_asset', level: 2, parentCode: '1000' },
      { code: '1110', name: 'Cash & Bank', type: 'asset', subType: 'cash', level: 3, parentCode: '1100' },
      { code: '1111', name: 'Petty Cash - Kampala', type: 'asset', subType: 'cash', level: 4, parentCode: '1110' },
      { code: '1112', name: 'Bank - Stanbic UGX', type: 'asset', subType: 'bank', level: 4, parentCode: '1110' },
      { code: '1113', name: 'Bank - Stanbic USD', type: 'asset', subType: 'bank', level: 4, parentCode: '1110' },
      { code: '1200', name: 'Accounts Receivable', type: 'asset', subType: 'receivable', level: 3, parentCode: '1100' },
      { code: '1300', name: 'Inventory', type: 'asset', subType: 'inventory', level: 3, parentCode: '1100' },
      // Liabilities (2000-2999)
      { code: '2000', name: 'Liabilities', type: 'liability', subType: 'current_liability', level: 1, parentCode: null },
      { code: '2100', name: 'Current Liabilities', type: 'liability', subType: 'current_liability', level: 2, parentCode: '2000' },
      { code: '2110', name: 'Accounts Payable', type: 'liability', subType: 'payable', level: 3, parentCode: '2100' },
      { code: '2120', name: 'PAYE Payable', type: 'liability', subType: 'tax_payable', level: 3, parentCode: '2100' },
      { code: '2130', name: 'NSSF Payable', type: 'liability', subType: 'tax_payable', level: 3, parentCode: '2100' },
      // Equity (3000-3999)
      { code: '3000', name: 'Equity', type: 'equity', subType: 'capital', level: 1, parentCode: null },
      { code: '3100', name: 'Share Capital', type: 'equity', subType: 'capital', level: 2, parentCode: '3000' },
      { code: '3200', name: 'Retained Earnings', type: 'equity', subType: 'retained_earnings', level: 2, parentCode: '3000' },
      // Revenue (4000-4999)
      { code: '4000', name: 'Revenue', type: 'revenue', subType: 'operating_revenue', level: 1, parentCode: null },
      { code: '4100', name: 'Sales Revenue', type: 'revenue', subType: 'operating_revenue', level: 2, parentCode: '4000' },
      { code: '4200', name: 'Service Revenue', type: 'revenue', subType: 'operating_revenue', level: 2, parentCode: '4000' },
      // Expenses (5000-5999)
      { code: '5000', name: 'Expenses', type: 'expense', subType: 'operating_expense', level: 1, parentCode: null },
      { code: '5100', name: 'Salaries & Wages', type: 'expense', subType: 'payroll', level: 2, parentCode: '5000' },
      { code: '5200', name: 'Rent Expense', type: 'expense', subType: 'operating_expense', level: 2, parentCode: '5000' },
      { code: '5300', name: 'Utilities', type: 'expense', subType: 'operating_expense', level: 2, parentCode: '5000' },
    ];

    for (const template of accountTemplates) {
      const accountId = generateId();
      const accountDoc = doc(accountsRef, accountId);
      batch.set(accountDoc, {
        ...template,
        id: accountId,
        currency: 'UGX',
        isActive: true,
        balance: randomNumber(0, 100000000),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();

    return {
      success: true,
      module: 'Finance - Accounts',
      recordsCreated: accountTemplates.length,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      module: 'Finance - Accounts',
      recordsCreated: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
};

export const seedBudgets = async (_options: SeedOptions = {}): Promise<SeedResult> => {
  const startTime = Date.now();

  try {
    const batch = writeBatch(db);
    const budgetsRef = collection(db, 'budgets');
    const budgetLinesRef = collection(db, 'budgetLines');

    const fiscalYear = 2026;
    const subsidiaries = ['finishes', 'advisory', 'technology', 'capital'];
    const departments = ['Operations', 'Finance', 'HR', 'Marketing', 'IT'];

    // Create budgets for each subsidiary
    for (const subsidiary of subsidiaries) {
      const budgetId = generateId();
      const budgetDoc = doc(budgetsRef, budgetId);

      batch.set(budgetDoc, {
        id: budgetId,
        name: `FY${fiscalYear} Annual Budget - ${subsidiary}`,
        code: `BUD-${fiscalYear}-${subsidiary.toUpperCase().slice(0, 3)}`,
        type: 'annual',
        status: 'approved',
        fiscalYear,
        subsidiary,
        currency: 'UGX',
        totalBudget: randomNumber(500000000, 2000000000),
        version: 1,
        startDate: Timestamp.fromDate(new Date(2025, 6, 1)), // July 1
        endDate: Timestamp.fromDate(new Date(2026, 5, 30)), // June 30
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      // Create budget lines for each department
      for (const department of departments) {
        const lineId = generateId();
        const lineDoc = doc(budgetLinesRef, lineId);

        batch.set(lineDoc, {
          id: lineId,
          budgetId,
          accountCode: randomItem(['5100', '5200', '5300']),
          accountName: randomItem(['Salaries & Wages', 'Rent Expense', 'Utilities']),
          accountType: 'expense',
          department,
          annualBudget: randomNumber(10000000, 100000000),
          actualSpent: randomNumber(0, 50000000),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      }
    }

    await batch.commit();

    return {
      success: true,
      module: 'Finance - Budgets',
      recordsCreated: subsidiaries.length + (subsidiaries.length * departments.length),
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      module: 'Finance - Budgets',
      recordsCreated: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
};

// ============================================================================
// HR MODULE SEEDERS
// ============================================================================

export const seedEmployees = async (options: SeedOptions = {}): Promise<SeedResult> => {
  const startTime = Date.now();
  const { count = 20 } = options;

  try {
    const batch = writeBatch(db);
    const employeesRef = collection(db, 'employees');

    const firstNames = ['John', 'Jane', 'Peter', 'Mary', 'David', 'Sarah', 'Michael', 'Grace', 'Robert', 'Christine'];
    const lastNames = ['Okello', 'Nakamya', 'Mugisha', 'Namutebi', 'Ssempijja', 'Namuganza', 'Kato', 'Nalwanga', 'Ochieng', 'Auma'];
    const departments = ['Operations', 'Finance', 'HR', 'Marketing', 'IT', 'Sales'];
    const positions = ['Manager', 'Senior Associate', 'Associate', 'Junior Associate', 'Intern'];
    const grades = ['E1', 'E2', 'E3', 'M1', 'M2', 'M3', 'S1', 'S2', 'A1', 'A2'];
    const subsidiaries = ['finishes', 'advisory', 'technology', 'capital'];

    for (let i = 0; i < count; i++) {
      const employeeId = generateId();
      const employeeDoc = doc(employeesRef, employeeId);
      const firstName = randomItem(firstNames);
      const lastName = randomItem(lastNames);
      const baseSalary = randomNumber(1500000, 15000000);

      batch.set(employeeDoc, {
        id: employeeId,
        employeeNumber: `EMP${String(i + 1).padStart(4, '0')}`,
        firstName,
        lastName,
        fullName: `${firstName} ${lastName}`,
        email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@dawin.ug`,
        phone: `+256${randomNumber(700000000, 799999999)}`,
        department: randomItem(departments),
        position: randomItem(positions),
        grade: randomItem(grades),
        subsidiary: randomItem(subsidiaries),
        status: randomItem(['active', 'active', 'active', 'on_leave', 'probation']),
        employmentType: randomItem(['permanent', 'contract', 'intern']),
        hireDate: Timestamp.fromDate(randomDate(new Date(2020, 0, 1), new Date())),
        baseSalary,
        currency: 'UGX',
        bankName: randomItem(['Stanbic Bank', 'DFCU Bank', 'Centenary Bank', 'Equity Bank']),
        bankAccountNumber: `${randomNumber(1000000000, 9999999999)}`,
        nssfNumber: `NSSF${randomNumber(100000, 999999)}`,
        tinNumber: `TIN${randomNumber(1000000000, 9999999999)}`,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();

    return {
      success: true,
      module: 'HR - Employees',
      recordsCreated: count,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      module: 'HR - Employees',
      recordsCreated: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
};

// ============================================================================
// STRATEGY MODULE SEEDERS
// ============================================================================

export const seedStrategyData = async (_options: SeedOptions = {}): Promise<SeedResult> => {
  const startTime = Date.now();

  try {
    const batch = writeBatch(db);

    // Seed OKRs
    const okrsRef = collection(db, 'okrs');
    const objectives = [
      { title: 'Achieve Revenue Growth', level: 'company', target: 2000000000, current: 1500000000 },
      { title: 'Expand Market Presence', level: 'company', target: 100, current: 75 },
      { title: 'Improve Customer Satisfaction', level: 'company', target: 95, current: 88 },
      { title: 'Enhance Operational Efficiency', level: 'department', target: 90, current: 82 },
      { title: 'Build Strong Team Culture', level: 'department', target: 85, current: 78 },
    ];

    for (const obj of objectives) {
      const okrId = generateId();
      const okrDoc = doc(okrsRef, okrId);
      batch.set(okrDoc, {
        id: okrId,
        ...obj,
        status: 'active',
        period: 'Q1 2026',
        fiscalYear: 2026,
        progress: Math.round((obj.current / obj.target) * 100),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    // Seed KPIs
    const kpisRef = collection(db, 'kpis');
    const kpis = [
      { name: 'Monthly Revenue', category: 'financial', target: 500000000, actual: 480000000, unit: 'UGX' },
      { name: 'Customer Acquisition', category: 'growth', target: 50, actual: 45, unit: 'customers' },
      { name: 'Employee Retention', category: 'hr', target: 95, actual: 92, unit: '%' },
      { name: 'Project Delivery', category: 'operations', target: 100, actual: 85, unit: '%' },
      { name: 'Net Promoter Score', category: 'customer', target: 80, actual: 72, unit: 'score' },
    ];

    for (const kpi of kpis) {
      const kpiId = generateId();
      const kpiDoc = doc(kpisRef, kpiId);
      batch.set(kpiDoc, {
        id: kpiId,
        ...kpi,
        variance: ((kpi.actual - kpi.target) / kpi.target) * 100,
        trend: randomItem(['up', 'down', 'stable']),
        period: 'January 2026',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }

    await batch.commit();

    return {
      success: true,
      module: 'Strategy - OKRs & KPIs',
      recordsCreated: objectives.length + kpis.length,
      duration: Date.now() - startTime,
    };
  } catch (error) {
    return {
      success: false,
      module: 'Strategy - OKRs & KPIs',
      recordsCreated: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration: Date.now() - startTime,
    };
  }
};

// ============================================================================
// MAIN SEEDER
// ============================================================================

export const seedAllTestData = async (): Promise<SeedResult[]> => {
  const results: SeedResult[] = [];

  // Run all seeders with error logging
  try {
    console.log('[Seeder] Starting seedAccounts...');
    const accountsResult = await seedAccounts();
    console.log('[Seeder] seedAccounts result:', accountsResult);
    results.push(accountsResult);
  } catch (e) {
    console.error('[Seeder] seedAccounts failed:', e);
    results.push({ success: false, module: 'Finance - Accounts', recordsCreated: 0, error: String(e), duration: 0 });
  }

  try {
    console.log('[Seeder] Starting seedBudgets...');
    const budgetsResult = await seedBudgets();
    console.log('[Seeder] seedBudgets result:', budgetsResult);
    results.push(budgetsResult);
  } catch (e) {
    console.error('[Seeder] seedBudgets failed:', e);
    results.push({ success: false, module: 'Finance - Budgets', recordsCreated: 0, error: String(e), duration: 0 });
  }

  try {
    console.log('[Seeder] Starting seedEmployees...');
    const employeesResult = await seedEmployees();
    console.log('[Seeder] seedEmployees result:', employeesResult);
    results.push(employeesResult);
  } catch (e) {
    console.error('[Seeder] seedEmployees failed:', e);
    results.push({ success: false, module: 'HR - Employees', recordsCreated: 0, error: String(e), duration: 0 });
  }

  try {
    console.log('[Seeder] Starting seedStrategyData...');
    const strategyResult = await seedStrategyData();
    console.log('[Seeder] seedStrategyData result:', strategyResult);
    results.push(strategyResult);
  } catch (e) {
    console.error('[Seeder] seedStrategyData failed:', e);
    results.push({ success: false, module: 'Strategy - OKRs & KPIs', recordsCreated: 0, error: String(e), duration: 0 });
  }

  return results;
};

export default {
  seedAccounts,
  seedBudgets,
  seedEmployees,
  seedStrategyData,
  seedAllTestData,
};
