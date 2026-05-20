/**
 * useTestRunner Hook
 * DawinOS v2.0 - Testing Framework
 * Hook for running and tracking tests against actual services
 */

import { useState, useCallback } from 'react';
import { db } from '@/core/services/firebase/firestore';
import {
  collection,
  getDocs,
  query,
  limit,
  orderBy,
  where,
} from 'firebase/firestore';

// ============================================================================
// TYPES
// ============================================================================

export type TestStatus = 'pending' | 'running' | 'passed' | 'failed';

export interface TestResult {
  id: string;
  name: string;
  module: string;
  status: TestStatus;
  message?: string;
  duration?: number;
  error?: string;
  data?: unknown;
}

export interface TestMetrics {
  total: number;
  passed: number;
  failed: number;
  pending: number;
  running: number;
  avgDuration: number;
}

// ============================================================================
// TEST DEFINITIONS
// ============================================================================

interface TestDefinition {
  id: string;
  name: string;
  module: string;
  run: () => Promise<{ success: boolean; message: string; data?: unknown }>;
}

// Finance Module Tests
const financeTests: TestDefinition[] = [
  {
    id: 'fin-accounts-load',
    name: 'Load Chart of Accounts',
    module: 'finance',
    run: async () => {
      const accountsRef = collection(db, 'accounts');
      const q = query(accountsRef, orderBy('code'), limit(50));
      const snapshot = await getDocs(q);
      return {
        success: snapshot.docs.length > 0,
        message: `Loaded ${snapshot.docs.length} accounts`,
        data: { count: snapshot.docs.length },
      };
    },
  },
  {
    id: 'fin-accounts-hierarchy',
    name: 'Verify Account Hierarchy',
    module: 'finance',
    run: async () => {
      const accountsRef = collection(db, 'accounts');
      const q = query(accountsRef, where('level', '==', 1));
      const snapshot = await getDocs(q);
      const hasRootAccounts = snapshot.docs.length > 0;
      return {
        success: hasRootAccounts,
        message: hasRootAccounts
          ? `Found ${snapshot.docs.length} root accounts`
          : 'No root accounts found',
        data: { rootAccounts: snapshot.docs.length },
      };
    },
  },
  {
    id: 'fin-budgets-load',
    name: 'Load Budgets',
    module: 'finance',
    run: async () => {
      const budgetsRef = collection(db, 'budgets');
      const q = query(budgetsRef, limit(20));
      const snapshot = await getDocs(q);
      return {
        success: true,
        message: `Loaded ${snapshot.docs.length} budgets`,
        data: { count: snapshot.docs.length },
      };
    },
  },
  {
    id: 'fin-budget-lines-load',
    name: 'Load Budget Line Items',
    module: 'finance',
    run: async () => {
      const linesRef = collection(db, 'budgetLines');
      const q = query(linesRef, limit(50));
      const snapshot = await getDocs(q);
      return {
        success: true,
        message: `Loaded ${snapshot.docs.length} budget line items`,
        data: { count: snapshot.docs.length },
      };
    },
  },
];

// HR Module Tests
const hrTests: TestDefinition[] = [
  {
    id: 'hr-employees-load',
    name: 'Load Employees',
    module: 'hr',
    run: async () => {
      const employeesRef = collection(db, 'employees');
      const q = query(employeesRef, limit(50));
      const snapshot = await getDocs(q);
      return {
        success: true,
        message: `Loaded ${snapshot.docs.length} employees`,
        data: { count: snapshot.docs.length },
      };
    },
  },
  {
    id: 'hr-employees-active',
    name: 'Filter Active Employees',
    module: 'hr',
    run: async () => {
      const employeesRef = collection(db, 'employees');
      const q = query(employeesRef, where('status', '==', 'active'), limit(50));
      const snapshot = await getDocs(q);
      return {
        success: true,
        message: `Found ${snapshot.docs.length} active employees`,
        data: { activeCount: snapshot.docs.length },
      };
    },
  },
];

// Strategy Module Tests
const strategyTests: TestDefinition[] = [
  {
    id: 'str-okrs-load',
    name: 'Load OKRs',
    module: 'strategy',
    run: async () => {
      const okrsRef = collection(db, 'okrs');
      const q = query(okrsRef, limit(20));
      const snapshot = await getDocs(q);
      return {
        success: true,
        message: `Loaded ${snapshot.docs.length} OKRs`,
        data: { count: snapshot.docs.length },
      };
    },
  },
  {
    id: 'str-kpis-load',
    name: 'Load KPIs',
    module: 'strategy',
    run: async () => {
      const kpisRef = collection(db, 'kpis');
      const q = query(kpisRef, limit(20));
      const snapshot = await getDocs(q);
      return {
        success: true,
        message: `Loaded ${snapshot.docs.length} KPIs`,
        data: { count: snapshot.docs.length },
      };
    },
  },
];

// All tests
const allTestDefinitions: TestDefinition[] = [
  ...financeTests,
  ...hrTests,
  ...strategyTests,
];

// ============================================================================
// HOOK
// ============================================================================

export const useTestRunner = () => {
  const [results, setResults] = useState<TestResult[]>(
    allTestDefinitions.map(t => ({
      id: t.id,
      name: t.name,
      module: t.module,
      status: 'pending' as TestStatus,
    }))
  );
  const [isRunning, setIsRunning] = useState(false);

  const runTest = useCallback(async (testId: string) => {
    const testDef = allTestDefinitions.find(t => t.id === testId);
    if (!testDef) return;

    setResults(prev =>
      prev.map(r => (r.id === testId ? { ...r, status: 'running' } : r))
    );

    const startTime = Date.now();

    try {
      const result = await testDef.run();
      const duration = Date.now() - startTime;

      setResults(prev =>
        prev.map(r =>
          r.id === testId
            ? {
                ...r,
                status: result.success ? 'passed' : 'failed',
                message: result.message,
                duration,
                data: result.data,
              }
            : r
        )
      );
    } catch (error) {
      const duration = Date.now() - startTime;
      setResults(prev =>
        prev.map(r =>
          r.id === testId
            ? {
                ...r,
                status: 'failed',
                message: 'Test threw an error',
                error: error instanceof Error ? error.message : 'Unknown error',
                duration,
              }
            : r
        )
      );
    }
  }, []);

  const runAllTests = useCallback(async () => {
    setIsRunning(true);
    for (const test of allTestDefinitions) {
      await runTest(test.id);
    }
    setIsRunning(false);
  }, [runTest]);

  const runModuleTests = useCallback(async (module: string) => {
    setIsRunning(true);
    const moduleTests = allTestDefinitions.filter(t => t.module === module);
    for (const test of moduleTests) {
      await runTest(test.id);
    }
    setIsRunning(false);
  }, [runTest]);

  const resetTests = useCallback(() => {
    setResults(
      allTestDefinitions.map(t => ({
        id: t.id,
        name: t.name,
        module: t.module,
        status: 'pending' as TestStatus,
      }))
    );
  }, []);

  const getMetrics = useCallback((): TestMetrics => {
    const durations = results.filter(r => r.duration).map(r => r.duration!);
    return {
      total: results.length,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      pending: results.filter(r => r.status === 'pending').length,
      running: results.filter(r => r.status === 'running').length,
      avgDuration: durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
        : 0,
    };
  }, [results]);

  const getModuleResults = useCallback((module: string) => {
    return results.filter(r => r.module === module);
  }, [results]);

  return {
    results,
    isRunning,
    runTest,
    runAllTests,
    runModuleTests,
    resetTests,
    getMetrics,
    getModuleResults,
  };
};

export default useTestRunner;
