/**
 * REQUISITION LINKER DIALOG
 *
 * Modal dialog for linking a quick capture to an existing requisition.
 */

import { useState } from 'react';
import { X, Loader2, CheckCircle2, Link as LinkIcon } from 'lucide-react';
import { useLinkCapture, useMatchingRequisitions } from '../../hooks/useQuickCapture';
import { formatBudgetAmount } from '../../types/project-budget';
import type { QuickCaptureIndex } from '../../types/quick-capture';

interface RequisitionLinkerProps {
  capture: QuickCaptureIndex;
  orgId: string;
  userId: string;
  onClose: () => void;
  onLinked: () => void;
}

export function RequisitionLinker({
  capture,
  orgId,
  userId,
  onClose,
  onLinked,
}: RequisitionLinkerProps) {
  const [selectedReqId, setSelectedReqId] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { requisitions, loading: loadingReqs } = useMatchingRequisitions(
    capture.projectId,
    capture.amount
  );
  const { linkCapture, loading: linking } = useLinkCapture();

  const handleLink = async () => {
    if (!selectedReqId) return;
    try {
      await linkCapture(
        capture.accountabilityId,
        capture.projectId,
        selectedReqId,
        userId,
        orgId
      );
      setSuccess(true);
      setTimeout(onLinked, 1200);
    } catch (err) {
      console.error('Failed to link capture:', err);
    }
  };

  const currency = (capture.currency || 'UGX') as 'UGX' | 'USD';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50">
      <div className="bg-white w-full max-w-lg rounded-t-2xl sm:rounded-2xl max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Link to Requisition</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Capture Summary */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium text-gray-900">{capture.vendorName}</p>
              <p className="text-xs text-gray-500 mt-0.5">{capture.description}</p>
            </div>
            <p className="text-lg font-bold text-gray-900 flex-shrink-0 ml-3">
              {formatBudgetAmount(capture.amount, currency)}
            </p>
          </div>
        </div>

        {/* Success State */}
        {success ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <CheckCircle2 className="w-12 h-12 text-green-500" />
            <p className="font-medium text-gray-800">Linked successfully</p>
          </div>
        ) : (
          <>
            {/* Requisition List */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
              {loadingReqs ? (
                <div className="flex items-center justify-center py-8 text-gray-400">
                  <Loader2 className="w-5 h-5 animate-spin mr-2" />
                  <span className="text-sm">Finding matching requisitions...</span>
                </div>
              ) : requisitions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-sm text-gray-500">
                    No matching requisitions found for this project.
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    Try creating a retroactive requisition instead.
                  </p>
                </div>
              ) : (
                requisitions.map((req) => {
                  const remaining =
                    req.childRequisitionsSummary?.remainingFundsBalance ??
                    req.unaccountedAmount ??
                    req.grossAmount;
                  const isSelected = selectedReqId === req.id;

                  return (
                    <button
                      key={req.id}
                      type="button"
                      onClick={() => setSelectedReqId(isSelected ? null : req.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors min-h-[56px] ${
                        isSelected
                          ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm text-gray-900">
                            {req.requisitionNumber}
                          </p>
                          <p className="text-xs text-gray-500 mt-0.5 truncate">{req.purpose}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            Status: {req.status} &middot; Type: {req.requisitionType}
                          </p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-3">
                          <p className="text-sm font-semibold text-gray-900">
                            {formatBudgetAmount(remaining, currency)}
                          </p>
                          <p className="text-xs text-gray-400">remaining</p>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Footer Actions */}
            <div className="px-4 py-3 border-t border-gray-200">
              <button
                type="button"
                onClick={handleLink}
                disabled={!selectedReqId || linking}
                className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:text-gray-500 transition-colors min-h-[48px] flex items-center justify-center gap-2"
              >
                {linking ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Linking...
                  </>
                ) : (
                  <>
                    <LinkIcon className="w-4 h-4" />
                    Confirm Link
                  </>
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
