/**
 * ScopeItemsTable — Line items with version tracking, CO badges, strike-through for removed items.
 */

import { Lock, Plus, Minus, XCircle } from 'lucide-react';
import type { SalesOrderItem } from '../types';
import { ITEM_CATEGORY_LABELS } from '../constants';

interface ScopeItemsTableProps {
  items: SalesOrderItem[];
  scopeVersion: number;
  scopeFrozen: boolean;
  currency: string;
  onCancelItem?: (item: SalesOrderItem) => void;
  cancellationDisabled?: boolean;
  selectedItemIds?: string[];
  onToggleItemSelection?: (itemId: string, checked: boolean) => void;
  onToggleAllActive?: (checked: boolean, activeItemIds: string[]) => void;
  onCancelSelected?: () => void;
  bulkCancelDisabled?: boolean;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export default function ScopeItemsTable({
  items,
  scopeVersion,
  scopeFrozen,
  currency,
  onCancelItem,
  cancellationDisabled = false,
  selectedItemIds = [],
  onToggleItemSelection,
  onToggleAllActive,
  onCancelSelected,
  bulkCancelDisabled = false,
}: ScopeItemsTableProps) {
  const activeItems = items.filter((i) => i.isActive);
  const removedItems = items.filter((i) => !i.isActive);
  const totalActive = activeItems.reduce((sum, i) => sum + i.totalPrice, 0);
  const activeIds = activeItems.map((i) => i.id);
  const selectedActiveCount = activeIds.filter((id) => selectedItemIds.includes(id)).length;
  const allActiveSelected = activeItems.length > 0 && selectedActiveCount === activeItems.length;
  const hasSelectableRows = !!onToggleItemSelection;

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-gray-900">
            Scope Items (v{scopeVersion})
          </h3>
          {scopeFrozen && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border border-blue-300 bg-blue-50 text-blue-700">
              <Lock className="h-3 w-3" />
              Scope Frozen
            </span>
          )}
        </div>
        {onCancelSelected && hasSelectableRows && (
          <button
            type="button"
            onClick={onCancelSelected}
            disabled={bulkCancelDisabled || selectedActiveCount === 0}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <XCircle className="h-3.5 w-3.5" />
            Cancel selected ({selectedActiveCount})
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {hasSelectableRows && (
                <th className="text-left px-3 py-2 font-medium text-gray-600 w-10">
                  <input
                    type="checkbox"
                    checked={allActiveSelected}
                    onChange={(e) => onToggleAllActive?.(e.target.checked, activeIds)}
                    disabled={cancellationDisabled || activeItems.length === 0}
                    aria-label="Select all active line items"
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                  />
                </th>
              )}
              <th className="text-left px-3 py-2 font-medium text-gray-600">#</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Description</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Category</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600">Qty</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Unit</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600">Unit Price</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600">Total</th>
              <th className="text-left px-3 py-2 font-medium text-gray-600">Source</th>
              <th className="text-right px-3 py-2 font-medium text-gray-600">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {activeItems.map((item) => (
              <tr key={item.id} className="hover:bg-gray-50">
                {hasSelectableRows && (
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedItemIds.includes(item.id)}
                      onChange={(e) => onToggleItemSelection?.(item.id, e.target.checked)}
                      disabled={cancellationDisabled}
                      aria-label={`Select line ${item.lineNumber}`}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                  </td>
                )}
                <td className="px-3 py-2 text-gray-500">{item.lineNumber}</td>
                <td className="px-3 py-2">
                  <p className="font-medium text-gray-900">{item.description}</p>
                  {item.specification && (
                    <p className="text-xs text-gray-500">{item.specification}</p>
                  )}
                </td>
                <td className="px-3 py-2">
                  <span className="px-2 py-0.5 rounded text-xs font-medium border border-gray-200 bg-gray-50 text-gray-600">
                    {ITEM_CATEGORY_LABELS[item.category] ?? item.category}
                  </span>
                </td>
                <td className="px-3 py-2 text-right">{item.quantity}</td>
                <td className="px-3 py-2 text-gray-500">{item.unit}</td>
                <td className="px-3 py-2 text-right">{formatCurrency(item.unitPrice, currency)}</td>
                <td className="px-3 py-2 text-right font-medium">{formatCurrency(item.totalPrice, currency)}</td>
                <td className="px-3 py-2">
                  {item.addedByChangeOrder ? (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border border-blue-200 bg-blue-50 text-blue-700">
                      <Plus className="h-3 w-3" />
                      {item.addedByChangeOrder}
                    </span>
                  ) : (
                    <span className="text-xs text-gray-400">v{item.fromQuoteVersion}</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right">
                  {onCancelItem && (
                    <button
                      type="button"
                      onClick={() => onCancelItem(item)}
                      disabled={cancellationDisabled}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <XCircle className="h-3.5 w-3.5" />
                      Cancel line
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {/* Removed items shown struck-through */}
            {removedItems.map((item) => (
              <tr key={item.id} className="opacity-50">
                {hasSelectableRows && <td className="px-3 py-2" />}
                <td className="px-3 py-2 line-through">{item.lineNumber}</td>
                <td className="px-3 py-2 line-through">{item.description}</td>
                <td className="px-3 py-2">-</td>
                <td className="px-3 py-2 text-right line-through">{item.quantity}</td>
                <td className="px-3 py-2">-</td>
                <td className="px-3 py-2 text-right line-through">{formatCurrency(item.unitPrice, currency)}</td>
                <td className="px-3 py-2 text-right line-through">{formatCurrency(item.totalPrice, currency)}</td>
                <td className="px-3 py-2">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border border-red-200 bg-red-50 text-red-700">
                    <Minus className="h-3 w-3" />
                    {item.removedByChangeOrder ?? 'Removed'}
                  </span>
                </td>
                <td className="px-3 py-2" />
              </tr>
            ))}

            {/* Total row */}
            <tr className="bg-gray-50 border-t border-gray-200">
              <td
                colSpan={hasSelectableRows ? 7 : 6}
                className="px-3 py-2 text-right text-sm font-semibold text-gray-700"
              >
                Total (Active Items)
              </td>
              <td className="px-3 py-2 text-right text-sm font-bold text-gray-900">
                {formatCurrency(totalActive, currency)}
              </td>
              <td />
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
