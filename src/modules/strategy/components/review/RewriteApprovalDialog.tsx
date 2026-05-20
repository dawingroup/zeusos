// ============================================================================
// REWRITE APPROVAL DIALOG - Strategy Plan Update Tool
// Dialog for approving, editing, or rejecting AI-generated rewrites
// ============================================================================

import { useState } from 'react';
import { CheckCircle, XCircle, Pencil, Loader2 } from 'lucide-react';
import { SectionDiffViewer } from './SectionDiffViewer';
import type { DocumentSection, SectionAssessment } from '../../types/documentSection.types';

// ----------------------------------------------------------------------------
// Props
// ----------------------------------------------------------------------------

interface RewriteApprovalDialogProps {
  open: boolean;
  onClose: () => void;
  section: DocumentSection;
  assessment?: SectionAssessment | null;
  onApprove: (sectionId: string) => Promise<void>;
  onReject: (sectionId: string, reason?: string) => Promise<void>;
  onEditAndApprove?: (sectionId: string, editedContent: string) => Promise<void>;
}

// ----------------------------------------------------------------------------
// Component
// ----------------------------------------------------------------------------

export function RewriteApprovalDialog({
  open,
  onClose,
  section,
  assessment,
  onApprove,
  onReject,
  onEditAndApprove,
}: RewriteApprovalDialogProps) {
  const [mode, setMode] = useState<'review' | 'edit' | 'reject'>('review');
  const [editedContent, setEditedContent] = useState(section.pendingRewrite || '');
  const [rejectReason, setRejectReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!open) return null;

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      await onApprove(section.id);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    setIsSubmitting(true);
    try {
      await onReject(section.id, rejectReason || undefined);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditApprove = async () => {
    if (!onEditAndApprove) return;
    setIsSubmitting(true);
    try {
      await onEditAndApprove(section.id, editedContent);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Overlay */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Review Rewrite</h2>
            <p className="text-sm text-gray-500">{section.headingText}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">
            &times;
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Assessment Summary */}
          {assessment && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 text-sm">
              <span className="font-medium text-gray-700">
                Score: {assessment.score}/5
              </span>
              <span className="text-gray-400">|</span>
              <span className="text-gray-600">
                {assessment.gaps.length} gap(s) found
              </span>
              <span className="text-gray-400">|</span>
              <span className="text-gray-600 capitalize">
                {assessment.recommendation.replace(/_/g, ' ')}
              </span>
            </div>
          )}

          {/* Mode: Review (diff) */}
          {mode === 'review' && section.pendingRewrite && (
            <SectionDiffViewer
              original={section.content}
              rewrite={section.pendingRewrite}
              heading="Changes"
            />
          )}

          {/* Mode: Edit */}
          {mode === 'edit' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Edit the rewrite before approving:
              </label>
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                className="w-full h-64 px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-y"
              />
            </div>
          )}

          {/* Mode: Reject */}
          {mode === 'reject' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason for rejection (optional):
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Explain why this rewrite was rejected..."
                className="w-full h-32 px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 resize-y"
              />
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-6 py-4 border-t bg-gray-50">
          {/* Mode Toggles */}
          <div className="flex gap-2">
            {mode !== 'review' && (
              <button
                onClick={() => setMode('review')}
                className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800"
              >
                Back to Review
              </button>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2">
            {mode === 'review' && (
              <>
                <button
                  onClick={() => setMode('reject')}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </button>
                {onEditAndApprove && (
                  <button
                    onClick={() => {
                      setEditedContent(section.pendingRewrite || '');
                      setMode('edit');
                    }}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md border border-blue-300 text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit
                  </button>
                )}
                <button
                  onClick={handleApprove}
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle className="h-4 w-4" />
                  )}
                  Approve
                </button>
              </>
            )}

            {mode === 'edit' && (
              <button
                onClick={handleEditApprove}
                disabled={isSubmitting || !editedContent.trim()}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle className="h-4 w-4" />
                )}
                Save & Approve
              </button>
            )}

            {mode === 'reject' && (
              <button
                onClick={handleReject}
                disabled={isSubmitting}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-md bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                Confirm Rejection
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
