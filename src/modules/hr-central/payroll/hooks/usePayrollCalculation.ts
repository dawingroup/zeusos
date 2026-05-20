/**
 * Payroll Calculation Hooks
 * DawinOS HR Central - Payroll Module
 * 
 * React hooks for payroll calculations, history, and tax previews.
 */

import { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  calculateEmployeePayroll,
  getPayroll,
  getPayrollHistory,
  getPayrollsForPeriod,
  getPayrollSummary,
  approvePayroll,
  markPayrollPaid
} from '../services/payroll-calculator.service';
import { 
  EmployeePayroll, 
  CalculatePayrollInput,
  EmployeePayrollSummary,
  PayrollSummary
} from '../types/payroll.types';
import {
  calculatePAYE,
  calculateNSSF,
  calculateLST,
  formatCurrency,
  getRemainingMonthsInFiscalYear
} from '../utils/tax-calculator';
import { PAYEBreakdown, NSSFBreakdown, LSTBreakdown } from '../types/payroll.types';

// ============================================================================
// usePayrollCalculation - Calculate individual employee payroll
// ============================================================================

interface UsePayrollCalculationReturn {
  payroll: EmployeePayroll | null;
  isCalculating: boolean;
  error: string | null;
  calculatePayroll: (input: CalculatePayrollInput) => Promise<EmployeePayroll | null>;
  clearPayroll: () => void;
  clearError: () => void;
}

/**
 * Hook for calculating individual employee payroll
 */
export function usePayrollCalculation(userId: string): UsePayrollCalculationReturn {
  const [payroll, setPayroll] = useState<EmployeePayroll | null>(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const calculatePayrollFn = useCallback(async (
    input: CalculatePayrollInput
  ): Promise<EmployeePayroll | null> => {
    if (!userId) {
      setError('User not authenticated');
      return null;
    }

    setIsCalculating(true);
    setError(null);

    try {
      const result = await calculateEmployeePayroll(input, userId);
      setPayroll(result);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to calculate payroll';
      setError(message);
      return null;
    } finally {
      setIsCalculating(false);
    }
  }, [userId]);

  const clearPayroll = useCallback(() => {
    setPayroll(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    payroll,
    isCalculating,
    error,
    calculatePayroll: calculatePayrollFn,
    clearPayroll,
    clearError
  };
}

// ============================================================================
// usePayrollHistory - Fetch employee payroll history
// ============================================================================

interface UsePayrollHistoryReturn {
  payrolls: EmployeePayroll[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching employee payroll history
 */
export function usePayrollHistory(
  employeeId: string,
  options?: { year?: number; limitCount?: number }
): UsePayrollHistoryReturn {
  const [payrolls, setPayrolls] = useState<EmployeePayroll[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!employeeId) {
      setPayrolls([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const history = await getPayrollHistory(employeeId, options);
      setPayrolls(history);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch payroll history';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [employeeId, options?.year, options?.limitCount]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return {
    payrolls,
    isLoading,
    error,
    refresh: fetchHistory
  };
}

// ============================================================================
// usePayrollPeriod - Fetch payroll for a specific period
// ============================================================================

interface UsePayrollPeriodReturn {
  payrolls: EmployeePayrollSummary[];
  summary: PayrollSummary | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching payrolls for a period
 */
export function usePayrollPeriod(
  subsidiaryId: string,
  year: number,
  month: number
): UsePayrollPeriodReturn {
  const [payrolls, setPayrolls] = useState<EmployeePayrollSummary[]>([]);
  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPeriod = useCallback(async () => {
    if (!subsidiaryId || !year || !month) {
      setPayrolls([]);
      setSummary(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const [periodPayrolls, periodSummary] = await Promise.all([
        getPayrollsForPeriod(subsidiaryId, year, month),
        getPayrollSummary(subsidiaryId, year, month)
      ]);
      setPayrolls(periodPayrolls);
      setSummary(periodSummary);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch payroll period';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [subsidiaryId, year, month]);

  useEffect(() => {
    fetchPeriod();
  }, [fetchPeriod]);

  return {
    payrolls,
    summary,
    isLoading,
    error,
    refresh: fetchPeriod
  };
}

// ============================================================================
// usePayrollDetails - Fetch single payroll details
// ============================================================================

interface UsePayrollDetailsReturn {
  payroll: EmployeePayroll | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching single payroll details
 */
export function usePayrollDetails(payrollId: string): UsePayrollDetailsReturn {
  const [payroll, setPayroll] = useState<EmployeePayroll | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPayroll = useCallback(async () => {
    if (!payrollId) {
      setPayroll(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await getPayroll(payrollId);
      setPayroll(result);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch payroll';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [payrollId]);

  useEffect(() => {
    fetchPayroll();
  }, [fetchPayroll]);

  return {
    payroll,
    isLoading,
    error,
    refresh: fetchPayroll
  };
}

// ============================================================================
// useTaxCalculations - Real-time tax calculations preview
// ============================================================================

interface TaxCalculationResult {
  paye: PAYEBreakdown;
  nssf: NSSFBreakdown;
  lst: LSTBreakdown;
  totalStatutoryDeductions: number;
  formattedPAYE: string;
  formattedNSSFEmployee: string;
  formattedNSSFEmployer: string;
  formattedLST: string;
  formattedTotal: string;
  formattedGross: string;
  formattedNet: string;
}

interface UseTaxCalculationsOptions {
  nssfApplicableGross?: number;
  ytdGross?: number;
  ytdLSTPaid?: number;
  remainingMonths?: number;
  employeeAge?: number;
}

/**
 * Hook for real-time tax calculations (preview)
 */
export function useTaxCalculations(
  monthlyGross: number,
  options?: UseTaxCalculationsOptions
): TaxCalculationResult {
  return useMemo(() => {
    const nssfApplicable = options?.nssfApplicableGross ?? monthlyGross;
    
    const paye = calculatePAYE(monthlyGross);
    const nssf = calculateNSSF(nssfApplicable, {
      employeeAge: options?.employeeAge
    });
    
    const remainingMonths = options?.remainingMonths ?? 
      getRemainingMonthsInFiscalYear(new Date());
    
    const lst = calculateLST(
      monthlyGross,
      options?.ytdGross || 0,
      options?.ytdLSTPaid || 0,
      remainingMonths
    );

    const totalStatutoryDeductions = 
      paye.netPAYE + nssf.employeeContribution + lst.monthlyLST;
    
    const netPay = monthlyGross - totalStatutoryDeductions;

    return {
      paye,
      nssf,
      lst,
      totalStatutoryDeductions,
      formattedPAYE: formatCurrency(paye.netPAYE),
      formattedNSSFEmployee: formatCurrency(nssf.employeeContribution),
      formattedNSSFEmployer: formatCurrency(nssf.employerContribution),
      formattedLST: formatCurrency(lst.monthlyLST),
      formattedTotal: formatCurrency(totalStatutoryDeductions),
      formattedGross: formatCurrency(monthlyGross),
      formattedNet: formatCurrency(netPay)
    };
  }, [
    monthlyGross,
    options?.nssfApplicableGross,
    options?.ytdGross,
    options?.ytdLSTPaid,
    options?.remainingMonths,
    options?.employeeAge
  ]);
}

// ============================================================================
// usePayrollApproval - Approve payroll records
// ============================================================================

interface UsePayrollApprovalReturn {
  isApproving: boolean;
  error: string | null;
  approve: (payrollId: string, notes?: string) => Promise<EmployeePayroll | null>;
  markPaid: (payrollId: string) => Promise<EmployeePayroll | null>;
  clearError: () => void;
}

/**
 * Hook for approving payroll records
 */
export function usePayrollApproval(userId: string): UsePayrollApprovalReturn {
  const [isApproving, setIsApproving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const approve = useCallback(async (
    payrollId: string,
    notes?: string
  ): Promise<EmployeePayroll | null> => {
    if (!userId) {
      setError('User not authenticated');
      return null;
    }

    setIsApproving(true);
    setError(null);

    try {
      const result = await approvePayroll(payrollId, userId, notes);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to approve payroll';
      setError(message);
      return null;
    } finally {
      setIsApproving(false);
    }
  }, [userId]);

  const markPaid = useCallback(async (
    payrollId: string
  ): Promise<EmployeePayroll | null> => {
    if (!userId) {
      setError('User not authenticated');
      return null;
    }

    setIsApproving(true);
    setError(null);

    try {
      const result = await markPayrollPaid(payrollId, userId);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to mark payroll as paid';
      setError(message);
      return null;
    } finally {
      setIsApproving(false);
    }
  }, [userId]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    isApproving,
    error,
    approve,
    markPaid,
    clearError
  };
}

// ============================================================================
// useSalaryBreakdown - Get breakdown for salary input
// ============================================================================

interface SalaryBreakdownResult {
  basicSalary: number;
  allowances: number;
  grossPay: number;
  paye: number;
  nssf: number;
  lst: number;
  totalDeductions: number;
  netPay: number;
  effectiveTaxRate: number;
  formatted: {
    basicSalary: string;
    allowances: string;
    grossPay: string;
    paye: string;
    nssf: string;
    lst: string;
    totalDeductions: string;
    netPay: string;
    effectiveTaxRate: string;
  };
}

/**
 * Hook for salary breakdown with allowances
 */
export function useSalaryBreakdown(
  basicSalary: number,
  allowances: number = 0,
  options?: UseTaxCalculationsOptions
): SalaryBreakdownResult {
  return useMemo(() => {
    const grossPay = basicSalary + allowances;
    const taxCalc = calculatePAYE(grossPay);
    const nssfCalc = calculateNSSF(basicSalary, { employeeAge: options?.employeeAge });
    
    const remainingMonths = options?.remainingMonths ?? 
      getRemainingMonthsInFiscalYear(new Date());
    
    const lstCalc = calculateLST(
      grossPay,
      options?.ytdGross || 0,
      options?.ytdLSTPaid || 0,
      remainingMonths
    );

    const totalDeductions = taxCalc.netPAYE + nssfCalc.employeeContribution + lstCalc.monthlyLST;
    const netPay = grossPay - totalDeductions;
    const effectiveTaxRate = grossPay > 0 ? (totalDeductions / grossPay) * 100 : 0;

    return {
      basicSalary,
      allowances,
      grossPay,
      paye: taxCalc.netPAYE,
      nssf: nssfCalc.employeeContribution,
      lst: lstCalc.monthlyLST,
      totalDeductions,
      netPay,
      effectiveTaxRate,
      formatted: {
        basicSalary: formatCurrency(basicSalary),
        allowances: formatCurrency(allowances),
        grossPay: formatCurrency(grossPay),
        paye: formatCurrency(taxCalc.netPAYE),
        nssf: formatCurrency(nssfCalc.employeeContribution),
        lst: formatCurrency(lstCalc.monthlyLST),
        totalDeductions: formatCurrency(totalDeductions),
        netPay: formatCurrency(netPay),
        effectiveTaxRate: `${effectiveTaxRate.toFixed(2)}%`
      }
    };
  }, [
    basicSalary,
    allowances,
    options?.employeeAge,
    options?.ytdGross,
    options?.ytdLSTPaid,
    options?.remainingMonths
  ]);
}
