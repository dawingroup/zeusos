// ============================================================================
// REPORT FILTERS COMPONENT
// DawinOS v2.0 - Financial Management Module
// Filter controls for generating financial reports
// ============================================================================

import React, { useState, useEffect } from 'react';
import {
  REPORT_TYPES,
  REPORT_PERIODS,
  COMPARISON_TYPES,
  REPORTS_BY_CATEGORY,
  REPORT_TYPE_LABELS,
  REPORT_PERIOD_LABELS,
  COMPARISON_TYPE_LABELS,
  ReportType,
  ReportPeriod,
  ComparisonType,
  getFiscalYear,
} from '../../constants/reporting.constants';
import { ReportParameters } from '../../types/reporting.types';
import {
  FileText,
  Calendar,
  GitCompare,
  Settings,
  ChevronDown,
  ChevronUp,
  Play,
} from 'lucide-react';

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

interface ReportFiltersProps {
  onGenerate: (params: ReportParameters) => void;
  isGenerating?: boolean;
  initialParams?: Partial<ReportParameters>;
  companyId: string;
  departments?: Array<{ id: string; name: string }>;
  budgets?: Array<{ id: string; name: string }>;
}

// ----------------------------------------------------------------------------
// COMPONENT
// ----------------------------------------------------------------------------

export const ReportFilters: React.FC<ReportFiltersProps> = ({
  onGenerate,
  isGenerating = false,
  initialParams,
  companyId,
  departments = [],
  budgets = [],
}) => {
  const currentFY = getFiscalYear(new Date());
  const today = new Date();

  // State
  const [reportType, setReportType] = useState<ReportType>(
    initialParams?.reportType || REPORT_TYPES.INCOME_STATEMENT
  );
  const [periodType, setPeriodType] = useState<ReportPeriod>(
    initialParams?.periodType || REPORT_PERIODS.YTD
  );
  const [startDate, setStartDate] = useState<string>(
    initialParams?.startDate?.toISOString().split('T')[0] || 
    new Date(currentFY - 1, 6, 1).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState<string>(
    initialParams?.endDate?.toISOString().split('T')[0] || 
    today.toISOString().split('T')[0]
  );
  const [fiscalYear, setFiscalYear] = useState<number>(currentFY);
  const [comparisonType, setComparisonType] = useState<ComparisonType>(COMPARISON_TYPES.NONE);
  const [budgetId, setBudgetId] = useState<string>('');
  const [departmentId, setDepartmentId] = useState<string>('');
  const [showZeroBalances, setShowZeroBalances] = useState(false);
  const [showAccountCodes, setShowAccountCodes] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Update dates based on period type
  useEffect(() => {
    const now = new Date();
    switch (periodType) {
      case REPORT_PERIODS.MONTHLY:
        setStartDate(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0]);
        setEndDate(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0]);
        break;
      case REPORT_PERIODS.QUARTERLY: {
        const q = Math.floor(now.getMonth() / 3);
        setStartDate(new Date(now.getFullYear(), q * 3, 1).toISOString().split('T')[0]);
        setEndDate(new Date(now.getFullYear(), (q + 1) * 3, 0).toISOString().split('T')[0]);
        break;
      }
      case REPORT_PERIODS.ANNUAL:
        setStartDate(new Date(fiscalYear - 1, 6, 1).toISOString().split('T')[0]);
        setEndDate(new Date(fiscalYear, 5, 30).toISOString().split('T')[0]);
        break;
      case REPORT_PERIODS.YTD:
        setStartDate(new Date(fiscalYear - 1, 6, 1).toISOString().split('T')[0]);
        setEndDate(now.toISOString().split('T')[0]);
        break;
      case REPORT_PERIODS.CUSTOM:
        // Keep current dates
        break;
    }
  }, [periodType, fiscalYear]);

  // Handle generate
  const handleGenerate = () => {
    const params: ReportParameters = {
      reportType,
      companyId,
      periodType,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      fiscalYear,
      comparisonType: comparisonType !== COMPARISON_TYPES.NONE ? comparisonType : undefined,
      budgetId: comparisonType === COMPARISON_TYPES.BUDGET ? budgetId : undefined,
      departmentId: departmentId || undefined,
      showZeroBalances,
      showAccountCodes,
      showSubtotals: true,
      currency: 'UGX',
    };

    onGenerate(params);
  };

  // Fiscal year options
  const fiscalYearOptions = Array.from({ length: 7 }, (_, i) => currentFY - 5 + i);

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
      <div className="p-5">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5 text-[#872E5C]" />
          Report Parameters
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Report Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Report Type
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value as ReportType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#872E5C]/20 focus:border-[#872E5C]"
            >
              <optgroup label="Financial Statements">
                {REPORTS_BY_CATEGORY.financial_statements.map((rt) => (
                  <option key={rt} value={rt}>{REPORT_TYPE_LABELS[rt]}</option>
                ))}
              </optgroup>
              <optgroup label="Management Reports">
                {REPORTS_BY_CATEGORY.management_reports.map((rt) => (
                  <option key={rt} value={rt}>{REPORT_TYPE_LABELS[rt]}</option>
                ))}
              </optgroup>
              <optgroup label="Tax Reports (Uganda)">
                {REPORTS_BY_CATEGORY.tax_reports.map((rt) => (
                  <option key={rt} value={rt}>{REPORT_TYPE_LABELS[rt]}</option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Period Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Calendar className="w-4 h-4 inline mr-1" />
              Period
            </label>
            <select
              value={periodType}
              onChange={(e) => setPeriodType(e.target.value as ReportPeriod)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#872E5C]/20 focus:border-[#872E5C]"
            >
              {Object.entries(REPORT_PERIOD_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Fiscal Year */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fiscal Year
            </label>
            <select
              value={fiscalYear}
              onChange={(e) => setFiscalYear(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#872E5C]/20 focus:border-[#872E5C]"
            >
              {fiscalYearOptions.map((year) => (
                <option key={year} value={year}>
                  FY {year} (Jul {year - 1} - Jun {year})
                </option>
              ))}
            </select>
          </div>

          {/* Custom Date Range */}
          {periodType === REPORT_PERIODS.CUSTOM && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#872E5C]/20 focus:border-[#872E5C]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#872E5C]/20 focus:border-[#872E5C]"
                />
              </div>
            </>
          )}

          {/* Comparison */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <GitCompare className="w-4 h-4 inline mr-1" />
              Compare With
            </label>
            <select
              value={comparisonType}
              onChange={(e) => setComparisonType(e.target.value as ComparisonType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#872E5C]/20 focus:border-[#872E5C]"
            >
              {Object.entries(COMPARISON_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>

          {/* Budget Selection */}
          {comparisonType === COMPARISON_TYPES.BUDGET && budgets.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Select Budget
              </label>
              <select
                value={budgetId}
                onChange={(e) => setBudgetId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#872E5C]/20 focus:border-[#872E5C]"
              >
                <option value="">Select a budget...</option>
                {budgets.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Advanced Options Toggle */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="mt-4 flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
        >
          <Settings className="w-4 h-4" />
          Advanced Options
          {showAdvanced ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {/* Advanced Options */}
        {showAdvanced && (
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Department Filter */}
            {departments.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <select
                  value={departmentId}
                  onChange={(e) => setDepartmentId(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">All Departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Display Options */}
            <div className="col-span-2 flex items-center gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showZeroBalances}
                  onChange={(e) => setShowZeroBalances(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-[#872E5C] focus:ring-[#872E5C]"
                />
                <span className="text-sm text-gray-700">Show Zero Balances</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAccountCodes}
                  onChange={(e) => setShowAccountCodes(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300 text-[#872E5C] focus:ring-[#872E5C]"
                />
                <span className="text-sm text-gray-700">Show Account Codes</span>
              </label>
            </div>
          </div>
        )}

        {/* Period Summary & Generate Button */}
        <div className="mt-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center px-3 py-1 bg-gray-100 text-gray-700 text-sm rounded-full">
              {new Date(startDate).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}
              {' - '}
              {new Date(endDate).toLocaleDateString('en-UG', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
            {comparisonType !== COMPARISON_TYPES.NONE && (
              <span className="inline-flex items-center px-3 py-1 bg-[#872E5C]/10 text-[#872E5C] text-sm rounded-full">
                vs {COMPARISON_TYPE_LABELS[comparisonType]}
              </span>
            )}
          </div>

          <button
            onClick={handleGenerate}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 px-6 py-2.5 bg-[#872E5C] text-white font-medium rounded-lg hover:bg-[#6a2449] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Play className="w-4 h-4" />
            {isGenerating ? 'Generating...' : 'Generate Report'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportFilters;
