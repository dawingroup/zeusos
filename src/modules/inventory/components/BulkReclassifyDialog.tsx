/**
 * BulkReclassifyDialog Component
 * Dialog for changing category, classification, status, and subcategory on multiple items.
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
import { useBulkOperations } from '../hooks/useBulkOperations';
import { useCategories } from '../hooks/useCategories';
import {
  type InventoryCategory,
  type InventoryClassification,
  type InventoryListItem,
} from '../types';
import type { BulkUpdateFields } from '../services/inventoryBulkService';

interface BulkReclassifyDialogProps {
  open: boolean;
  selectedIds: Set<string>;
  selectedItems?: InventoryListItem[];
  onClose: () => void;
  onComplete: () => void;
  userId: string;
}

type Step = 'form' | 'processing' | 'done' | 'error';

export function BulkReclassifyDialog({
  open,
  selectedIds,
  onClose,
  onComplete,
  userId,
}: BulkReclassifyDialogProps) {
  const { runBulkUpdate, progress, result, error } = useBulkOperations();
  const { selectableCategories, bySlug: categoryBySlug } = useCategories();

  const [step, setStep] = useState<Step>('form');
  const [category, setCategory] = useState<InventoryCategory | ''>('');
  const [classification, setClassification] = useState<InventoryClassification | ''>('');
  const [subcategory, setSubcategory] = useState('');

  const handleApply = useCallback(async () => {
    const updates: BulkUpdateFields = {};
    if (category) updates.category = category;
    if (classification) updates.classification = classification;
    if (subcategory.trim()) updates.subcategory = subcategory.trim();

    if (Object.keys(updates).length === 0) return;

    setStep('processing');
    try {
      await runBulkUpdate(Array.from(selectedIds), updates, userId);
      setStep('done');
    } catch {
      setStep('error');
    }
  }, [category, classification, subcategory, selectedIds, userId, runBulkUpdate]);

  const handleClose = useCallback(() => {
    if (step === 'done') {
      onComplete();
    } else {
      onClose();
    }
    // Reset form
    setStep('form');
    setCategory('');
    setClassification('');
    setSubcategory('');
  }, [step, onClose, onComplete]);

  const hasChanges = category || classification || subcategory.trim();
  const changePreview: string[] = [];
  if (category) changePreview.push(`Category: ${categoryBySlug.get(category)?.name ?? category}`);
  if (classification) changePreview.push(`Classification: ${classification}`);
  if (subcategory.trim()) changePreview.push(`Subcategory: ${subcategory.trim()}`);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-blue-500" />
            Bulk Reclassify — {selectedIds.size} Items
          </DialogTitle>
        </DialogHeader>

        {step === 'form' && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-gray-500">
              Leave fields blank to keep current values. Only changed fields will be updated.
            </p>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as InventoryCategory | '')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
              >
                <option value="">No change</option>
                {selectableCategories.map((cat) => (
                  <option key={cat.slug} value={cat.slug}>
                    {cat.icon ? cat.icon + ' ' : ''}{cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Classification */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Classification</label>
              <select
                value={classification}
                onChange={(e) => setClassification(e.target.value as InventoryClassification | '')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
              >
                <option value="">No change</option>
                <option value="material">Material</option>
                <option value="product">Product</option>
                <option value="kit">Kit</option>
              </select>
            </div>

            {/* Subcategory */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Subcategory</label>
              <input
                type="text"
                value={subcategory}
                onChange={(e) => setSubcategory(e.target.value)}
                placeholder="Leave blank for no change"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
              />
            </div>

            {/* Preview */}
            {hasChanges && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-sm font-medium text-blue-800">
                  Changing {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''}:
                </p>
                <ul className="mt-1 space-y-0.5">
                  {changePreview.map((change, i) => (
                    <li key={i} className="text-sm text-blue-700">• {change}</li>
                  ))}
                </ul>
              </div>
            )}
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
              {result?.successCount ?? 0} items updated successfully
            </p>
            {(result?.failureCount ?? 0) > 0 && (
              <p className="text-sm text-red-600">
                {result?.failureCount} items failed to update
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
