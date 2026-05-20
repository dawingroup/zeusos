// ============================================================================
// BALANCE SHEET COMPONENT
// DawinOS v2.0 - Financial Management Module
// Displays Balance Sheet (Statement of Financial Position)
// ============================================================================

import React from 'react';
import { BalanceSheet as BalanceSheetType, ReportSection, ReportTotal } from '../../types/reporting.types';
import { formatCurrency, CurrencyCode } from '../../constants/currency.constants';
import {
  Scale,
  AlertCircle,
  CheckCircle,
  FileText,
  Download,
} from 'lucide-react';

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

interface BalanceSheetProps {
  report: BalanceSheetType;
  onExport?: () => void;
}

// ----------------------------------------------------------------------------
// COMPONENT
// ----------------------------------------------------------------------------

export const BalanceSheet: React.FC<BalanceSheetProps> = ({
  report,
  onExport,
}) => {
  const currency = report.currency as CurrencyCode;

  const renderSection = (section: ReportSection) => (
    <React.Fragment key={section.key}>
      <tr className="bg-gray-50">
        <td colSpan={2} className="px-4 py-2">
          <span className="font-medium text-gray-900">{section.label}</span>
        </td>
      </tr>

      {section.lines.map((line) => (
        <tr key={line.id} className="hover:bg-gray-50/50">
          <td className="px-4 py-1.5 pl-8">
            {line.accountCode && (
              <span className="text-gray-400 text-xs mr-2 font-mono">
                {line.accountCode}
              </span>
            )}
            <span className="text-gray-700">{line.accountName}</span>
          </td>
          <td className="px-4 py-1.5 text-right font-mono text-gray-900">
            {formatCurrency(line.currentAmount, currency)}
          </td>
        </tr>
      ))}

      <tr className="border-t border-gray-200">
        <td className="px-4 py-2">
          <span className="font-medium text-gray-900">Total {section.label}</span>
        </td>
        <td className="px-4 py-2 text-right font-mono font-medium text-gray-900">
          {formatCurrency(section.total, currency)}
        </td>
      </tr>
    </React.Fragment>
  );

  const renderTotal = (total: ReportTotal, highlight = false, bgColor?: string) => (
    <tr
      key={total.key}
      className={highlight ? 'font-bold' : 'font-semibold'}
      style={{ backgroundColor: bgColor }}
    >
      <td className="px-4 py-3">
        <span className={highlight ? 'text-lg text-gray-900' : 'text-gray-900'}>
          {total.label}
        </span>
      </td>
      <td className="px-4 py-3 text-right font-mono text-gray-900">
        <span className={highlight ? 'text-lg' : ''}>
          {formatCurrency(total.amount, currency)}
        </span>
      </td>
    </tr>
  );

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#872E5C]" />
              Balance Sheet
            </h2>
            <p className="text-gray-600 mt-1">
              As of {report.asOfDate.toLocaleDateString('en-UG', { 
                day: 'numeric', month: 'long', year: 'numeric' 
              })}
            </p>
          </div>
          {onExport && (
            <button
              onClick={onExport}
              className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          )}
        </div>

        {/* Balance Check */}
        <div className="flex flex-wrap gap-3 mt-4">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              report.isBalanced
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {report.isBalanced ? (
              <CheckCircle className="w-4 h-4" />
            ) : (
              <AlertCircle className="w-4 h-4" />
            )}
            {report.isBalanced ? 'Balanced' : `Out of Balance: ${formatCurrency(report.difference, currency)}`}
          </div>
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm">
            <Scale className="w-4 h-4" />
            Current Ratio: {report.currentRatio.toFixed(2)}
          </div>
          <div className="inline-flex items-center px-3 py-1.5 bg-gray-100 text-gray-700 rounded-full text-sm">
            D/E Ratio: {report.debtToEquityRatio.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Report Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Account</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">Amount ({currency})</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {/* ASSETS */}
            <tr className="bg-[#872E5C]/5">
              <td colSpan={2} className="px-4 py-3">
                <span className="font-bold text-gray-900">ASSETS</span>
              </td>
            </tr>
            {renderSection(report.currentAssets)}
            {renderSection(report.nonCurrentAssets)}
            {renderTotal(report.totalAssets, true, '#dcfce7')}

            {/* Spacer */}
            <tr><td colSpan={2} className="py-3" /></tr>

            {/* LIABILITIES */}
            <tr className="bg-[#872E5C]/5">
              <td colSpan={2} className="px-4 py-3">
                <span className="font-bold text-gray-900">LIABILITIES</span>
              </td>
            </tr>
            {renderSection(report.currentLiabilities)}
            {renderSection(report.nonCurrentLiabilities)}
            {renderTotal(report.totalLiabilities)}

            {/* Spacer */}
            <tr><td colSpan={2} className="py-3" /></tr>

            {/* EQUITY */}
            <tr className="bg-[#872E5C]/5">
              <td colSpan={2} className="px-4 py-3">
                <span className="font-bold text-gray-900">EQUITY</span>
              </td>
            </tr>
            {renderSection(report.shareCapital)}
            {renderSection(report.retainedEarnings)}
            {report.reserves.lines.length > 0 && renderSection(report.reserves)}
            {renderTotal(report.totalEquity)}

            {/* Spacer */}
            <tr><td colSpan={2} className="py-3" /></tr>

            {/* Total Liabilities & Equity */}
            {renderTotal(report.totalLiabilitiesEquity, true, '#dcfce7')}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
        <span className="text-xs text-gray-500">
          Generated: {report.generatedAt.toDate().toLocaleString()}
        </span>
        <span
          className={`text-xs px-2 py-1 rounded ${
            report.status === 'final'
              ? 'bg-green-100 text-green-800'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {report.status?.toUpperCase() || 'DRAFT'}
        </span>
      </div>
    </div>
  );
};

export default BalanceSheet;
