/**
 * BulkDeleteDialog Component
 * Destructive delete confirmation with safety input for 10+ items.
 */

import { useState, useCallback } from 'react';
import { Trash2, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
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

interface BulkDeleteDialogProps {
  open: boolean;
  selectedIds: Set<string>;
  selectedItems: InventoryListItem[];
  onClose: () => void;
  onComplete: () => void;
}

type Step = 'confirm' | 'processing' | 'done' | 'error';

export function BulkDeleteDialog({
  open,
  selectedIds,
  selectedItems,
  onClose,
  onComplete,
}: BulkDeleteDialogProps) {
  const { runBulkDelete, progress, result, error } = useBulkOperations();

  const [step, setStep] = useState<Step>('confirm');
  const [confirmText, setConfirmText] = useState('');

  const requiresConfirmText = selectedIds.size >= 10;
  const canDelete = requiresConfirmText ? confirmText === 'DELETE' : true;

  const handleDelete = useCallback(async () => {
    if (!canDelete) return;

    setStep('processing');
    try {
      await runBulkDelete(Array.from(selectedIds));
      setStep('done');
    } catch {
      setStep('error');
    }
  }, [canDelete, selectedIds, runBulkDelete]);

  const handleClose = useCallback(() => {
    if (step === 'done') {
      onComplete();
    } else {
      onClose();
    }
    setStep('confirm');
    setConfirmText('');
  }, [step, onClose, onComplete]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <Trash2 className="w-5 h-5" />
            Delete {selectedIds.size} Item{selectedIds.size !== 1 ? 's' : ''}
          </DialogTitle>
        </DialogHeader>

        {step === 'confirm' && (
          <div className="space-y-4 py-2">
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800 font-medium">
                This action cannot be undone.
              </p>
              <p className="text-sm text-red-700 mt-1">
                The following {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''} will be permanently deleted:
              </p>
            </div>

            {/* Item list */}
            <ScrollArea className="max-h-48">
              <div className="space-y-1">
                {selectedItems.map((item) => (
                  <div key={item.id} className="flex items-center gap-2 py-1 px-2 rounded text-sm">
                    <span className="font-mono text-xs text-gray-500">{item.sku}</span>
                    <span className="text-gray-700">{item.displayName || item.name}</span>
                  </div>
                ))}
              </div>
            </ScrollArea>

            {/* Safety confirmation for large deletes */}
            {requiresConfirmText && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Type <span className="font-mono font-bold">DELETE</span> to confirm
                </label>
                <input
                  type="text"
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="DELETE"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-red-500 focus:border-red-500"
                  autoFocus
                />
              </div>
            )}
          </div>
        )}

        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-red-500" />
            <p className="text-sm text-gray-500">
              Deleting {progress?.current ?? 0} of {progress?.total ?? selectedIds.size} items...
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-red-500 h-2 rounded-full transition-all"
                style={{ width: `${progress ? (progress.current / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
            <p className="text-sm text-green-700 font-medium">
              {result?.successCount ?? 0} items deleted
            </p>
            {(result?.failureCount ?? 0) > 0 && (
              <p className="text-sm text-red-600">{result?.failureCount} failed to delete</p>
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
          {step === 'confirm' && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleDelete}
                disabled={!canDelete}
              >
                Delete {selectedIds.size} Item{selectedIds.size !== 1 ? 's' : ''}
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
