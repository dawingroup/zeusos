/**
 * MergeItemsDialog Component
 * Multi-step dialog for merging parts from multiple design items into a target item.
 * Source items are kept as empty shells after merge.
 */

import { useState, useCallback, useMemo } from 'react';
import { GitMerge, Loader2, CheckCircle2, AlertTriangle, Info } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/core/components/ui/dialog';
import { Button } from '@/core/components/ui/button';
import type { DesignItem } from '../../types';
import {
  mergeDesignItems,
  type MergeItemsResult,
} from '../../services/mergeItemsService';

interface MergeItemsDialogProps {
  open: boolean;
  selectedIds: Set<string>;
  allItems: DesignItem[];
  onClose: () => void;
  onComplete: () => void;
  projectId: string;
  userId: string;
}

type Step = 'configure' | 'processing' | 'done' | 'error';

export function MergeItemsDialog({
  open,
  selectedIds,
  allItems,
  onClose,
  onComplete,
  projectId,
  userId,
}: MergeItemsDialogProps) {
  const [step, setStep] = useState<Step>('configure');
  const [targetId, setTargetId] = useState<string | null>(null);
  const [result, setResult] = useState<MergeItemsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Resolve selected items with their data
  const selectedItems = useMemo(() => {
    return allItems
      .filter(i => selectedIds.has(i.id))
      .sort((a, b) => {
        const aParts = (a as any).partsSummary?.totalParts || 0;
        const bParts = (b as any).partsSummary?.totalParts || 0;
        return bParts - aParts; // Most parts first
      });
  }, [allItems, selectedIds]);

  // Auto-select target as item with most parts
  const effectiveTargetId = targetId || selectedItems[0]?.id || null;

  // Calculate merge preview
  const preview = useMemo(() => {
    if (!effectiveTargetId) return null;

    const sourceItems = selectedItems.filter(i => i.id !== effectiveTargetId);
    let totalParts = 0;
    let totalStandard = 0;
    let totalSpecial = 0;

    for (const item of sourceItems) {
      totalParts += ((item as any).parts?.length || 0);
      const mfg = (item as any).manufacturing || {};
      totalStandard += (mfg.standardParts?.length || 0);
      totalSpecial += (mfg.specialParts?.length || 0);
    }

    const targetItem = selectedItems.find(i => i.id === effectiveTargetId);
    return {
      targetName: targetItem?.name || 'Unknown',
      sourceCount: sourceItems.length,
      partsToMerge: totalParts,
      standardToMerge: totalStandard,
      specialToMerge: totalSpecial,
      sourceItems,
    };
  }, [selectedItems, effectiveTargetId]);

  const handleMerge = useCallback(async () => {
    if (!effectiveTargetId) return;
    setStep('processing');

    try {
      const sourceIds = Array.from(selectedIds).filter(id => id !== effectiveTargetId);
      const res = await mergeDesignItems({
        projectId,
        targetItemId: effectiveTargetId,
        sourceItemIds: sourceIds,
        userId,
      });
      setResult(res);
      setStep('done');
    } catch (err) {
      setError((err as Error).message || 'Merge operation failed');
      setStep('error');
    }
  }, [effectiveTargetId, selectedIds, projectId, userId]);

  const handleClose = useCallback(() => {
    if (step === 'done') {
      onComplete();
    } else {
      onClose();
    }
    setStep('configure');
    setTargetId(null);
    setResult(null);
    setError(null);
  }, [step, onClose, onComplete]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="w-5 h-5 text-[#0A7C8E]" />
            Merge Items — {selectedIds.size} Items
          </DialogTitle>
        </DialogHeader>

        {step === 'configure' && (
          <div className="space-y-4 py-2">
            {/* Target selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select target item (parts merge into this one)
              </label>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {selectedItems.map((item) => {
                  const partsCount = (item as any).partsSummary?.totalParts || (item as any).parts?.length || 0;
                  const materials = (item as any).partsSummary?.uniqueMaterials || 0;
                  const isTarget = item.id === effectiveTargetId;

                  return (
                    <button
                      key={item.id}
                      onClick={() => setTargetId(item.id)}
                      className={`w-full flex items-center justify-between p-3 rounded-lg border text-left transition-colors ${
                        isTarget
                          ? 'border-[#0A7C8E] bg-[#0A7C8E]/5 ring-1 ring-[#0A7C8E]/20'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                          isTarget ? 'border-[#0A7C8E]' : 'border-gray-300'
                        }`}>
                          {isTarget && <div className="w-2 h-2 rounded-full bg-[#0A7C8E]" />}
                        </div>
                        <div>
                          <p className={`text-sm font-medium ${isTarget ? 'text-[#0A7C8E]' : 'text-gray-900'}`}>
                            {item.name}
                          </p>
                          <p className="text-xs text-gray-500">{item.itemCode}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-medium text-gray-700">{partsCount} parts</p>
                        <p className="text-xs text-gray-400">{materials} materials</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Preview */}
            {preview && preview.partsToMerge > 0 && (
              <div className="bg-[#0A7C8E]/5 border border-[#0A7C8E]/20 rounded-lg p-3 space-y-2">
                <p className="text-sm font-medium text-[#0A7C8E]">
                  Merging into: {preview.targetName}
                </p>
                <div className="text-sm text-gray-600 space-y-1">
                  <p>{preview.partsToMerge} sheet parts from {preview.sourceCount} source item{preview.sourceCount !== 1 ? 's' : ''}</p>
                  {preview.standardToMerge > 0 && (
                    <p>{preview.standardToMerge} standard hardware items (will be consolidated)</p>
                  )}
                  {preview.specialToMerge > 0 && (
                    <p>{preview.specialToMerge} special parts will be added</p>
                  )}
                </div>
              </div>
            )}

            {preview && preview.partsToMerge === 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-sm text-amber-700">
                  Source items have no parts to merge. Only standard/special parts will be transferred.
                </p>
              </div>
            )}

            {/* Info note */}
            <div className="flex items-start gap-2 text-xs text-gray-500">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <p>Source items will be kept as empty shells — parts removed, but the item, history, approvals, and files are preserved.</p>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-[#0A7C8E]" />
            <p className="text-sm text-gray-500">
              Merging {preview?.partsToMerge || 0} parts into {preview?.targetName}...
            </p>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
            <div className="text-center space-y-1">
              <p className="text-sm font-medium text-green-700">
                {result?.mergedPartCount || 0} parts merged successfully
              </p>
              {(result?.mergedStandardPartsCount || 0) > 0 && (
                <p className="text-xs text-gray-500">
                  {result?.mergedStandardPartsCount} standard parts consolidated
                </p>
              )}
              {(result?.mergedSpecialPartsCount || 0) > 0 && (
                <p className="text-xs text-gray-500">
                  {result?.mergedSpecialPartsCount} special parts added
                </p>
              )}
              <p className="text-xs text-gray-400 mt-2">
                {result?.clearedSourceIds.length || 0} source items cleared
              </p>
            </div>
            {result?.errors && result.errors.length > 0 && (
              <div className="text-xs text-amber-600 space-y-0.5">
                {result.errors.map((e, i) => (
                  <p key={i}>{e.message}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {step === 'error' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <AlertTriangle className="w-8 h-8 text-red-500" />
            <p className="text-sm text-red-600">{error || 'An error occurred'}</p>
          </div>
        )}

        <DialogFooter>
          {step === 'configure' && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleMerge}
                disabled={!effectiveTargetId || selectedItems.length < 2}
                className="bg-[#0A7C8E] hover:bg-[#0A7C8E]/90"
              >
                <GitMerge className="w-4 h-4 mr-1.5" />
                Merge {preview?.partsToMerge || 0} Parts
              </Button>
            </div>
          )}
          {(step === 'done' || step === 'error') && (
            <Button variant="outline" size="sm" onClick={handleClose}>
              {step === 'done' ? 'Done' : 'Close'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
