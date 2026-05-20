/**
 * QUICK CAPTURES INBOX
 *
 * Shows all unlinked quick captures with countdown timers.
 * Cards on mobile, table on desktop.
 */

import { useState, useMemo } from 'react';
import {
  Clock,
  AlertTriangle,
  Link as LinkIcon,
  XCircle,
  Camera,
  Loader2,
  Plus,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Timestamp } from 'firebase/firestore';
import { useAuth } from '@/shared/hooks';
import { useUnlinkedCaptures, useVoidCapture, useCreateRetroactiveRequisition } from '../../hooks/useQuickCapture';
import { formatBudgetAmount } from '../../types/project-budget';
import type { QuickCaptureIndex } from '../../types/quick-capture';
import { RequisitionLinker } from './RequisitionLinker';

// ─── Time Helpers ──────────────────────────────────────────────

function getTimeRemaining(deadline: Timestamp): {
  label: string;
  color: string;
  isOverdue: boolean;
} {
  const now = Date.now();
  const deadlineMs = deadline.toMillis();
  const diffMs = deadlineMs - now;

  if (diffMs <= 0) {
    const hoursOverdue = Math.abs(Math.round(diffMs / (1000 * 60 * 60)));
    return {
      label: `${hoursOverdue}h overdue`,
      color: 'bg-red-100 text-red-700 animate-pulse',
      isOverdue: true,
    };
  }

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 12) {
    return { label: `${hours}h left`, color: 'bg-red-100 text-red-700', isOverdue: false };
  }
  if (hours < 24) {
    return { label: `${hours}h left`, color: 'bg-yellow-100 text-yellow-700', isOverdue: false };
  }
  return { label: `${hours}h left`, color: 'bg-green-100 text-green-700', isOverdue: false };
}

function formatDate(ts: Timestamp): string {
  return ts.toDate().toLocaleDateString('en-UG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Component ─────────────────────────────────────────────────

export function QuickCapturesInbox() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const orgId = (user as any)?.organizationId || 'default';
  const userId = user?.uid || '';

  const { captures, loading, error: fetchError, refresh } = useUnlinkedCaptures(orgId);
  const { voidCapture, loading: voiding } = useVoidCapture();
  const { createRetroactive, loading: creatingRetro } = useCreateRetroactiveRequisition();

  const [linkingCapture, setLinkingCapture] = useState<QuickCaptureIndex | null>(null);
  const [voidingId, setVoidingId] = useState<string | null>(null);
  const [voidReason, setVoidReason] = useState('');

  // Summary
  const summary = useMemo(() => {
    let overdueCount = 0;
    let totalValue = 0;
    for (const c of captures) {
      const deadline = c.linkDeadline;
      if (deadline && deadline.toMillis() < Date.now()) overdueCount++;
      totalValue += c.amount;
    }
    return {
      pendingCount: captures.length,
      overdueCount,
      totalValue,
      currency: captures[0]?.currency || 'UGX',
    };
  }, [captures]);

  const handleVoid = async (capture: QuickCaptureIndex) => {
    if (!voidReason.trim()) return;
    try {
      await voidCapture(capture.accountabilityId, voidReason, userId, orgId);
      setVoidingId(null);
      setVoidReason('');
      refresh();
    } catch (err) {
      console.error('Failed to void capture:', err);
    }
  };

  const handleRetroactive = async (capture: QuickCaptureIndex) => {
    try {
      await createRetroactive(capture.accountabilityId, capture.projectId, userId, orgId);
      refresh();
    } catch (err) {
      console.error('Failed to create retroactive requisition:', err);
    }
  };

  // ─── Render ────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      {/* Summary Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-blue-600" />
          <span className="text-sm font-medium text-gray-700">
            {summary.pendingCount} capture{summary.pendingCount !== 1 ? 's' : ''} pending
          </span>
        </div>
        {summary.overdueCount > 0 && (
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-sm font-medium text-red-600">
              {summary.overdueCount} overdue
            </span>
          </div>
        )}
        <div className="ml-auto text-sm font-semibold text-gray-900">
          {formatBudgetAmount(summary.totalValue, summary.currency as 'UGX' | 'USD')}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Loading captures...
        </div>
      )}

      {/* Error State */}
      {!loading && fetchError && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 bg-red-50 rounded-lg border border-red-200 px-4">
          <AlertTriangle className="w-8 h-8 text-red-500" />
          <p className="font-medium text-red-700">Failed to load captures</p>
          <p className="text-sm text-red-600 text-center max-w-sm">{fetchError.message}</p>
          <button
            onClick={refresh}
            className="mt-1 px-4 py-2 text-sm font-medium text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50 min-h-[48px]"
          >
            Retry
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !fetchError && captures.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-gray-400">
          <Camera className="w-12 h-12 mb-3" />
          <p className="font-medium text-gray-600">No pending captures</p>
          <p className="text-sm mt-1">All captures are linked to requisitions.</p>
          <button
            onClick={() => navigate('/advisory/delivery/quick-captures/new')}
            className="mt-4 flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 min-h-[48px]"
          >
            <Plus className="w-4 h-4" />
            New Capture
          </button>
        </div>
      )}

      {/* Capture Cards */}
      <div className="space-y-3">
        {captures.map((capture) => {
          const timeInfo = getTimeRemaining(capture.linkDeadline);
          const isVoiding = voidingId === capture.id;

          return (
            <div
              key={capture.id}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden"
            >
              <div className="p-4">
                {/* Top row: date, vendor, amount */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 truncate">
                      {capture.vendorName}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {formatDate(capture.capturedAt)}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0 ml-3">
                    <p className="text-lg font-bold text-gray-900">
                      {formatBudgetAmount(capture.amount, capture.currency as 'UGX' | 'USD')}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                  {capture.description}
                </p>

                {/* Tags row */}
                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                    {capture.projectName || capture.projectId}
                  </span>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-600">
                    {capture.budgetCategory}
                  </span>
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${timeInfo.color}`}>
                    <Clock className="w-3 h-3" />
                    {timeInfo.label}
                  </span>
                </div>

                {/* Thumbnail */}
                {capture.thumbnailUrl && (
                  <div className="mb-3">
                    <img
                      src={capture.thumbnailUrl}
                      alt="Receipt"
                      className="w-16 h-16 object-cover rounded-md border border-gray-200"
                    />
                  </div>
                )}

                {/* Void prompt */}
                {isVoiding ? (
                  <div className="space-y-2 bg-red-50 rounded-lg p-3">
                    <p className="text-sm font-medium text-red-700">Reason for voiding:</p>
                    <input
                      type="text"
                      value={voidReason}
                      onChange={(e) => setVoidReason(e.target.value)}
                      placeholder="Enter reason..."
                      className="w-full border border-red-300 rounded-md px-3 py-2 text-sm min-h-[40px]"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleVoid(capture)}
                        disabled={!voidReason.trim() || voiding}
                        className="flex-1 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:bg-gray-300 min-h-[40px]"
                      >
                        Confirm Void
                      </button>
                      <button
                        onClick={() => { setVoidingId(null); setVoidReason(''); }}
                        className="flex-1 py-2 border border-gray-300 text-sm rounded-md hover:bg-gray-50 min-h-[40px]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Action buttons */
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setLinkingCapture(capture)}
                      className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 min-h-[40px]"
                    >
                      <LinkIcon className="w-3.5 h-3.5" />
                      Link to Requisition
                    </button>
                    <button
                      onClick={() => handleRetroactive(capture)}
                      disabled={creatingRetro}
                      className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-sm font-medium rounded-lg hover:bg-gray-50 min-h-[40px]"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Create Retroactive
                    </button>
                    <button
                      onClick={() => setVoidingId(capture.id)}
                      className="flex items-center gap-1.5 px-3 py-2 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 min-h-[40px]"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      Void
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Requisition Linker Dialog */}
      {linkingCapture && (
        <RequisitionLinker
          capture={linkingCapture}
          orgId={orgId}
          userId={userId}
          onClose={() => setLinkingCapture(null)}
          onLinked={() => {
            setLinkingCapture(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}
