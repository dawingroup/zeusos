// ============================================================================
// TRIAL BALANCE COMPONENT
// DawinOS v2.0 - Financial Management Module
// Displays Trial Balance report
// ============================================================================

import React from 'react';
import { TrialBalance as TrialBalanceType } from '../../types/reporting.types';
import { formatCurrency, CurrencyCode } from '../../constants/currency.constants';
import {
  CheckCircle,
  AlertCircle,
  FileText,
  Download,
} from 'lucide-react';

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

interface TrialBalanceProps {
  report: TrialBalanceType;
  onExport?: () => void;
}

// ----------------------------------------------------------------------------
// COMPONENT
// ----------------------------------------------------------------------------

export const TrialBalance: React.FC<TrialBalanceProps> = ({
  report,
  onExport,
}) => {
  const currency = report.currency as CurrencyCode;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#872E5C]" />
              Trial Balance
            </h2>
            <p className="text-gray-600 mt-1">
              As of {report.asOfDate.toLocaleDateString('en-UG', { 
                day: 'numeric', month: 'long', year: 'numeric' 
              })} | Fiscal Year {report.fiscalYear}
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

        {/* Balance Status */}
        <div className="mt-4">
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
            {report.isBalanced 
              ? 'Debits = Credits (Balanced)' 
              : `Out of Balance: ${formatCurrency(report.difference, currency)}`
            }
          </div>
        </div>
      </div>

      {/* Report Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Code</th>
              <th className="px-4 py-3 text-left font-medium text-gray-700">Account Name</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">Debit</th>
              <th className="px-4 py-3 text-right font-medium text-gray-700">Credit</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {report.lines.map((line) => (
              <tr key={line.accountId} className="hover:bg-gray-50/50">
                <td className="px-4 py-2 font-mono text-gray-600">
                  {line.accountCode}
                </td>
                <td className="px-4 py-2 text-gray-900">
                  {line.accountName}
                </td>
                <td className="px-4 py-2 text-right font-mono text-gray-900">
                  {line.closingDebit > 0 ? formatCurrency(line.closingDebit, currency) : '-'}
                </td>
                <td className="px-4 py-2 text-right font-mono text-gray-900">
                  {line.closingCredit > 0 ? formatCurrency(line.closingCredit, currency) : '-'}
                </td>
              </tr>
            ))}

            {/* Totals Row */}
            <tr className="bg-gray-100 font-bold">
              <td colSpan={2} className="px-4 py-3 text-gray-900">
                TOTALS
              </td>
              <td className="px-4 py-3 text-right font-mono text-gray-900">
                {formatCurrency(report.totalDebits, currency)}
              </td>
              <td className="px-4 py-3 text-right font-mono text-gray-900">
                {formatCurrency(report.totalCredits, currency)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
        <span className="text-xs text-gray-500">
          Generated: {report.generatedAt.toDate().toLocaleString()}
        </span>
        <span className="text-xs text-gray-500">
          {report.lines.length} accounts
        </span>
      </div>
    </div>
  );
};

export default TrialBalance;
