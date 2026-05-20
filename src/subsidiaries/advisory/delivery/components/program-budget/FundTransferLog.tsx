/**
 * FundTransferLog - Table of fund transfers between locations
 *
 * Shows transfer date, from/to with directional arrows, amount,
 * project line items (expandable), FX rate, status badge, and reference.
 * Includes a "New Transfer" action button and an empty state.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Plus, Send, Inbox, ChevronDown, ChevronRight } from 'lucide-react';
import type { FundTransfer } from '../../types/fund-location';
import { getTransferStatusColor } from '../../types/fund-location';
import { formatMoney } from '../../../core/types/money';

// ─────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────

interface FundTransferLogProps {
  transfers: FundTransfer[];
  loading?: boolean;
  onNewTransfer?: () => void;
  programId?: string;
}

// ─────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────

function formatDate(date: any): string {
  // Handle Firestore Timestamp objects, JS Dates, and date strings
  const jsDate = date?.toDate ? date.toDate()
    : date instanceof Date ? date
    : new Date(date?.seconds ? date.seconds * 1000 : date);
  if (isNaN(jsDate.getTime())) return '—';
  return new Intl.DateTimeFormat('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(jsDate);
}

function formatRate(rate: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(rate);
}

function fmtNumber(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function capitalizeStatus(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

// ─────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────

export function FundTransferLog({
  transfers,
  loading = false,
  onNewTransfer,
  programId,
}: FundTransferLogProps) {
  const navigate = useNavigate();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // ── Loading skeleton ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-5 w-5 bg-gray-200 rounded animate-pulse" />
          <div className="h-5 w-40 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // Column count for colSpan on expanded rows
  const colCount = 8;

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Send className="w-5 h-5 text-blue-600" />
          <h3 className="text-base font-semibold text-gray-900">
            Fund Transfers
          </h3>
          {transfers.length > 0 && (
            <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
              {transfers.length}
            </span>
          )}
        </div>

        {onNewTransfer && (
          <button
            onClick={onNewTransfer}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Transfer
          </button>
        )}
      </div>

      {/* Table or empty state */}
      {transfers.length === 0 ? (
        <div className="text-center py-12 px-6">
          <Inbox className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h4 className="text-base font-medium text-gray-900 mb-1">
            No transfers recorded
          </h4>
          <p className="text-sm text-gray-500 mb-4">
            Fund transfers between locations will appear here.
          </p>
          {onNewTransfer && (
            <button
              onClick={onNewTransfer}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create First Transfer
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  From / To
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Items
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  FX Rate
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Converted
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reference
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {transfers.map(transfer => {
                const statusColor = getTransferStatusColor(transfer.status);
                const hasLineItems = transfer.lineItems && transfer.lineItems.length > 0;
                const isExpanded = expandedIds.has(transfer.id);

                return (
                  <>
                    <tr
                      key={transfer.id}
                      className={`hover:bg-gray-50 transition-colors ${programId ? 'cursor-pointer' : ''}`}
                      onClick={() => {
                        if (programId) {
                          navigate(`/advisory/delivery/programs/${programId}/transfers/${transfer.id}`);
                        }
                      }}
                    >
                      {/* Date */}
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {formatDate(transfer.transferDate)}
                      </td>

                      {/* From → To */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900 whitespace-nowrap">
                            {transfer.fromLocationName}
                          </span>
                          <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="font-medium text-gray-900 whitespace-nowrap">
                            {transfer.toLocationName}
                          </span>
                        </div>
                      </td>

                      {/* Amount */}
                      <td className="px-4 py-3 text-right font-medium text-gray-900 whitespace-nowrap">
                        {formatMoney(transfer.amount)}
                      </td>

                      {/* Items */}
                      <td className="px-4 py-3 text-center">
                        {hasLineItems ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); toggleExpand(transfer.id); }}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3 h-3" />
                            ) : (
                              <ChevronRight className="w-3 h-3" />
                            )}
                            {transfer.lineItems!.length} project{transfer.lineItems!.length !== 1 ? 's' : ''}
                          </button>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>

                      {/* FX Rate */}
                      <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">
                        {transfer.exchangeRate ? (
                          <span title={`1 ${transfer.exchangeRate.fromCurrency} = ${formatRate(transfer.exchangeRate.rate)} ${transfer.exchangeRate.toCurrency}`}>
                            {formatRate(transfer.exchangeRate.rate)}
                          </span>
                        ) : (
                          <span className="text-gray-300">--</span>
                        )}
                      </td>

                      {/* Converted amount */}
                      <td className="px-4 py-3 text-right text-gray-600 whitespace-nowrap">
                        {transfer.convertedAmount ? (
                          formatMoney(transfer.convertedAmount)
                        ) : (
                          <span className="text-gray-300">--</span>
                        )}
                      </td>

                      {/* Status badge */}
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${statusColor}`}
                        >
                          {capitalizeStatus(transfer.status)}
                        </span>
                      </td>

                      {/* Reference */}
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        <span className="font-mono text-xs">{transfer.reference}</span>
                      </td>
                    </tr>

                    {/* Expanded line items detail row */}
                    {hasLineItems && isExpanded && (
                      <tr key={`${transfer.id}-items`} className="bg-blue-50/50">
                        <td colSpan={colCount} className="px-4 py-3">
                          <div className="ml-4">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-gray-500">
                                  <th className="text-left py-1 pr-4 font-medium">Project</th>
                                  <th className="text-right py-1 px-3 font-medium">Grant Amount</th>
                                  <th className="text-right py-1 px-3 font-medium">Bank Fee (0.4%)</th>
                                  <th className="text-right py-1 pl-3 font-medium">Net to Project</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-blue-100">
                                {transfer.lineItems!.map(li => (
                                  <tr key={li.id}>
                                    <td className="py-1.5 pr-4 text-gray-800">
                                      <span className="text-gray-500">{li.projectCode}</span>
                                      {' — '}
                                      {li.projectName}
                                    </td>
                                    <td className="py-1.5 px-3 text-right tabular-nums text-gray-700">
                                      {fmtNumber(li.grantAmount)}
                                    </td>
                                    <td className="py-1.5 px-3 text-right tabular-nums text-gray-500">
                                      {fmtNumber(li.bankFee)}
                                    </td>
                                    <td className="py-1.5 pl-3 text-right tabular-nums font-medium text-gray-900">
                                      {fmtNumber(li.lineTotal)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="border-t border-blue-200 font-medium text-gray-800">
                                  <td className="py-1.5 pr-4">Total</td>
                                  <td className="py-1.5 px-3 text-right tabular-nums">
                                    {fmtNumber(transfer.lineItems!.reduce((s, li) => s + li.grantAmount, 0))}
                                  </td>
                                  <td className="py-1.5 px-3 text-right tabular-nums">
                                    {fmtNumber(transfer.lineItems!.reduce((s, li) => s + li.bankFee, 0))}
                                  </td>
                                  <td className="py-1.5 pl-3 text-right tabular-nums font-semibold">
                                    {fmtNumber(transfer.lineItems!.reduce((s, li) => s + li.lineTotal, 0))}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
