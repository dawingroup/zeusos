/**
 * BulkAIEnhanceDialog Component
 * Sequential AI enhancement for multiple items with configurable confidence threshold.
 * Shows per-item progress and a summary on completion.
 */

import { useState, useCallback } from 'react';
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/core/components/ui/dialog';
import { Button } from '@/core/components/ui/button';
import { ScrollArea } from '@/core/components/ui/scroll-area';
import { useBulkOperations } from '../hooks/useBulkOperations';
import type { InventoryListItem } from '../types';

interface BulkAIEnhanceDialogProps {
  open: boolean;
  selectedItems: InventoryListItem[];
  onClose: () => void;
  onComplete: () => void;
  userId: string;
}

type Step = 'config' | 'processing' | 'done' | 'error';

export function BulkAIEnhanceDialog({
  open,
  selectedItems,
  onClose,
  onComplete,
  userId,
}: BulkAIEnhanceDialogProps) {
  const { runBulkAIEnhancement, progress, result, error } = useBulkOperations();

  const [step, setStep] = useState<Step>('config');
  const [confidenceThreshold, setConfidenceThreshold] = useState(0.75);

  const handleStart = useCallback(async () => {
    setStep('processing');
    try {
      await runBulkAIEnhancement(selectedItems, userId, confidenceThreshold);
      setStep('done');
    } catch {
      setStep('error');
    }
  }, [selectedItems, userId, confidenceThreshold, runBulkAIEnhancement]);

  const handleClose = useCallback(() => {
    if (step === 'done') {
      onComplete();
    } else {
      onClose();
    }
    setStep('config');
    setConfidenceThreshold(0.75);
  }, [step, onClose, onComplete]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-500" />
            AI Enhance — {selectedItems.length} Item{selectedItems.length !== 1 ? 's' : ''}
          </DialogTitle>
        </DialogHeader>

        {step === 'config' && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-500">
              Claude AI will analyse each item and auto-apply suggestions that meet the confidence threshold.
              Fields like name, description, category, tags, and classification may be updated.
            </p>

            {/* Confidence threshold */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Auto-accept confidence threshold: <span className="font-mono text-purple-600">{Math.round(confidenceThreshold * 100)}%</span>
              </label>
              <input
                type="range"
                min={0.5}
                max={1}
                step={0.05}
                value={confidenceThreshold}
                onChange={(e) => setConfidenceThreshold(parseFloat(e.target.value))}
                className="w-full accent-purple-500"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>50% (more changes)</span>
                <span>100% (only certain)</span>
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 text-sm text-purple-800">
              Items will be processed one at a time. Suggestions with confidence &ge; {Math.round(confidenceThreshold * 100)}% will be auto-applied.
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="space-y-4 py-4">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-purple-500" />
              <p className="text-sm text-gray-600">
                Enhancing: <span className="font-medium">{progress?.currentItemName || '...'}</span>
              </p>
              <p className="text-xs text-gray-400">
                {(progress?.current ?? 0) + 1} of {progress?.total ?? selectedItems.length}
              </p>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-purple-500 h-2 rounded-full transition-all"
                style={{
                  width: `${progress ? ((progress.current + 1) / progress.total) * 100 : 0}%`,
                }}
              />
            </div>
          </div>
        )}

        {step === 'done' && result && (
          <div className="space-y-4 py-2">
            <div className="flex flex-col items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
              <p className="text-sm text-green-700 font-medium">
                Enhancement complete
              </p>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 bg-green-50 rounded-lg">
                <div className="text-xl font-bold text-green-700">{result.successCount}</div>
                <div className="text-xs text-green-600">Enhanced</div>
              </div>
              <div className="text-center p-3 bg-red-50 rounded-lg">
                <div className="text-xl font-bold text-red-700">{result.failureCount}</div>
                <div className="text-xs text-red-600">Failed</div>
              </div>
              <div className="text-center p-3 bg-gray-50 rounded-lg">
                <div className="text-xl font-bold text-gray-700">{result.totalProcessed}</div>
                <div className="text-xs text-gray-600">Total</div>
              </div>
            </div>

            {/* Per-item results */}
            {result.failureCount > 0 && (
              <div>
                <h4 className="text-sm font-medium text-gray-700 mb-2">Failed Items</h4>
                <ScrollArea className="max-h-32">
                  <div className="space-y-1">
                    {result.results
                      .filter((r) => !r.success)
                      .map((r) => (
                        <div key={r.itemId} className="flex items-center gap-2 py-1 px-2 text-sm">
                          <XCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                          <span className="text-gray-700">{r.itemName}</span>
                          <span className="text-xs text-gray-400">{r.error}</span>
                        </div>
                      ))}
                  </div>
                </ScrollArea>
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
          {step === 'config' && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleClose}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleStart}>
                <Sparkles className="w-4 h-4 mr-1" />
                Start Enhancement
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
