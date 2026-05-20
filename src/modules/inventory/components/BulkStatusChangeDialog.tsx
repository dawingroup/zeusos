/**
 * BulkStatusChangeDialog Component
 * Quick status change dialog with three large clickable status cards.
 */

import { useState, useCallback } from 'react';
import { CheckCircle, Clock, AlertCircle, Archive, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/core/components/ui/dialog';
import { Button } from '@/core/components/ui/button';
import { useBulkOperations } from '../hooks/useBulkOperations';
import type { InventoryStatus } from '../types';

interface BulkStatusChangeDialogProps {
  open: boolean;
  selectedIds: Set<string>;
  onClose: () => void;
  onComplete: () => void;
  userId: string;
}

type Step = 'select' | 'processing' | 'done' | 'error';

const STATUS_OPTIONS: Array<{
  value: InventoryStatus;
  label: string;
  description: string;
  icon: typeof CheckCircle;
  activeColor: string;
  hoverColor: string;
}> = [
  {
    value: 'active',
    label: 'Active',
    description: 'Available for use and ordering',
    icon: CheckCircle,
    activeColor: 'border-green-500 bg-green-50 text-green-700',
    hoverColor: 'hover:border-green-300 hover:bg-green-50/50',
  },
  {
    value: 'discontinued',
    label: 'Discontinued',
    description: 'No longer available for new orders',
    icon: AlertCircle,
    activeColor: 'border-gray-500 bg-gray-50 text-gray-700',
    hoverColor: 'hover:border-gray-300 hover:bg-gray-50/50',
  },
  {
    value: 'out-of-stock',
    label: 'Out of Stock',
    description: 'Temporarily unavailable',
    icon: Clock,
    activeColor: 'border-amber-500 bg-amber-50 text-amber-700',
    hoverColor: 'hover:border-amber-300 hover:bg-amber-50/50',
  },
  {
    value: 'archived',
    label: 'Archived',
    description: 'Hidden from active views, kept for reference',
    icon: Archive,
    activeColor: 'border-purple-500 bg-purple-50 text-purple-700',
    hoverColor: 'hover:border-purple-300 hover:bg-purple-50/50',
  },
];

export function BulkStatusChangeDialog({
  open,
  selectedIds,
  onClose,
  onComplete,
  userId,
}: BulkStatusChangeDialogProps) {
  const { runBulkUpdate, progress, result, error } = useBulkOperations();

  const [step, setStep] = useState<Step>('select');
  const [selectedStatus, setSelectedStatus] = useState<InventoryStatus | null>(null);

  const handleApply = useCallback(async () => {
    if (!selectedStatus) return;

    setStep('processing');
    try {
      await runBulkUpdate(Array.from(selectedIds), { status: selectedStatus }, userId);
      setStep('done');
    } catch {
      setStep('error');
    }
  }, [selectedStatus, selectedIds, userId, runBulkUpdate]);

  const handleClose = useCallback(() => {
    if (step === 'done') {
      onComplete();
    } else {
      onClose();
    }
    setStep('select');
    setSelectedStatus(null);
  }, [step, onClose, onComplete]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            Change Status — {selectedIds.size} Item{selectedIds.size !== 1 ? 's' : ''}
          </DialogTitle>
        </DialogHeader>

        {step === 'select' && (
          <div className="space-y-3 py-2">
            {STATUS_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isSelected = selectedStatus === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => setSelectedStatus(opt.value)}
                  className={`w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-all text-left ${
                    isSelected ? opt.activeColor : `border-gray-200 ${opt.hoverColor}`
                  }`}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <div>
                    <div className="font-medium text-sm">{opt.label}</div>
                    <div className="text-xs text-gray-500">{opt.description}</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-sm text-gray-500">
              Updating {progress?.current ?? 0} of {progress?.total ?? selectedIds.size} items...
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${progress ? (progress.current / progress.total) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}

        {step === 'done' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <CheckCircle2 className="w-8 h-8 text-green-500" />
            <p className="text-sm text-green-700 font-medium">
              {result?.successCount ?? 0} items updated to "{selectedStatus}"
            </p>
            {(result?.failureCount ?? 0) > 0 && (
              <p className="text-sm text-red-600">{result?.failureCount} failed</p>
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
          {step === 'select' && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleClose}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleApply} disabled={!selectedStatus}>
                Apply
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
