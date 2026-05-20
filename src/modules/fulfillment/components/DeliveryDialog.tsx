/**
 * DeliveryDialog
 * Dialog for confirming delivery with notes
 */

import { useState } from 'react';
import { MapPin, Loader2 } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Textarea } from '@/core/components/ui/textarea';
import { markAsDelivered } from '@/modules/manufacturing/services/fulfillmentService';
import { checkAndAutoCompleteProject } from '../services/fulfillmentQueryService';
import type { FulfillmentItem } from '../services/fulfillmentQueryService';

interface DeliveryDialogProps {
  open: boolean;
  onClose: () => void;
  item: FulfillmentItem;
  userId: string;
  onSuccess: () => void;
}

export function DeliveryDialog({ open, onClose, item, userId, onSuccess }: DeliveryDialogProps) {
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await markAsDelivered(item.id, notes || undefined, userId, item.projectId);
      await checkAndAutoCompleteProject(item.projectId);
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Delivery confirmation failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <MapPin className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Confirm Delivery</h3>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          <span className="font-medium">{item.name}</span> — {item.projectName}
        </p>

        <div>
          <label className="text-sm font-medium text-gray-700">Delivery Notes</label>
          <Textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any delivery notes or observations..."
            className="mt-1"
            rows={3}
          />
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <MapPin className="w-4 h-4 mr-1" />}
            Confirm Delivered
          </Button>
        </div>
      </div>
    </div>
  );
}
