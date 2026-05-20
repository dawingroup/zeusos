// ============================================================================
// USE FINANCIAL REPORT HOOK
// DawinOS v2.0 - Financial Management Module
// Hook for generating and managing financial reports
// ============================================================================

import { useState, useCallback } from 'react';
import { useAuth } from '@/core/hooks/useAuth';
import {
  ReportParameters,
  GeneratedReport,
  IncomeStatement,
  BalanceSheet,
  TrialBalance,
  VATReturn,
} from '../types/reporting.types';
import {
  generateIncomeStatement,
  generateBalanceSheet,
  generateTrialBalance,
  generateVATReturn,
  getReport,
} from '../services/reportingService';
import { REPORT_TYPES, ReportType } from '../constants/reporting.constants';

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

interface UseFinancialReportReturn {
  report: GeneratedReport | IncomeStatement | BalanceSheet | TrialBalance | VATReturn | null;
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
  generateReport: (params: ReportParameters) => Promise<void>;
  loadReport: (reportId: string) => Promise<void>;
  clearReport: () => void;
}

// ----------------------------------------------------------------------------
// HOOK
// ----------------------------------------------------------------------------

export const useFinancialReport = (): UseFinancialReportReturn => {
  const { user } = useAuth();
  const [report, setReport] = useState<GeneratedReport | IncomeStatement | BalanceSheet | TrialBalance | VATReturn | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateReport = useCallback(async (params: ReportParameters) => {
    if (!user?.uid) {
      setError('User not authenticated');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      let generatedReport;

      switch (params.reportType as ReportType) {
        case REPORT_TYPES.INCOME_STATEMENT:
          generatedReport = await generateIncomeStatement(params, user.uid);
          break;
        case REPORT_TYPES.BALANCE_SHEET:
          generatedReport = await generateBalanceSheet(params, user.uid);
          break;
        case REPORT_TYPES.TRIAL_BALANCE:
          generatedReport = await generateTrialBalance(params, user.uid);
          break;
        case REPORT_TYPES.VAT_RETURN:
          generatedReport = await generateVATReturn(params, user.uid);
          break;
        default:
          throw new Error(`Unsupported report type: ${params.reportType}`);
      }

      setReport(generatedReport);
    } catch (err) {
      console.error('Error generating report:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate report');
    } finally {
      setIsGenerating(false);
    }
  }, [user]);

  const loadReport = useCallback(async (reportId: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const loadedReport = await getReport(reportId);
      if (loadedReport) {
        setReport(loadedReport);
      } else {
        setError('Report not found');
      }
    } catch (err) {
      console.error('Error loading report:', err);
      setError(err instanceof Error ? err.message : 'Failed to load report');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const clearReport = useCallback(() => {
    setReport(null);
    setError(null);
  }, []);

  return {
    report,
    isLoading,
    isGenerating,
    error,
    generateReport,
    loadReport,
    clearReport,
  };
};

export default useFinancialReport;
