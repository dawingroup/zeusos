/**
 * CarryForwardManager - Carry-forward request management
 *
 * Lists carry-forward requests for the current/closing budget period.
 * Shows per-project unspent amounts, total carry-forward requested,
 * approval status badges, and action buttons.
 */

import { useMemo } from 'react';
import {
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
  Plus,
  FolderOpen,
  ChevronRight,
} from 'lucide-react';
import type { CarryForwardRequest } from '../../types/budget-period';
import {
  CARRY_FORWARD_STATUS_CONFIG,
  getCarryForwardStatusColor,
} from '../../types/budget-period';
import { formatMoney } from '../../../core/types/money';

// ─────────────────────────────────────────────────────────────────
// PROPS
// ─────────────────────────────────────────────────────────────────

interface CarryForwardManagerProps {
  requests: CarryForwardRequest[];
  activePeriodYear: number;
  loading?: boolean;
  onApprove?: (requestId: string) => void;
  onReject?: (requestId: string) => void;
  onRequestNew?: () => void;
}

// ─────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────

export function CarryForwardManager({
  requests,
  activePeriodYear,
  loading = false,
  onApprove,
  onReject,
  onRequestNew,
}: CarryForwardManagerProps) {
  // ── Summary stats ───────────────────────────────────────────────

  const stats = useMemo(() => {
    const totalRequested = requests.reduce((sum, r) => sum + r.amount.amount, 0);
    const pending = requests.filter(r => r.status === 'pending').length;
    const approved = requests.filter(r => r.status === 'approved').length;
    const rejected = requests.filter(r => r.status === 'rejected').length;
    const currency = requests.length > 0 ? requests[0].amount.currency : 'USD';
    return { totalRequested, pending, approved, rejected, currency };
  }, [requests]);

  // ── Loading skeleton ────────────────────────────────────────────

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-5 w-5 bg-gray-200 rounded animate-pulse" />
          <div className="h-5 w-48 bg-gray-200 rounded animate-pulse" />
        </div>
        <div className="space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="h-32 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // ── Render ──────────────────────────────────────────────────────

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
          <h3 className="text-base font-semibold text-gray-900">
            Carry-Forward Requests
          </h3>
          <span className="text-sm text-gray-500">CY {activePeriodYear}</span>
        </div>

        {onRequestNew && (
          <button
            onClick={onRequestNew}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            New Request
          </button>
        )}
      </div>

      {/* Summary strip */}
      {requests.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 px-6 py-3 bg-gray-50 border-b border-gray-100 text-sm">
          <div>
            <span className="text-gray-500">Total Requested</span>
            <p className="font-semibold text-gray-900">
              {new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: stats.currency,
                minimumFractionDigits: 0,
                maximumFractionDigits: 0,
              }).format(stats.totalRequested)}
            </p>
          </div>
          <div>
            <span className="text-gray-500">Pending</span>
            <p className="font-semibold text-amber-600">{stats.pending}</p>
          </div>
          <div>
            <span className="text-gray-500">Approved</span>
            <p className="font-semibold text-green-600">{stats.approved}</p>
          </div>
          <div>
            <span className="text-gray-500">Rejected</span>
            <p className="font-semibold text-red-600">{stats.rejected}</p>
          </div>
        </div>
      )}

      {/* Request cards */}
      <div className="p-6">
        {requests.length === 0 ? (
          /* Empty state */
          <div className="text-center py-10">
            <FolderOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h4 className="text-base font-medium text-gray-900 mb-1">
              No carry-forward requests
            </h4>
            <p className="text-sm text-gray-500 mb-4">
              No requests have been submitted for CY {activePeriodYear}.
            </p>
            {onRequestNew && (
              <button
                onClick={onRequestNew}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Create First Request
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {requests.map(request => (
              <CarryForwardCard
                key={request.id}
                request={request}
                onApprove={onApprove}
                onReject={onReject}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// CARRY-FORWARD CARD (internal)
// ─────────────────────────────────────────────────────────────────

interface CarryForwardCardProps {
  request: CarryForwardRequest;
  onApprove?: (requestId: string) => void;
  onReject?: (requestId: string) => void;
}

function CarryForwardCard({ request, onApprove, onReject }: CarryForwardCardProps) {
  const statusConfig = CARRY_FORWARD_STATUS_CONFIG[request.status];
  const statusColorClass = getCarryForwardStatusColor(request.status);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Card header */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-gray-50 border-b border-gray-100">
        <div className="flex items-center gap-3">
          {/* Year range */}
          <div className="flex items-center gap-1 text-sm font-medium text-gray-900">
            <span>CY {request.fromYear}</span>
            <ChevronRight className="w-4 h-4 text-gray-400" />
            <span>CY {request.toYear}</span>
          </div>

          {/* Status badge */}
          <span
            className={`inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full ${statusColorClass}`}
          >
            {statusConfig.label}
          </span>
        </div>

        {/* Amount */}
        <div className="text-sm font-semibold text-gray-900">
          {formatMoney(request.amount)}
        </div>
      </div>

      {/* Justification */}
      <div className="px-4 py-3">
        <p className="text-sm text-gray-600 leading-relaxed">
          {request.justification}
        </p>
      </div>

      {/* Project breakdown table */}
      {request.projectBreakdown.length > 0 && (
        <div className="px-4 pb-3">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 pr-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Project
                  </th>
                  <th className="text-right py-2 pr-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Unspent
                  </th>
                  <th className="text-right py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Carry Forward
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {request.projectBreakdown.map(item => (
                  <tr key={item.projectId}>
                    <td className="py-2 pr-4">
                      <div className="font-medium text-gray-900">{item.projectName}</div>
                      <div className="text-xs text-gray-400">{item.projectCode}</div>
                    </td>
                    <td className="text-right py-2 pr-4 text-gray-600">
                      {formatMoney(item.unspentAmount)}
                    </td>
                    <td className="text-right py-2 font-medium text-gray-900">
                      {formatMoney(item.requestedCarryForward)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Review notes (if reviewed) */}
      {request.reviewNotes && (
        <div className="px-4 pb-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <span className="text-xs font-medium text-gray-500">Review Notes:</span>
            <p className="text-sm text-gray-700 mt-1">{request.reviewNotes}</p>
          </div>
        </div>
      )}

      {/* Action buttons (only for pending requests) */}
      {request.status === 'pending' && (onApprove || onReject) && (
        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-gray-100 bg-gray-50">
          {onReject && (
            <button
              onClick={() => onReject(request.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
            >
              <XCircle className="w-4 h-4" />
              Reject
            </button>
          )}
          {onApprove && (
            <button
              onClick={() => onApprove(request.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              Approve
            </button>
          )}
        </div>
      )}
    </div>
  );
}
