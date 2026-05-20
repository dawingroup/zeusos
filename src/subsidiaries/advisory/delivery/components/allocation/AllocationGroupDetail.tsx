/**
 * ALLOCATION GROUP DETAIL
 *
 * Full-page view of an allocation group showing all projects,
 * amounts, memo preview, and actions (generate memo, void).
 */

import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  FileText,
  Download,
  Loader2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/shared/hooks';
import { useAllocationGroup, useGenerateAllocationMemo, useVoidAllocationGroup } from '../../hooks/useAllocation';
import { AllocationMemoPreview } from './AllocationMemoPreview';
import { AllocationBadge } from './AllocationBadge';
import { formatBudgetAmount } from '../../types/project-budget';
import { useState } from 'react';

export function AllocationGroupDetail() {
  const { groupId } = useParams<{ groupId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const orgId = (user as any)?.organizationId || 'default';

  const { group, loading, error, refresh } = useAllocationGroup(groupId, orgId);
  const { generateMemo, loading: generatingMemo } = useGenerateAllocationMemo();
  const { voidGroup, loading: voiding } = useVoidAllocationGroup();

  const [voidReason, setVoidReason] = useState('');
  const [showVoidConfirm, setShowVoidConfirm] = useState(false);

  const handleGenerateMemo = async () => {
    if (!groupId) return;
    try {
      await generateMemo(groupId, orgId);
      refresh();
    } catch {
      // Error handled by hook
    }
  };

  const handleVoid = async () => {
    if (!groupId || !voidReason.trim() || !user) return;
    try {
      await voidGroup(groupId, voidReason.trim(), user.uid, orgId);
      navigate(-1);
    } catch {
      // Error handled by hook
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (error || !group) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <AlertTriangle className="w-8 h-8 text-amber-500" />
        <p className="text-gray-600">{error?.message || 'Allocation group not found'}</p>
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-blue-600 hover:underline"
        >
          Go back
        </button>
      </div>
    );
  }

  const isVoided = group.status === 'Voided' as any;

  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-lg hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">{group.groupNumber}</h1>
            <AllocationBadge groupNumber={group.groupNumber} />
          </div>
          <p className="text-sm text-gray-500">{group.vendorName}</p>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold text-gray-900">
            {formatBudgetAmount(group.totalAmount, group.currency)}
          </p>
          <p className="text-xs text-gray-500">{group.allocations.length} projects</p>
        </div>
      </div>

      {isVoided && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
          <XCircle className="w-5 h-5 text-red-500" />
          <p className="text-sm text-red-700 font-medium">This allocation has been voided</p>
        </div>
      )}

      {/* Memo Preview */}
      <AllocationMemoPreview group={group} />

      {/* Actions */}
      {!isVoided && (
        <div className="flex flex-wrap gap-3">
          {!group.memoUrl ? (
            <button
              onClick={handleGenerateMemo}
              disabled={generatingMemo}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 min-h-[44px]"
            >
              {generatingMemo ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
              Generate Memo
            </button>
          ) : (
            <a
              href={group.memoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 min-h-[44px]"
            >
              <Download className="w-4 h-4" />
              Download Memo
            </a>
          )}

          <button
            onClick={() => setShowVoidConfirm(true)}
            disabled={voiding}
            className="flex items-center gap-2 px-4 py-2.5 text-red-600 border border-red-200 rounded-lg hover:bg-red-50 min-h-[44px]"
          >
            <XCircle className="w-4 h-4" />
            Void
          </button>
        </div>
      )}

      {/* Void confirmation */}
      {showVoidConfirm && (
        <div className="border border-red-200 rounded-lg p-4 bg-red-50 space-y-3">
          <p className="text-sm font-medium text-red-900">
            Are you sure you want to void this allocation? This will mark all related
            accountability entries as voided.
          </p>
          <textarea
            value={voidReason}
            onChange={(e) => setVoidReason(e.target.value)}
            placeholder="Reason for voiding (required)..."
            rows={2}
            className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm"
          />
          <div className="flex gap-2">
            <button
              onClick={handleVoid}
              disabled={voiding || !voidReason.trim()}
              className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 disabled:opacity-50"
            >
              {voiding ? 'Voiding...' : 'Confirm Void'}
            </button>
            <button
              onClick={() => { setShowVoidConfirm(false); setVoidReason(''); }}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg text-sm hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
