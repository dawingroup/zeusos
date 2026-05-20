// ============================================================================
// USE REPORT GENERATOR HOOK
// DawinOS v2.0 - Financial Management Module
// Hook for report catalog and generation utilities
// ============================================================================

import { useState, useCallback, useMemo } from 'react';
import {
  REPORT_TYPES,
  REPORT_CATEGORIES,
  REPORTS_BY_CATEGORY,
  REPORT_TYPE_LABELS,
  REPORT_CATEGORY_LABELS,
  REPORT_PERIODS,
  ReportType,
  ReportCategory,
  ReportPeriod,
  getFiscalYear,
  getFiscalYearDates,
} from '../constants/reporting.constants';
import { ReportParameters, GeneratedReport } from '../types/reporting.types';
import { getReports } from '../services/reportingService';

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

interface ReportCatalogItem {
  type: ReportType;
  label: string;
  category: ReportCategory;
  categoryLabel: string;
  description: string;
}

interface UseReportGeneratorReturn {
  // Report catalog
  reportCatalog: ReportCatalogItem[];
  reportsByCategory: Record<ReportCategory, ReportCatalogItem[]>;
  
  // Recent reports
  recentReports: GeneratedReport[];
  loadRecentReports: (companyId: string) => Promise<void>;
  isLoadingRecent: boolean;
  
  // Period helpers
  getCurrentFiscalYear: () => number;
  getFiscalYearPeriod: (fiscalYear: number) => { start: Date; end: Date };
  getQuarterPeriod: (year: number, quarter: number) => { start: Date; end: Date };
  getMonthPeriod: (year: number, month: number) => { start: Date; end: Date };
  getDefaultPeriod: (periodType: ReportPeriod) => { start: Date; end: Date };
  
  // Validation
  validateParameters: (params: Partial<ReportParameters>) => string[];
}

// ----------------------------------------------------------------------------
// REPORT DESCRIPTIONS
// ----------------------------------------------------------------------------

const REPORT_DESCRIPTIONS: Record<ReportType, string> = {
  [REPORT_TYPES.INCOME_STATEMENT]: 'Revenue, expenses, and net profit for a period',
  [REPORT_TYPES.BALANCE_SHEET]: 'Assets, liabilities, and equity at a point in time',
  [REPORT_TYPES.CASH_FLOW_STATEMENT]: 'Cash inflows and outflows by activity',
  [REPORT_TYPES.TRIAL_BALANCE]: 'All account balances with debit/credit columns',
  [REPORT_TYPES.GENERAL_LEDGER]: 'Detailed transaction listing by account',
  [REPORT_TYPES.BUDGET_VARIANCE]: 'Budget vs actual comparison with variances',
  [REPORT_TYPES.DEPARTMENTAL_PL]: 'Profit & Loss by department',
  [REPORT_TYPES.PROJECT_PROFITABILITY]: 'Revenue and costs by project',
  [REPORT_TYPES.AGED_RECEIVABLES]: 'Outstanding receivables by age',
  [REPORT_TYPES.AGED_PAYABLES]: 'Outstanding payables by age',
  [REPORT_TYPES.VAT_RETURN]: 'Uganda VAT return (18% standard rate)',
  [REPORT_TYPES.WHT_REPORT]: 'Withholding tax deductions report',
  [REPORT_TYPES.PAYE_RETURN]: 'Pay As You Earn monthly return',
  [REPORT_TYPES.NSSF_RETURN]: 'NSSF contributions report',
  [REPORT_TYPES.LST_RETURN]: 'Local Service Tax return',
};

// ----------------------------------------------------------------------------
// HOOK
// ----------------------------------------------------------------------------

export const useReportGenerator = (): UseReportGeneratorReturn => {
  const [recentReports, setRecentReports] = useState<GeneratedReport[]>([]);
  const [isLoadingRecent, setIsLoadingRecent] = useState(false);

  // Build report catalog
  const reportCatalog = useMemo((): ReportCatalogItem[] => {
    const catalog: ReportCatalogItem[] = [];
    
    Object.entries(REPORTS_BY_CATEGORY).forEach(([category, types]) => {
      types.forEach((type) => {
        catalog.push({
          type,
          label: REPORT_TYPE_LABELS[type],
          category: category as ReportCategory,
          categoryLabel: REPORT_CATEGORY_LABELS[category as ReportCategory],
          description: REPORT_DESCRIPTIONS[type],
        });
      });
    });
    
    return catalog;
  }, []);

  // Group by category
  const reportsByCategory = useMemo((): Record<ReportCategory, ReportCatalogItem[]> => {
    const grouped: Record<ReportCategory, ReportCatalogItem[]> = {
      [REPORT_CATEGORIES.FINANCIAL_STATEMENTS]: [],
      [REPORT_CATEGORIES.MANAGEMENT_REPORTS]: [],
      [REPORT_CATEGORIES.TAX_REPORTS]: [],
    };
    
    reportCatalog.forEach((item) => {
      grouped[item.category].push(item);
    });
    
    return grouped;
  }, [reportCatalog]);

  // Load recent reports
  const loadRecentReports = useCallback(async (companyId: string) => {
    setIsLoadingRecent(true);
    try {
      const reports = await getReports({ createdBy: companyId });
      setRecentReports(reports);
    } catch (error) {
      console.error('Error loading recent reports:', error);
    } finally {
      setIsLoadingRecent(false);
    }
  }, []);

  // Period helpers
  const getCurrentFiscalYear = useCallback((): number => {
    return getFiscalYear(new Date());
  }, []);

  const getFiscalYearPeriod = useCallback((fiscalYear: number): { start: Date; end: Date } => {
    return getFiscalYearDates(fiscalYear);
  }, []);

  const getQuarterPeriod = useCallback((year: number, quarter: number): { start: Date; end: Date } => {
    // Uganda fiscal year quarters (July-June)
    const quarterMonths = [
      [6, 8],   // Q1: Jul-Sep
      [9, 11],  // Q2: Oct-Dec
      [0, 2],   // Q3: Jan-Mar
      [3, 5],   // Q4: Apr-Jun
    ];
    
    const [startMonth, endMonth] = quarterMonths[quarter - 1] || [6, 8];
    const startYear = startMonth >= 6 ? year - 1 : year;
    const endYear = endMonth >= 6 ? year - 1 : year;
    
    return {
      start: new Date(startYear, startMonth, 1),
      end: new Date(endYear, endMonth + 1, 0), // Last day of end month
    };
  }, []);

  const getMonthPeriod = useCallback((year: number, month: number): { start: Date; end: Date } => {
    return {
      start: new Date(year, month, 1),
      end: new Date(year, month + 1, 0), // Last day of month
    };
  }, []);

  const getDefaultPeriod = useCallback((periodType: ReportPeriod): { start: Date; end: Date } => {
    const today = new Date();
    const currentFY = getFiscalYear(today);
    
    switch (periodType) {
      case REPORT_PERIODS.MONTHLY:
        return getMonthPeriod(today.getFullYear(), today.getMonth());
      
      case REPORT_PERIODS.QUARTERLY: {
        const currentQuarter = Math.floor(((today.getMonth() + 6) % 12) / 3) + 1;
        return getQuarterPeriod(currentFY, currentQuarter);
      }
      
      case REPORT_PERIODS.SEMI_ANNUAL: {
        const fyDates = getFiscalYearDates(currentFY);
        const midYear = new Date(fyDates.start);
        midYear.setMonth(midYear.getMonth() + 6);
        
        if (today < midYear) {
          return { start: fyDates.start, end: new Date(midYear.getTime() - 86400000) };
        }
        return { start: midYear, end: fyDates.end };
      }
      
      case REPORT_PERIODS.ANNUAL:
        return getFiscalYearDates(currentFY);
      
      case REPORT_PERIODS.YTD:
        return { start: getFiscalYearDates(currentFY).start, end: today };
      
      case REPORT_PERIODS.CUSTOM:
      default:
        // Default to last 30 days
        const thirtyDaysAgo = new Date(today);
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        return { start: thirtyDaysAgo, end: today };
    }
  }, [getMonthPeriod, getQuarterPeriod]);

  // Validation
  const validateParameters = useCallback((params: Partial<ReportParameters>): string[] => {
    const errors: string[] = [];
    
    if (!params.reportType) {
      errors.push('Report type is required');
    }
    
    if (!params.companyId) {
      errors.push('Company ID is required');
    }
    
    if (!params.startDate) {
      errors.push('Start date is required');
    }
    
    if (!params.endDate) {
      errors.push('End date is required');
    }
    
    if (params.startDate && params.endDate && params.startDate > params.endDate) {
      errors.push('Start date must be before end date');
    }
    
    if (params.comparisonType && params.comparisonType !== 'none') {
      if (params.comparisonType === 'budget' && !params.budgetId) {
        errors.push('Budget must be selected for budget comparison');
      }
    }
    
    return errors;
  }, []);

  return {
    reportCatalog,
    reportsByCategory,
    recentReports,
    loadRecentReports,
    isLoadingRecent,
    getCurrentFiscalYear,
    getFiscalYearPeriod,
    getQuarterPeriod,
    getMonthPeriod,
    getDefaultPeriod,
    validateParameters,
  };
};

export default useReportGenerator;
