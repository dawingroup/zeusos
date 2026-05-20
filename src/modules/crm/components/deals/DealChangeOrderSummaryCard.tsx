/**
 * DealChangeOrderSummaryCard — rolls up Change-Order state for the
 * linked Sales Order onto the Deal detail page. Reads the denorm
 * `deal.changeOrderSummary` written by the CO service; renders nothing
 * if the deal has no linked SO or no COs yet (with a "Request change
 * order" CTA that deep-links to the SO when an SO exists).
 */

import { NavLink } from 'react-router-dom';
import {
  FileEdit,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ExternalLink,
  Plus,
} from 'lucide-react';
import type { DealChangeOrderSummary } from '../../types';

interface Props {
  summary?: DealChangeOrderSummary;
  linkedSalesOrderId?: string | null;
  currency?: string;
  /** Hidden entirely when true — used before the deal has an SO. */
  compact?: boolean;
}

function formatCurrency(value: number, currency: string = 'UGX'): string {
  if (currency === 'UGX') return `UGX ${value.toLocaleString()}`;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatDate(ts?: { toDate?: () => Date }): string | null {
  if (!ts?.toDate) return null;
  return ts
    .toDate()
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function DealChangeOrderSummaryCard({
  summary,
  linkedSalesOrderId,
  currency = 'UGX',
  compact = false,
}: Props) {
  // Used to be hidden entirely pre-SO. Now we always render so users
  // know the Change Orders module exists and what blocks access to it.
  if (compact && !linkedSalesOrderId && !summary) return null;

  const hasActivity = summary && summary.count > 0;

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-gray-700 inline-flex items-center gap-2">
          <FileEdit className="h-4 w-4 text-indigo-600" />
          Change orders
        </h3>
        {linkedSalesOrderId && (
          <NavLink
            to={`/sales-orders/${linkedSalesOrderId}?tab=change-orders`}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-indigo-600 hover:bg-indigo-50"
          >
            <Plus className="h-3 w-3" />
            Request change order
          </NavLink>
        )}
      </div>

      {!hasActivity ? (
        <p className="text-xs text-gray-500">
          No change orders yet.{' '}
          {!linkedSalesOrderId &&
            'Create a sales order first, then you can raise change orders against it.'}
        </p>
      ) : (
        <>
          {/* Top-line counts */}
          <div className="grid grid-cols-3 gap-2 mb-3">
            <Pill
              icon={<Clock className="h-3 w-3" />}
              label="Open"
              count={summary!.openCount}
              value={summary!.pendingValue}
              currency={currency}
              tone={summary!.openCount > 0 ? 'amber' : 'gray'}
            />
            <Pill
              icon={<CheckCircle2 className="h-3 w-3" />}
              label="Approved"
              count={summary!.approvedCount}
              value={summary!.approvedValue}
              currency={currency}
              tone={summary!.approvedCount > 0 ? 'emerald' : 'gray'}
            />
            <Pill
              icon={<AlertTriangle className="h-3 w-3" />}
              label="Rejected"
              count={summary!.rejectedCount}
              tone={summary!.rejectedCount > 0 ? 'rose' : 'gray'}
            />
          </div>

          {/* Post-freeze warning */}
          {summary!.hasPostFreezeCO && (
            <div className="flex items-start gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] text-rose-800 mb-3">
              <AlertTriangle className="h-3 w-3 flex-shrink-0 mt-0.5" />
              <span>
                Includes a change order raised <strong>after scope freeze</strong> —
                requires senior sign-off before applying.
              </span>
            </div>
          )}

          {/* Latest CO reference */}
          {summary!.lastChangeOrderNumber && (
            <div className="flex items-center justify-between text-[11px] text-gray-500 border-t pt-2">
              <span>
                Latest: <strong className="text-gray-700">{summary!.lastChangeOrderNumber}</strong>
                {summary!.lastChangeOrderStatus && (
                  <span className="ml-1 text-gray-500">
                    ({summary!.lastChangeOrderStatus.replace(/_/g, ' ')})
                  </span>
                )}
              </span>
              {formatDate(summary!.lastChangeOrderAt) && (
                <span className="text-gray-400">
                  {formatDate(summary!.lastChangeOrderAt)}
                </span>
              )}
            </div>
          )}

          {linkedSalesOrderId && (
            <NavLink
              to={`/sales-orders/${linkedSalesOrderId}`}
              className="mt-3 inline-flex items-center gap-1 text-xs text-indigo-600 hover:underline"
            >
              View all change orders on SO
              <ExternalLink className="h-3 w-3" />
            </NavLink>
          )}
        </>
      )}
    </div>
  );
}

function Pill({
  icon,
  label,
  count,
  value,
  currency,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  value?: number;
  currency?: string;
  tone: 'amber' | 'emerald' | 'rose' | 'gray';
}) {
  const toneClasses: Record<typeof tone, string> = {
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    emerald: 'bg-emerald-50 border-emerald-200 text-emerald-800',
    rose: 'bg-rose-50 border-rose-200 text-rose-800',
    gray: 'bg-gray-50 border-gray-200 text-gray-600',
  };
  return (
    <div className={`rounded-md border px-2 py-1.5 ${toneClasses[tone]}`}>
      <div className="flex items-center gap-1 text-[10px] uppercase font-semibold opacity-80">
        {icon}
        {label}
      </div>
      <p className="text-sm font-bold">{count}</p>
      {value !== undefined && value !== 0 && currency && (
        <p className="text-[10px] opacity-80">
          {value >= 0 ? '+' : ''}
          {formatCurrency(value, currency)}
        </p>
      )}
    </div>
  );
}
