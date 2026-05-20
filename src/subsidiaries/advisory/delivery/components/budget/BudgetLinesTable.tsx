/**
 * Budget Lines Table - Sortable table of BOQ items with budget control
 */

import { useState, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { BaseCard } from '@/shared/components/cards';
import { getBudgetControlStatusColor } from '../../types/control-boq';
import type { BudgetLineRow } from '../../hooks/useProjectBudgetData';

interface BudgetLinesTableProps {
  lines: BudgetLineRow[];
  currency: string;
}

type SortKey = 'description' | 'billName' | 'allocatedAmount' | 'committedAmount' | 'spentAmount' | 'remainingBudget' | 'variancePercentage';

function formatCompact(amount: number): string {
  if (amount >= 1_000_000_000) return `${(amount / 1_000_000_000).toFixed(1)}B`;
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `${(amount / 1_000).toFixed(1)}K`;
  return amount.toLocaleString();
}

const STATUS_LABELS: Record<string, string> = {
  on_budget: 'On Budget',
  alert: 'Alert',
  exceeded: 'Exceeded',
};

const PAGE_SIZE = 20;

export function BudgetLinesTable({ lines, currency }: BudgetLinesTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('allocatedAmount');
  const [sortAsc, setSortAsc] = useState(false);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    return [...lines].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortAsc ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [lines, sortKey, sortAsc]);

  const paged = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(lines.length / PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const SortIcon = ({ columnKey }: { columnKey: SortKey }) => {
    if (sortKey !== columnKey) return null;
    return sortAsc
      ? <ChevronUp className="w-3 h-3 inline ml-0.5" />
      : <ChevronDown className="w-3 h-3 inline ml-0.5" />;
  };

  if (lines.length === 0) {
    return (
      <BaseCard padding="lg">
        <h3 className="text-base font-medium text-gray-900 mb-3">Budget Lines (BOQ)</h3>
        <p className="text-sm text-gray-500 text-center py-6">
          No BOQ items with budget control data. Import a Control BOQ to see budget lines.
        </p>
      </BaseCard>
    );
  }

  return (
    <BaseCard padding="lg">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-medium text-gray-900">Budget Lines (BOQ)</h3>
        <span className="text-xs text-gray-500">{lines.length} items</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th
                className="py-2 px-3 text-left text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700"
                onClick={() => toggleSort('description')}
              >
                Description <SortIcon columnKey="description" />
              </th>
              <th
                className="py-2 px-3 text-left text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700"
                onClick={() => toggleSort('billName')}
              >
                Bill <SortIcon columnKey="billName" />
              </th>
              <th
                className="py-2 px-3 text-right text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700"
                onClick={() => toggleSort('allocatedAmount')}
              >
                Allocated ({currency}) <SortIcon columnKey="allocatedAmount" />
              </th>
              <th
                className="py-2 px-3 text-right text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700"
                onClick={() => toggleSort('committedAmount')}
              >
                Committed ({currency}) <SortIcon columnKey="committedAmount" />
              </th>
              <th
                className="py-2 px-3 text-right text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700"
                onClick={() => toggleSort('spentAmount')}
              >
                Spent ({currency}) <SortIcon columnKey="spentAmount" />
              </th>
              <th
                className="py-2 px-3 text-right text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700"
                onClick={() => toggleSort('remainingBudget')}
              >
                Remaining ({currency}) <SortIcon columnKey="remainingBudget" />
              </th>
              <th
                className="py-2 px-3 text-center text-xs font-medium text-gray-500 cursor-pointer hover:text-gray-700"
                onClick={() => toggleSort('variancePercentage')}
              >
                Variance % <SortIcon columnKey="variancePercentage" />
              </th>
              <th className="py-2 px-3 text-center text-xs font-medium text-gray-500">Status</th>
            </tr>
          </thead>
          <tbody>
            {paged.map(line => {
              const statusColor = getBudgetControlStatusColor(line.varianceStatus);
              const isExceeded = line.varianceStatus === 'exceeded';

              return (
                <tr
                  key={line.id}
                  className={`border-b border-gray-50 hover:bg-gray-50 ${isExceeded ? 'border-l-2 border-l-red-500' : ''}`}
                >
                  <td className="py-2.5 px-3 text-sm text-gray-700 max-w-[250px] truncate">
                    {line.description}
                  </td>
                  <td className="py-2.5 px-3 text-xs text-gray-500">{line.billName}</td>
                  <td className="py-2.5 px-3 text-xs text-gray-600 text-right font-mono">
                    {formatCompact(line.allocatedAmount)}
                  </td>
                  <td className="py-2.5 px-3 text-xs text-gray-600 text-right font-mono">
                    {formatCompact(line.committedAmount)}
                  </td>
                  <td className="py-2.5 px-3 text-xs text-gray-600 text-right font-mono">
                    {formatCompact(line.spentAmount)}
                  </td>
                  <td className={`py-2.5 px-3 text-xs text-right font-mono ${line.remainingBudget < 0 ? 'text-red-600 font-medium' : 'text-gray-600'}`}>
                    {line.remainingBudget < 0 ? '-' : ''}{formatCompact(Math.abs(line.remainingBudget))}
                  </td>
                  <td className={`py-2.5 px-3 text-xs text-center font-mono ${line.variancePercentage > 0 ? 'text-red-600' : 'text-gray-600'}`}>
                    {line.variancePercentage > 0 ? '+' : ''}{line.variancePercentage.toFixed(1)}%
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${statusColor}`}>
                      {STATUS_LABELS[line.varianceStatus] || line.varianceStatus}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-3 pt-3 border-t">
          <span className="text-xs text-gray-500">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, lines.length)} of {lines.length}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-2 py-1 text-xs border rounded disabled:opacity-50 hover:bg-gray-50"
            >
              Prev
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-2 py-1 text-xs border rounded disabled:opacity-50 hover:bg-gray-50"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </BaseCard>
  );
}
