/**
 * BulkStageAdvanceDialog Component
 * Multi-step dialog for advancing multiple design items to their next stage.
 * Validates gate criteria and shows eligible vs blocked items.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  ArrowUpCircle,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  MinusCircle,
  ArrowRight,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/core/components/ui/dialog';
import { Button } from '@/core/components/ui/button';
import type { DesignItem } from '../../types';
import { StageBadge } from '../design-item/StageBadge';
import { STAGE_LABELS } from '../../utils/formatting';
import {
  validateBulkStageAdvance,
  bulkAdvanceDesignStage,
  type BulkStageValidationResult,
  type BulkDesignOperationResult,
} from '../../services/bulkDesignOperationsService';

interface BulkStageAdvanceDialogProps {
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
  selectedIds: Set<string>;
  allItems: DesignItem[];  // kept for consistency with sibling dialog props
  projectId: string;
  userId: string;
}

type Step = 'validating' | 'review' | 'processing' | 'done' | 'error';

export function BulkStageAdvanceDialog({
  open,
  onClose,
  onComplete,
  selectedIds,
  allItems: _allItems,
  projectId,
  userId,
}: BulkStageAdvanceDialogProps) {
  const [step, setStep] = useState<Step>('validating');
  const [validation, setValidation] = useState<BulkStageValidationResult | null>(null);
  const [result, setResult] = useState<BulkDesignOperationResult | null>(null);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const selectedItemIds = useMemo(
    () => Array.from(selectedIds),
    [selectedIds]
  );

  // Run validation when dialog opens
  useEffect(() => {
    if (!open) return;
    setStep('validating');
    setValidation(null);
    setResult(null);
    setNotes('');
    setError(null);

    validateBulkStageAdvance(projectId, selectedItemIds)
      .then((v) => {
        setValidation(v);
        setStep('review');
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Validation failed');
        setStep('error');
      });
  }, [open, projectId, selectedItemIds]);

  const eligibleCount = validation?.eligible.length ?? 0;
  const blockedCount = validation?.blocked.length ?? 0;
  const finalCount = validation?.atFinalStage.length ?? 0;

  const handleAdvance = useCallback(async () => {
    if (!validation || eligibleCount === 0) return;

    setStep('processing');
    try {
      const eligibleIds = validation.eligible.map((e) => e.item.id);
      const res = await bulkAdvanceDesignStage(
        projectId,
        eligibleIds,
        userId,
        notes || undefined
      );
      setResult(res);
      setStep('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Advance failed');
      setStep('error');
    }
  }, [validation, eligibleCount, projectId, userId, notes]);

  const handleClose = useCallback(() => {
    if (step === 'done') {
      onComplete();
    } else {
      onClose();
    }
  }, [step, onClose, onComplete]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowUpCircle className="w-5 h-5" />
            Bulk Stage Advance
          </DialogTitle>
        </DialogHeader>

        {/* Validating */}
        {step === 'validating' && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-sm text-gray-500">
              Checking gate criteria for {selectedItemIds.length} items...
            </p>
          </div>
        )}

        {/* Review */}
        {step === 'review' && validation && (
          <div className="space-y-4">
            {/* Summary */}
            <div className="flex items-center gap-4 text-sm bg-gray-50 rounded-lg px-4 py-3">
              {eligibleCount > 0 && (
                <span className="flex items-center gap-1 text-green-700">
                  <CheckCircle2 className="w-4 h-4" />
                  {eligibleCount} can advance
                </span>
              )}
              {blockedCount > 0 && (
                <span className="flex items-center gap-1 text-red-700">
                  <XCircle className="w-4 h-4" />
                  {blockedCount} blocked
                </span>
              )}
              {finalCount > 0 && (
                <span className="flex items-center gap-1 text-gray-500">
                  <MinusCircle className="w-4 h-4" />
                  {finalCount} at final stage
                </span>
              )}
            </div>

            {/* Eligible items */}
            {eligibleCount > 0 && (
              <div>
                <h4 className="text-sm font-medium text-green-700 mb-2">
                  Ready to Advance
                </h4>
                <div className="space-y-2">
                  {validation.eligible.map(({ item, nextStage, warnings }) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2"
                    >
                      <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate">
                            {item.itemCode} — {item.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-1">
                          <StageBadge stage={item.currentStage} size="xs" />
                          <ArrowRight className="w-3 h-3 text-gray-400" />
                          <StageBadge stage={nextStage} size="xs" />
                        </div>
                        {warnings.length > 0 && (
                          <div className="mt-1">
                            {warnings.map((w, i) => (
                              <p
                                key={i}
                                className="text-xs text-amber-600 flex items-center gap-1"
                              >
                                <AlertTriangle className="w-3 h-3" />
                                {w}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Blocked items */}
            {blockedCount > 0 && (
              <div>
                <h4 className="text-sm font-medium text-red-700 mb-2">
                  Blocked
                </h4>
                <div className="space-y-2">
                  {validation.blocked.map(({ item, nextStage, failures }) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-lg px-3 py-2"
                    >
                      <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium truncate">
                            {item.itemCode} — {item.name}
                          </span>
                          {nextStage && (
                            <span className="text-xs text-gray-500">
                              → {STAGE_LABELS[nextStage]}
                            </span>
                          )}
                        </div>
                        <ul className="mt-1 space-y-0.5">
                          {failures.map((f, i) => (
                            <li key={i} className="text-xs text-red-600">
                              {f}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Final stage items */}
            {finalCount > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">
                  Already at Final Stage
                </h4>
                <div className="space-y-1">
                  {validation.atFinalStage.map(({ item }) => (
                    <div
                      key={item.id}
                      className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2"
                    >
                      <MinusCircle className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm text-gray-600 truncate">
                        {item.itemCode} — {item.name}
                      </span>
                      <StageBadge stage={item.currentStage} size="xs" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Notes */}
            {eligibleCount > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Transition Notes (optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows={2}
                  placeholder="Add notes for this stage transition..."
                />
              </div>
            )}
          </div>
        )}

        {/* Processing */}
        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-sm text-gray-500">
              Advancing {eligibleCount} items...
            </p>
          </div>
        )}

        {/* Done */}
        {step === 'done' && result && (
          <div className="space-y-4">
            <div className="flex flex-col items-center py-6 gap-2">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
              <p className="text-lg font-medium">Stage Advance Complete</p>
            </div>

            <div className="flex items-center gap-4 justify-center text-sm">
              <span className="text-green-700">
                {result.successCount} advanced
              </span>
              {result.failureCount > 0 && (
                <span className="text-red-700">
                  {result.failureCount} failed
                </span>
              )}
            </div>

            {result.results.some((r) => !r.success) && (
              <div className="bg-red-50 rounded-lg p-3">
                <h4 className="text-sm font-medium text-red-700 mb-1">
                  Failed Items
                </h4>
                {result.results
                  .filter((r) => !r.success)
                  .map((r) => (
                    <p key={r.itemId} className="text-xs text-red-600">
                      {r.itemName}: {r.error}
                    </p>
                  ))}
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {step === 'error' && (
          <div className="flex flex-col items-center py-8 gap-3">
            <XCircle className="w-10 h-10 text-red-500" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        <DialogFooter>
          {step === 'review' && (
            <>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleAdvance}
                disabled={eligibleCount === 0}
              >
                <ArrowUpCircle className="w-4 h-4 mr-1.5" />
                Advance {eligibleCount} Item{eligibleCount !== 1 ? 's' : ''}
              </Button>
            </>
          )}
          {step === 'done' && (
            <Button onClick={handleClose}>Done</Button>
          )}
          {step === 'error' && (
            <Button variant="outline" onClick={handleClose}>
              Close
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
