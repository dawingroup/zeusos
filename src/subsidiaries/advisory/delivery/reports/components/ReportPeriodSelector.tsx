/**
 * Report Period Selector Component
 * UI for selecting report period (month, quarter, year, or custom)
 */

import { useState, useEffect } from 'react';
import { format } from 'date-fns';
import type { ReportPeriod, ReportPeriodType } from '../types';
import { createReportPeriod } from '../hooks';

interface ReportPeriodSelectorProps {
  periodType: ReportPeriodType;
  value: ReportPeriod | null;
  onChange: (period: ReportPeriod) => void;
  disabled?: boolean;
  className?: string;
}

const PERIOD_TYPE_LABELS: Record<ReportPeriodType, string> = {
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  annual: 'Annual',
  custom: 'Custom',
};

export function ReportPeriodSelector({
  periodType,
  value,
  onChange,
  disabled = false,
  className = '',
}: ReportPeriodSelectorProps) {
  const [selectedYear, setSelectedYear] = useState(
    value?.year || new Date().getFullYear()
  );
  const [selectedMonth, setSelectedMonth] = useState(
    value?.month || new Date().getMonth() + 1
  );
  const [selectedQuarter, setSelectedQuarter] = useState(
    value?.quarter || Math.ceil((new Date().getMonth() + 1) / 3)
  );
  const [customStartDate, setCustomStartDate] = useState(
    value?.startDate ? format(value.startDate, 'yyyy-MM-dd') : ''
  );
  const [customEndDate, setCustomEndDate] = useState(
    value?.endDate ? format(value.endDate, 'yyyy-MM-dd') : ''
  );

  // Generate year options (last 5 years + current year)
  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 6 }, (_, i) => currentYear - i);

  // Generate month options
  const monthOptions = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  // Generate quarter options
  const quarterOptions = [
    { value: 1, label: 'Q1 (Jan-Mar)' },
    { value: 2, label: 'Q2 (Apr-Jun)' },
    { value: 3, label: 'Q3 (Jul-Sep)' },
    { value: 4, label: 'Q4 (Oct-Dec)' },
  ];

  // Update period when selections change
  useEffect(() => {
    let period: ReportPeriod;

    switch (periodType) {
      case 'monthly': {
        const date = new Date(selectedYear, selectedMonth - 1, 15);
        period = createReportPeriod('monthly', date);
        break;
      }
      case 'quarterly': {
        const monthInQuarter = (selectedQuarter - 1) * 3 + 1;
        const date = new Date(selectedYear, monthInQuarter, 15);
        period = createReportPeriod('quarterly', date);
        break;
      }
      case 'annual': {
        const date = new Date(selectedYear, 6, 1);
        period = createReportPeriod('annual', date);
        break;
      }
      case 'custom': {
        if (customStartDate && customEndDate) {
          const startDate = new Date(customStartDate);
          const endDate = new Date(customEndDate);
          period = {
            type: 'custom',
            startDate,
            endDate,
            periodLabel: `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`,
            year: startDate.getFullYear(),
          };
        } else {
          return; // Don't update if custom dates not set
        }
        break;
      }
    }

    onChange(period);
  }, [periodType, selectedYear, selectedMonth, selectedQuarter, customStartDate, customEndDate, onChange]);

  return (
    <div className={`report-period-selector ${className}`}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Report Period ({PERIOD_TYPE_LABELS[periodType]})
      </label>

      <div className="flex gap-2">
        {/* Year selector (always shown except for custom) */}
        {periodType !== 'custom' && (
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            disabled={disabled}
            className="px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:border-primary focus:ring-primary focus:ring-1 text-sm disabled:bg-gray-100"
          >
            {yearOptions.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        )}

        {/* Month selector (for monthly) */}
        {periodType === 'monthly' && (
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            disabled={disabled}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:border-primary focus:ring-primary focus:ring-1 text-sm disabled:bg-gray-100"
          >
            {monthOptions.map((month) => (
              <option key={month.value} value={month.value}>
                {month.label}
              </option>
            ))}
          </select>
        )}

        {/* Quarter selector (for quarterly) */}
        {periodType === 'quarterly' && (
          <select
            value={selectedQuarter}
            onChange={(e) => setSelectedQuarter(Number(e.target.value))}
            disabled={disabled}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:border-primary focus:ring-primary focus:ring-1 text-sm disabled:bg-gray-100"
          >
            {quarterOptions.map((quarter) => (
              <option key={quarter.value} value={quarter.value}>
                {quarter.label}
              </option>
            ))}
          </select>
        )}

        {/* Custom date range (for custom) */}
        {periodType === 'custom' && (
          <>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">
                Start Date
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                disabled={disabled}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:border-primary focus:ring-primary focus:ring-1 text-sm disabled:bg-gray-100"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs text-gray-500 mb-1">
                End Date
              </label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                disabled={disabled}
                min={customStartDate}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:border-primary focus:ring-primary focus:ring-1 text-sm disabled:bg-gray-100"
              />
            </div>
          </>
        )}
      </div>

      {/* Display selected period */}
      {value && (
        <p className="mt-1 text-xs text-gray-500">
          Period: {value.periodLabel}
        </p>
      )}
    </div>
  );
}

export default ReportPeriodSelector;
