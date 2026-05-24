// ============================================================================
// INCOME STATEMENT COMPONENT
// ZeusOS v2.0 - Financial Management Module
// Displays Income Statement (Profit & Loss)
// ============================================================================

import React from 'react';
import { IncomeStatement as IncomeStatementType, ReportSection, ReportTotal } from '../../types/reporting.types';
import { formatCurrency, CurrencyCode } from '../../constants/currency.constants';
import {
  TrendingUp,
  TrendingDown,
  FileText,
  Download,
} from 'lucide-react';

// ----------------------------------------------------------------------------
// TYPES
// ----------------------------------------------------------------------------

interface IncomeStatementProps {
  report: IncomeStatementType;
  showComparison?: boolean;
  showVariance?: boolean;
  onExport?: () => void;
}

// ----------------------------------------------------------------------------
// COMPONENT
// ----------------------------------------------------------------------------

export const IncomeStatement: React.FC<IncomeStatementProps> = ({
  report,
  showComparison = false,
  showVariance = false,
  onExport,
}) => {
  // Render a section
  const renderSection = (section: ReportSection, indent = 0) => (
    <React.Fragment key={section.key}>
      {/* Section Header */}
      <tr className="bg-[var(--bg-sunken)]">
        <td colSpan={showComparison ? 4 : 2} className="px-4 py-2">
          <span className="font-medium text-foreground" style={{ paddingLeft: indent }}>
            {section.label}
          </span>
        </td>
      </tr>

      {/* Section Lines */}
      {section.lines.map((line) => (
        <tr key={line.id} className="hover:bg-[var(--bg-sunken)]/50">
          <td className="px-4 py-1.5" style={{ paddingLeft: 24 + indent }}>
            {line.accountCode && (
              <span className="text-[var(--fg-tertiary)] text-xs mr-2 font-mono">
                {line.accountCode}
              </span>
            )}
            <span className="text-muted-foreground">{line.accountName}</span>
          </td>
          <td className="px-4 py-1.5 text-right font-mono text-foreground">
            {formatCurrency(line.currentAmount, report.currency as CurrencyCode)}
          </td>
          {showComparison && report.comparison && (
            <>
              <td className="px-4 py-1.5 text-right font-mono text-muted-foreground">
                {formatCurrency(line.comparisonAmount || 0, report.currency as CurrencyCode)}
              </td>
              {showVariance && (
                <td className="px-4 py-1.5 text-right">
                  <span
                    className={`font-mono ${
                      (line.variancePercent || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {(line.variancePercent || 0).toFixed(1)}%
                  </span>
                </td>
              )}
            </>
          )}
        </tr>
      ))}

      {/* Section Total */}
      <tr className="border-t border-[var(--border-subtle)]">
        <td className="px-4 py-2" style={{ paddingLeft: 8 + indent }}>
          <span className="font-medium text-foreground">Total {section.label}</span>
        </td>
        <td className="px-4 py-2 text-right font-mono font-medium text-foreground">
          {formatCurrency(section.total, report.currency as CurrencyCode)}
        </td>
        {showComparison && report.comparison && (
          <>
            <td className="px-4 py-2 text-right font-mono font-medium text-muted-foreground">
              {formatCurrency(section.comparisonTotal || 0, report.currency as CurrencyCode)}
            </td>
            {showVariance && (
              <td className="px-4 py-2 text-right">
                <span
                  className={`font-mono font-medium ${
                    (section.variancePercent || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}
                >
                  {(section.variancePercent || 0).toFixed(1)}%
                </span>
              </td>
            )}
          </>
        )}
      </tr>
    </React.Fragment>
  );

  // Render a calculated total
  const renderTotal = (total: ReportTotal, highlight = false, bgColor?: string) => (
    <tr
      key={total.key}
      className={highlight ? 'font-bold' : 'font-semibold'}
      style={{ backgroundColor: bgColor }}
    >
      <td className="px-4 py-3">
        <span className={highlight ? 'text-lg text-foreground' : 'text-foreground'}>
          {total.label}
        </span>
      </td>
      <td className="px-4 py-3 text-right font-mono text-foreground">
        <span className={highlight ? 'text-lg' : ''}>
          {formatCurrency(total.amount, report.currency as CurrencyCode)}
        </span>
      </td>
      {showComparison && report.comparison && (
        <>
          <td className="px-4 py-3 text-right font-mono text-muted-foreground">
            {formatCurrency(total.comparisonAmount || 0, report.currency as CurrencyCode)}
          </td>
          {showVariance && (
            <td className="px-4 py-3 text-right">
              <span
                className={`font-mono ${
                  (total.variancePercent || 0) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {(total.variancePercent || 0).toFixed(1)}%
              </span>
            </td>
          )}
        </>
      )}
    </tr>
  );

  return (
    <div className="bg-card rounded-xl border border-[var(--border-subtle)] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 border-b border-[var(--border-subtle)]">
        <div className="flex justify-between items-start">
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              <FileText className="w-5 h-5 text-[#872E5C]" />
              Income Statement
            </h2>
            <p className="text-muted-foreground mt-1">{report.periodLabel}</p>
          </div>
          {onExport && (
            <button
              onClick={onExport}
              className="inline-flex items-center gap-2 px-4 py-2 border border-[var(--border-default)] text-muted-foreground rounded-lg hover:bg-[var(--bg-sunken)]"
            >
              <Download className="w-4 h-4" />
              Export
            </button>
          )}
        </div>

        {/* Key Metrics */}
        <div className="flex flex-wrap gap-3 mt-4">
          <div
            className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
              report.netProfit.amount >= 0
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
            }`}
          >
            {report.netProfit.amount >= 0 ? (
              <TrendingUp className="w-4 h-4" />
            ) : (
              <TrendingDown className="w-4 h-4" />
            )}
            Net {report.netProfit.amount >= 0 ? 'Profit' : 'Loss'}:{' '}
            {formatCurrency(Math.abs(report.netProfit.amount), report.currency as CurrencyCode)}
          </div>
          <div className="inline-flex items-center px-3 py-1.5 bg-[var(--bg-sunken)] text-muted-foreground rounded-full text-sm">
            Gross Margin: {report.grossProfitMargin.toFixed(1)}%
          </div>
          <div className="inline-flex items-center px-3 py-1.5 bg-[var(--bg-sunken)] text-muted-foreground rounded-full text-sm">
            Net Margin: {report.netProfitMargin.toFixed(1)}%
          </div>
        </div>
      </div>

      {/* Report Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[var(--bg-sunken)]">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Account</th>
              <th className="px-4 py-3 text-right font-medium text-muted-foreground">Current Period</th>
              {showComparison && report.comparison && (
                <>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground">
                    {report.comparison.periodLabel}
                  </th>
                  {showVariance && (
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground">Variance</th>
                  )}
                </>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]">
            {/* Revenue */}
            {renderSection(report.revenue)}

            {/* Cost of Sales */}
            {renderSection(report.costOfSales)}

            {/* Gross Profit */}
            {renderTotal(report.grossProfit, false, '#f0fdf4')}

            {/* Spacer */}
            <tr>
              <td colSpan={showComparison ? 4 : 2} className="py-2" />
            </tr>

            {/* Operating Expenses */}
            {renderSection(report.operatingExpenses)}

            {/* Operating Profit */}
            {renderTotal(report.operatingProfit, false, '#f0fdf4')}

            {/* Spacer */}
            <tr>
              <td colSpan={showComparison ? 4 : 2} className="py-2" />
            </tr>

            {/* Other Income */}
            {report.otherIncome.lines.length > 0 && renderSection(report.otherIncome)}

            {/* Other Expenses */}
            {report.otherExpenses.lines.length > 0 && renderSection(report.otherExpenses)}

            {/* Profit Before Tax */}
            {renderTotal(report.profitBeforeTax)}

            {/* Tax Expense */}
            {report.taxExpense.lines.length > 0 && renderSection(report.taxExpense)}

            {/* Net Profit */}
            {renderTotal(
              report.netProfit,
              true,
              report.netProfit.amount >= 0 ? '#dcfce7' : '#fee2e2'
            )}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-6 py-3 bg-[var(--bg-sunken)] border-t border-[var(--border-subtle)] flex justify-between items-center">
        <span className="text-xs text-muted-foreground">
          Generated: {report.generatedAt.toDate().toLocaleString()}
        </span>
        <span
          className={`text-xs px-2 py-1 rounded ${
            report.status === 'final'
              ? 'bg-green-100 text-green-800'
              : 'bg-[var(--bg-sunken)] text-muted-foreground'
          }`}
        >
          {report.status.toUpperCase()}
        </span>
      </div>
    </div>
  );
};

export default IncomeStatement;
