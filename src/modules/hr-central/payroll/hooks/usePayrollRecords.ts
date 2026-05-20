/**
 * Payroll Records Hooks
 * DawinOS HR Central - React hooks for advances, overtime, attendance
 */

import { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { useCurrentUserId } from '@/contexts/AuthContext';
import {
  attendanceService,
  advanceService,
  overtimeService,
  otherDeductionsService,
  payrollSummaryService,
} from '../services/payroll-records.service';
import {
  AttendanceRecord,
  AttendanceStatus,
  AttendanceSummary,
  CreateAttendanceInput,
  SalaryAdvance,
  CreateAdvanceInput,
  OvertimeEntry,
  CreateOvertimeInput,
  PayrollPeriodSummary,
  AttendanceFilters,
  AdvanceFilters,
  OvertimeFilters,
} from '../types/payroll-records.types';

// ============================================================================
// ATTENDANCE HOOK
// ============================================================================

interface UseAttendanceReturn {
  records: AttendanceRecord[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createRecord: (input: CreateAttendanceInput, employeeName: string) => Promise<AttendanceRecord>;
  updateRecord: (id: string, updates: Partial<CreateAttendanceInput>) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  getEmployeeSummary: (employeeId: string, employeeName: string) => Promise<AttendanceSummary>;
  upsertMatrix: (
    cells: Array<{ employeeId: string; date: string; status: AttendanceStatus; notes?: string; hoursWorked?: number }>,
    employeeMap: Record<string, string>,
  ) => Promise<{ created: number; updated: number }>;
}

export function useAttendance(filters?: AttendanceFilters, period?: string): UseAttendanceReturn {
  const userId = useCurrentUserId();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let data: AttendanceRecord[];
      if (period) {
        data = await attendanceService.getMonthlyAttendance(period);
      } else {
        data = await attendanceService.getRecords(filters || {});
      }
      setRecords(data);
    } catch (err) {
      console.error('Failed to fetch attendance:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch attendance');
    } finally {
      setLoading(false);
    }
  }, [filters, period]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const createRecord = useCallback(async (input: CreateAttendanceInput, employeeName: string) => {
    const record = await attendanceService.create(input, employeeName, userId);
    setRecords(prev => [record, ...prev]);
    return record;
  }, []);

  const updateRecord = useCallback(async (id: string, updates: Partial<CreateAttendanceInput>) => {
    await attendanceService.update(id, updates);
    await fetchRecords();
  }, [fetchRecords]);

  const deleteRecord = useCallback(async (id: string) => {
    await attendanceService.delete(id);
    setRecords(prev => prev.filter(r => r.id !== id));
  }, []);

  const getEmployeeSummary = useCallback(async (employeeId: string, employeeName: string) => {
    const currentPeriod = period || format(new Date(), 'yyyy-MM');
    return attendanceService.getEmployeeSummary(employeeId, employeeName, currentPeriod);
  }, [period]);

  const upsertMatrix = useCallback(async (
    cells: Array<{ employeeId: string; date: string; status: AttendanceStatus; notes?: string; hoursWorked?: number }>,
    employeeMap: Record<string, string>,
  ) => {
    const targetPeriod = period || format(new Date(), 'yyyy-MM');
    const result = await attendanceService.upsertMatrix(cells, employeeMap, userId, targetPeriod);
    await fetchRecords();
    return result;
  }, [period, userId, fetchRecords]);

  return {
    records,
    loading,
    error,
    refetch: fetchRecords,
    createRecord,
    updateRecord,
    deleteRecord,
    getEmployeeSummary,
    upsertMatrix,
  };
}

// ============================================================================
// SALARY ADVANCE HOOK
// ============================================================================

interface UseAdvancesReturn {
  advances: SalaryAdvance[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createAdvance: (input: CreateAdvanceInput, employeeName: string) => Promise<SalaryAdvance>;
  approveAdvance: (advanceId: string, approved: boolean, rejectionReason?: string) => Promise<void>;
  disburseAdvance: (advanceId: string, method: SalaryAdvance['disbursementMethod'], reference?: string, startMonth?: string, disbursedAt?: string) => Promise<void>;
  updateAdvance: (advanceId: string, patch: import('../types/payroll-records.types').UpdateAdvanceInput) => Promise<void>;
  recordRecovery: (advanceId: string, amount: number, month: string, payrollId?: string) => Promise<void>;
  deleteAdvance: (advanceId: string) => Promise<void>;
  getEmployeeBalance: (employeeId: string) => Promise<number>;
}

export function useAdvances(filters?: AdvanceFilters): UseAdvancesReturn {
  const userId = useCurrentUserId();
  const [advances, setAdvances] = useState<SalaryAdvance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAdvances = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await advanceService.getAdvances(filters || {});
      setAdvances(data);
    } catch (err) {
      console.error('Failed to fetch advances:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch advances');
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchAdvances();
  }, [fetchAdvances]);

  const createAdvance = useCallback(async (input: CreateAdvanceInput, employeeName: string) => {
    const advance = await advanceService.create(input, employeeName, userId);
    setAdvances(prev => [advance, ...prev]);
    return advance;
  }, []);

  const approveAdvance = useCallback(async (advanceId: string, approved: boolean, rejectionReason?: string) => {
    await advanceService.approve({ advanceId, approved, rejectionReason }, userId);
    await fetchAdvances();
  }, [fetchAdvances]);

  const disburseAdvance = useCallback(async (
    advanceId: string,
    method: SalaryAdvance['disbursementMethod'],
    reference?: string,
    startMonth?: string,
    disbursedAt?: string,
  ) => {
    const recoveryStart = startMonth || format(new Date(), 'yyyy-MM');
    await advanceService.disburse({
      advanceId,
      disbursementMethod: method,
      disbursementReference: reference,
      recoveryStartMonth: recoveryStart,
      disbursedAt,
    }, userId);
    await fetchAdvances();
  }, [fetchAdvances]);

  const updateAdvance = useCallback(async (
    advanceId: string,
    patch: import('../types/payroll-records.types').UpdateAdvanceInput,
  ) => {
    await advanceService.update(advanceId, patch, userId);
    await fetchAdvances();
  }, [fetchAdvances]);

  const recordRecovery = useCallback(async (advanceId: string, amount: number, month: string, payrollId?: string) => {
    await advanceService.recordRecovery(advanceId, amount, month, payrollId);
    await fetchAdvances();
  }, [fetchAdvances]);

  const deleteAdvance = useCallback(async (advanceId: string) => {
    await advanceService.delete(advanceId);
    setAdvances(prev => prev.filter(a => a.id !== advanceId));
  }, []);

  const getEmployeeBalance = useCallback(async (employeeId: string) => {
    return advanceService.getEmployeeAdvanceBalance(employeeId);
  }, []);

  return {
    advances,
    loading,
    error,
    refetch: fetchAdvances,
    createAdvance,
    approveAdvance,
    disburseAdvance,
    updateAdvance,
    recordRecovery,
    deleteAdvance,
    getEmployeeBalance,
  };
}

// ============================================================================
// OVERTIME HOOK
// ============================================================================

interface UseOvertimeReturn {
  entries: OvertimeEntry[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createEntry: (input: CreateOvertimeInput, employeeName: string, hourlyRate: number) => Promise<OvertimeEntry>;
  approveEntry: (overtimeId: string, approved: boolean, rejectionReason?: string) => Promise<void>;
  updateEntry: (overtimeId: string, patch: {
    date?: string;
    type?: OvertimeEntry['type'];
    hours?: number;
    hourlyRate?: number;
    startTime?: string;
    endTime?: string;
    reason?: string;
    notes?: string;
  }) => Promise<void>;
  getEmployeeTotal: (employeeId: string, period: string) => Promise<{ hours: number; amount: number }>;
}

export function useOvertime(filters?: OvertimeFilters): UseOvertimeReturn {
  const userId = useCurrentUserId();
  const [entries, setEntries] = useState<OvertimeEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await overtimeService.getEntries(filters || {});
      setEntries(data);
    } catch (err) {
      console.error('Failed to fetch overtime:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch overtime');
    } finally {
      setLoading(false);
    }
    // Depend on primitive filter values, not the object identity — callers
    // pass fresh object literals every render, which would otherwise refire
    // the effect on every render and trap loading at true.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    filters?.employeeId,
    filters?.status,
    filters?.type,
    filters?.startDate,
    filters?.endDate,
    filters?.payrollPeriod,
  ]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const createEntry = useCallback(async (input: CreateOvertimeInput, employeeName: string, hourlyRate: number) => {
    const entry = await overtimeService.create(input, employeeName, hourlyRate, userId);
    setEntries(prev => [entry, ...prev]);
    return entry;
  }, []);

  const approveEntry = useCallback(async (overtimeId: string, approved: boolean, rejectionReason?: string) => {
    await overtimeService.approve({ overtimeId, approved, rejectionReason }, userId);
    await fetchEntries();
  }, [fetchEntries]);

  const updateEntry = useCallback(async (overtimeId: string, patch: {
    date?: string;
    type?: OvertimeEntry['type'];
    hours?: number;
    hourlyRate?: number;
    startTime?: string;
    endTime?: string;
    reason?: string;
    notes?: string;
  }) => {
    await overtimeService.update(overtimeId, patch, userId);
    await fetchEntries();
  }, [fetchEntries, userId]);

  const getEmployeeTotal = useCallback(async (employeeId: string, period: string) => {
    return overtimeService.getEmployeeOvertimeTotal(employeeId, period);
  }, []);

  return {
    entries,
    loading,
    error,
    refetch: fetchEntries,
    createEntry,
    approveEntry,
    updateEntry,
    getEmployeeTotal,
  };
}

// ============================================================================
// PAYROLL PERIOD SUMMARY HOOK
// ============================================================================

interface UsePayrollSummaryReturn {
  summary: PayrollPeriodSummary | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePayrollSummary(period: string, employeeCount: number): UsePayrollSummaryReturn {
  const [summary, setSummary] = useState<PayrollPeriodSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    if (!period || employeeCount === 0) {
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const data = await payrollSummaryService.getPeriodSummary(period, employeeCount);
      setSummary(data);
    } catch (err) {
      console.error('Failed to fetch payroll summary:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch summary');
    } finally {
      setLoading(false);
    }
  }, [period, employeeCount]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  return {
    summary,
    loading,
    error,
    refetch: fetchSummary,
  };
}

// ============================================================================
// COMBINED PAYROLL RECORDS HOOK
// ============================================================================

interface UsePayrollRecordsReturn {
  attendance: UseAttendanceReturn;
  advances: UseAdvancesReturn;
  overtime: UseOvertimeReturn;
  summary: UsePayrollSummaryReturn;
}

export function usePayrollRecords(period: string, employeeCount: number): UsePayrollRecordsReturn {
  const attendance = useAttendance(undefined, period);
  const advances = useAdvances();
  const overtime = useOvertime({ 
    startDate: `${period}-01`, 
    endDate: `${period}-31` 
  });
  const summary = usePayrollSummary(period, employeeCount);

  return {
    attendance,
    advances,
    overtime,
    summary,
  };
}

// ============================================================================
// OTHER DEDUCTIONS HOOK
// ============================================================================

interface UseOtherDeductionsReturn {
  deductions: import('../types/payroll-records.types').EmployeeDeduction[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createDeduction: (
    input: import('../types/payroll-records.types').CreateEmployeeDeductionInput,
    employeeName: string,
  ) => Promise<import('../types/payroll-records.types').EmployeeDeduction>;
  createBulkDeductions: (
    input: Omit<import('../types/payroll-records.types').CreateEmployeeDeductionInput, 'employeeId'>,
    employees: Array<{ id: string; fullName: string }>,
  ) => Promise<import('../types/payroll-records.types').EmployeeDeduction[]>;
  updateDeduction: (
    id: string,
    patch: import('../types/payroll-records.types').UpdateEmployeeDeductionInput,
  ) => Promise<void>;
  cancelDeduction: (id: string) => Promise<void>;
  activateDeduction: (id: string) => Promise<void>;
  deleteDeduction: (id: string) => Promise<void>;
}

export function useOtherDeductions(filters?: { employeeId?: string }): UseOtherDeductionsReturn {
  const userId = useCurrentUserId();
  const [deductions, setDeductions] = useState<import('../types/payroll-records.types').EmployeeDeduction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await otherDeductionsService.list(filters);
      setDeductions(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch deductions');
    } finally {
      setLoading(false);
    }
  }, [filters?.employeeId]);

  useEffect(() => { fetch(); }, [fetch]);

  const createDeduction = useCallback(async (
    input: import('../types/payroll-records.types').CreateEmployeeDeductionInput,
    employeeName: string,
  ) => {
    const created = await otherDeductionsService.create(input, employeeName, userId);
    setDeductions(prev => [created, ...prev]);
    return created;
  }, [userId]);

  const createBulkDeductions = useCallback(async (
    input: Omit<import('../types/payroll-records.types').CreateEmployeeDeductionInput, 'employeeId'>,
    employees: Array<{ id: string; fullName: string }>,
  ) => {
    const created = await otherDeductionsService.createBulk(input, employees, userId);
    setDeductions(prev => [...created, ...prev]);
    return created;
  }, [userId]);

  const updateDeduction = useCallback(async (
    id: string,
    patch: import('../types/payroll-records.types').UpdateEmployeeDeductionInput,
  ) => {
    await otherDeductionsService.update(id, patch, userId);
    await fetch();
  }, [fetch, userId]);

  const cancelDeduction = useCallback(async (id: string) => {
    await otherDeductionsService.cancel(id, userId);
    await fetch();
  }, [fetch, userId]);

  const activateDeduction = useCallback(async (id: string) => {
    await otherDeductionsService.activate(id, userId);
    await fetch();
  }, [fetch, userId]);

  const deleteDeduction = useCallback(async (id: string) => {
    await otherDeductionsService.delete(id);
    setDeductions(prev => prev.filter(d => d.id !== id));
  }, []);

  return { deductions, loading, error, refetch: fetch, createDeduction, createBulkDeductions, updateDeduction, cancelDeduction, activateDeduction, deleteDeduction };
}

export default usePayrollRecords;
