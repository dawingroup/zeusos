/**
 * ALLOCATION MEMO PREVIEW
 *
 * Styled card previewing the allocation memo before finalization.
 * Shows the allocation table, totals, and rationale.
 */

import { FileText, Download, ExternalLink } from 'lucide-react';
import type { AllocationGroup } from '../../types/allocation';
import { formatBudgetAmount } from '../../types/project-budget';

interface AllocationMemoPreviewProps {
  group: AllocationGroup;
  compact?: boolean;
}

export function AllocationMemoPreview({ group, compact }: AllocationMemoPreviewProps) {
  const { groupNumber, date, vendorName, description, totalAmount, currency, allocations, rationale, memoUrl } = group;

  const formattedDate = date?.toDate?.()
    ? date.toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '—';

  if (compact) {
    return (
      <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
        <FileText className="w-5 h-5 text-indigo-600 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-indigo-900 truncate">
            {groupNumber} — {vendorName}
          </p>
          <p className="text-xs text-indigo-600">
            {allocations.length} projects &middot; {formatBudgetAmount(totalAmount, currency)}
          </p>
        </div>
        {memoUrl && (
          <a
            href={memoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 text-indigo-600 hover:text-indigo-800 rounded min-h-[36px] min-w-[36px] flex items-center justify-center"
          >
            <Download className="w-4 h-4" />
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Header */}
      <div className="bg-gray-50 px-4 py-3 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-indigo-600" />
            <div>
              <p className="text-sm font-semibold text-gray-900">{groupNumber}</p>
              <p className="text-xs text-gray-500">{formattedDate}</p>
            </div>
          </div>
          {memoUrl && (
            <a
              href={memoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              View Memo
            </a>
          )}
        </div>
      </div>

      {/* Details */}
      <div className="px-4 py-3 space-y-3">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-gray-500">Vendor</p>
            <p className="font-medium text-gray-900">{vendorName}</p>
          </div>
          <div>
            <p className="text-xs text-gray-500">Total Amount</p>
            <p className="font-semibold text-gray-900">{formatBudgetAmount(totalAmount, currency)}</p>
          </div>
        </div>

        {description && (
          <p className="text-sm text-gray-600">{description}</p>
        )}

        {/* Allocation Table */}
        <div className="border border-gray-100 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-3 py-2 text-xs font-medium text-gray-500">Project</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 text-right">%</th>
                <th className="px-3 py-2 text-xs font-medium text-gray-500 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {allocations.map((entry, i) => (
                <tr key={i} className="border-t border-gray-100">
                  <td className="px-3 py-2">
                    <p className="font-medium text-gray-900 truncate max-w-[180px]">
                      {entry.projectName}
                    </p>
                    <p className="text-xs text-gray-400">{entry.budgetCategory}</p>
                  </td>
                  <td className="px-3 py-2 text-right text-gray-600">
                    {entry.percentage.toFixed(1)}%
                  </td>
                  <td className="px-3 py-2 text-right font-medium text-gray-900">
                    {formatBudgetAmount(entry.allocatedAmount, currency)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-200 bg-gray-50">
                <td className="px-3 py-2 font-semibold text-gray-900">Total</td>
                <td className="px-3 py-2 text-right font-medium text-gray-600">100%</td>
                <td className="px-3 py-2 text-right font-semibold text-gray-900">
                  {formatBudgetAmount(totalAmount, currency)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Rationale */}
        {rationale && (
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">Rationale</p>
            <p className="text-sm text-gray-700">{rationale}</p>
          </div>
        )}
      </div>
    </div>
  );
}
