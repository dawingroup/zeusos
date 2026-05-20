/**
 * BulkUnmapDialog Component
 * Dialog for bulk unmapping inventory from palette entries.
 * Mirrors inventory/components/BulkStatusChangeDialog.tsx pattern.
 */

import { useState, useCallback, useMemo } from 'react';
import { Unlink, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/core/components/ui/dialog';
import { Button } from '@/core/components/ui/button';
import type { MaterialPaletteEntry } from '@/shared/types';
import {
  bulkUnmapPaletteEntries,
  type PaletteBulkResult,
} from '../../services/paletteBulkService';

interface BulkUnmapDialogProps {
  open: boolean;
  selectedIds: Set<string>;
  selectedEntries?: MaterialPaletteEntry[];
  onClose: () => void;
  onComplete: () => void;
  projectId: string;
  userId: string;
}

type Step = 'confirm' | 'processing' | 'done' | 'error';

export function BulkUnmapDialog({
  open,
  selectedIds,
  selectedEntries,
  onClose,
  onComplete,
  projectId,
  userId,
}: BulkUnmapDialogProps) {
  const [step, setStep] = useState<Step>('confirm');
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [result, setResult] = useState<PaletteBulkResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mappedEntries = useMemo(
    () => (selectedEntries || []).filter(e => !!e.inventoryId),
    [selectedEntries]
  );

  const handleConfirm = useCallback(async () => {
    const idsToUnmap = mappedEntries.map(e => e.id);
    if (idsToUnmap.length === 0) return;

    setStep('processing');
    setProgress({ current: 0, total: idsToUnmap.length });

    try {
      const res = await bulkUnmapPaletteEntries(
        projectId,
        idsToUnmap,
        userId,
        (done, total) => setProgress({ current: done, total }),
      );
      setResult(res);
      setStep('done');
    } catch (err) {
      setError((err as Error).message || 'Unmap operation failed');
      setStep('error');
    }
  }, [mappedEntries, projectId, userId]);

  const handleClose = useCallback(() => {
    if (step === 'done') {
      onComplete();
    } else {
      onClose();
    }
    // Reset
    setStep('confirm');
    setProgress(null);
    setResult(null);
    setError(null);
  }, [step, onClose, onComplete]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Unlink className="w-5 h-5 text-amber-500" />
            Bulk Unmap — {selectedIds.size} Entries
          </DialogTitle>
        </DialogHeader>

        {step === 'confirm' && (
          <div className="space-y-4 py-2">
            {mappedEntries.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center">
                <p className="text-sm text-gray-500">
                  None of the selected entries are mapped to inventory.
                </p>
              </div>
            ) : (
              <>
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-sm font-medium text-amber-800">
                    This will clear inventory mapping, pricing, and stock configuration
                    for {mappedEntries.length} entr{mappedEntries.length !== 1 ? 'ies' : 'y'}.
                  </p>
                </div>

                <div className="max-h-48 overflow-y-auto space-y-1">
                  {mappedEntries.map((entry) => (
                    <div key={entry.id} className="flex items-center justify-between text-sm py-1 px-2 rounded hover:bg-gray-50">
                      <span className="text-gray-900">{entry.designName}</span>
                      <span className="text-gray-400 text-xs">{entry.inventoryName}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
            <p className="text-sm text-gray-500">
              Unmapping {progress?.current ?? 0} of {progress?.total ?? mappedEntries.length} entries...
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-amber-500 h-2 rounded-full transition-all"
                style={{ width: `${progress ? (progress.current / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
            <p className="text-sm text-green-700 font-medium">
              {result?.successCount ?? 0} entries unmapped successfully
            </p>
            {(result?.failureCount ?? 0) > 0 && (
              <p className="text-sm text-red-600">
                {result?.failureCount} entries failed
              </p>
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
                size="sm"
                onClick={handleConfirm}
                disabled={mappedEntries.length === 0}
              >
                Unmap {mappedEntries.length} Entr{mappedEntries.length !== 1 ? 'ies' : 'y'}
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
