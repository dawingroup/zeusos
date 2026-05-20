/**
 * PackingDialog
 * Dialog for marking items as packed with checklist and package details
 */

import { useState } from 'react';
import { Package, Loader2 } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Textarea } from '@/core/components/ui/textarea';
import { markAsPacked } from '@/modules/manufacturing/services/fulfillmentService';
import type { FulfillmentItem } from '../services/fulfillmentQueryService';

interface PackingDialogProps {
  open: boolean;
  onClose: () => void;
  item: FulfillmentItem;
  userId: string;
  onSuccess: () => void;
}

export function PackingDialog({ open, onClose, item, userId, onSuccess }: PackingDialogProps) {
  const [packageCount, setPackageCount] = useState(1);
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await markAsPacked(
        item.id,
        { packageCount, packageNotes: notes || undefined },
        userId,
        item.projectId,
      );
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Packing failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <Package className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Pack Item</h3>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          <span className="font-medium">{item.name}</span> — {item.projectName}
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Number of Packages</label>
            <Input
              type="number"
              min={1}
              value={packageCount}
              onChange={(e) => setPackageCount(Number(e.target.value) || 1)}
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700">Packing Notes</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any special packing instructions or notes..."
              className="mt-1"
              rows={3}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Package className="w-4 h-4 mr-1" />}
            Mark as Packed
          </Button>
        </div>
      </div>
    </div>
  );
}
