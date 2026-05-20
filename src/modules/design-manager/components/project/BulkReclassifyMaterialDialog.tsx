/**
 * BulkReclassifyMaterialDialog Component
 * Dialog for changing materialType on multiple palette entries.
 * Mirrors inventory/components/BulkReclassifyDialog.tsx pattern.
 */

import { useState, useCallback } from 'react';
import { ArrowRightLeft, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/core/components/ui/dialog';
import { Button } from '@/core/components/ui/button';
import type { MaterialPaletteEntry, MaterialType } from '@/shared/types';
import {
  bulkUpdatePaletteEntries,
  type PaletteBulkResult,
} from '../../services/paletteBulkService';

interface BulkReclassifyMaterialDialogProps {
  open: boolean;
  selectedIds: Set<string>;
  selectedEntries?: MaterialPaletteEntry[];
  onClose: () => void;
  onComplete: () => void;
  projectId: string;
  userId: string;
}

type Step = 'form' | 'processing' | 'done' | 'error';

const MATERIAL_TYPE_OPTIONS: Array<{
  value: MaterialType;
  label: string;
  color: string;
}> = [
  { value: 'PANEL', label: 'Panel (Sheet Goods)', color: 'bg-blue-100 text-blue-800' },
  { value: 'TIMBER', label: 'Timber (Dimensional Lumber)', color: 'bg-green-100 text-green-800' },
  { value: 'GLASS', label: 'Glass', color: 'bg-cyan-100 text-cyan-800' },
  { value: 'METAL_BAR', label: 'Metal Bar', color: 'bg-slate-100 text-slate-800' },
  { value: 'ALUMINIUM', label: 'Aluminium', color: 'bg-gray-100 text-gray-800' },
  { value: 'SOLID', label: 'Solid Wood (Legacy)', color: 'bg-amber-100 text-amber-800' },
  { value: 'VENEER', label: 'Veneer', color: 'bg-purple-100 text-purple-800' },
  { value: 'EDGE', label: 'Edge Banding', color: 'bg-gray-100 text-gray-700' },
  { value: 'STONE', label: 'Stone / Countertop', color: 'bg-amber-200 text-amber-900' },
  { value: 'FABRIC', label: 'Fabric / Upholstery', color: 'bg-pink-100 text-pink-800' },
  { value: 'COMPONENT', label: 'Component (Bought-Out)', color: 'bg-zinc-100 text-zinc-800' },
];

export function BulkReclassifyMaterialDialog({
  open,
  selectedIds,
  selectedEntries,
  onClose,
  onComplete,
  projectId,
  userId,
}: BulkReclassifyMaterialDialogProps) {
  const [step, setStep] = useState<Step>('form');
  const [materialType, setMaterialType] = useState<MaterialType | ''>('');
  const [progress, setProgress] = useState<{ current: number; total: number } | null>(null);
  const [result, setResult] = useState<PaletteBulkResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleApply = useCallback(async () => {
    if (!materialType) return;

    setStep('processing');
    setProgress({ current: 0, total: selectedIds.size });

    try {
      const res = await bulkUpdatePaletteEntries(
        projectId,
        Array.from(selectedIds),
        { materialType },
        userId,
        (done, total) => setProgress({ current: done, total }),
      );
      setResult(res);
      setStep('done');
    } catch (err) {
      setError((err as Error).message || 'Reclassification failed');
      setStep('error');
    }
  }, [materialType, selectedIds, projectId, userId]);

  const handleClose = useCallback(() => {
    if (step === 'done') {
      onComplete();
    } else {
      onClose();
    }
    // Reset form
    setStep('form');
    setMaterialType('');
    setProgress(null);
    setResult(null);
    setError(null);
  }, [step, onClose, onComplete]);

  const hasChanges = !!materialType;
  const selectedOption = MATERIAL_TYPE_OPTIONS.find(o => o.value === materialType);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-blue-500" />
            Reclassify Material Type — {selectedIds.size} Entries
          </DialogTitle>
        </DialogHeader>

        {step === 'form' && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-500">
              Change the material type classification for selected palette entries.
              Incompatible stock configuration will be cleared.
            </p>

            {/* Material Type Select */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                New Material Type
              </label>
              <select
                value={materialType}
                onChange={(e) => setMaterialType(e.target.value as MaterialType | '')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
              >
                <option value="">Select type...</option>
                {MATERIAL_TYPE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Preview */}
            {hasChanges && selectedOption && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm font-medium text-blue-800">
                  Changing {selectedIds.size} entr{selectedIds.size !== 1 ? 'ies' : 'y'} to:
                </p>
                <div className="mt-1.5">
                  <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full ${selectedOption.color}`}>
                    {selectedOption.value}
                  </span>
                </div>
                {selectedEntries && selectedEntries.length > 0 && (
                  <ul className="mt-2 space-y-0.5 max-h-32 overflow-y-auto">
                    {selectedEntries.slice(0, 10).map((entry) => (
                      <li key={entry.id} className="text-xs text-blue-700">
                        {entry.designName}
                        {entry.materialType !== materialType && (
                          <span className="text-blue-400 ml-1">
                            ({entry.materialType} → {materialType})
                          </span>
                        )}
                      </li>
                    ))}
                    {selectedEntries.length > 10 && (
                      <li className="text-xs text-blue-400">
                        ...and {selectedEntries.length - 10} more
                      </li>
                    )}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        {step === 'processing' && (
          <div className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-sm text-gray-500">
              Updating {progress?.current ?? 0} of {progress?.total ?? selectedIds.size} entries...
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
              {result?.successCount ?? 0} entries reclassified successfully
            </p>
            {(result?.failureCount ?? 0) > 0 && (
              <p className="text-sm text-red-600">
                {result?.failureCount} entries failed to update
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
          {step === 'form' && (
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleClose}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleApply} disabled={!hasChanges}>
                Apply Changes
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
