/**
 * ReceiveDialog
 * Intake step for manufacturing-ready items entering fulfillment.
 */

import { useState } from 'react';
import { PackageCheck, Loader2 } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { markAsReceived } from '@/modules/manufacturing/services/fulfillmentService';
import type { FulfillmentItem } from '../services/fulfillmentQueryService';

interface ReceiveDialogProps {
  open: boolean;
  onClose: () => void;
  item: FulfillmentItem;
  userId: string;
  onSuccess: () => void;
}

export function ReceiveDialog({
  open,
  onClose,
  item,
  userId,
  onSuccess,
}: ReceiveDialogProps) {
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await markAsReceived(
        item.id,
        userId,
        item.projectId,
        item.manufacturingOrderId,
      );
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Receive failed:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 mb-4">
          <PackageCheck className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Receive into Fulfillment</h3>
        </div>

        <p className="text-sm text-gray-600 mb-2">
          <span className="font-medium">{item.name}</span> — {item.projectName}
        </p>
        <p className="text-xs text-gray-500">
          Confirm this item has been physically received by the fulfillment team.
        </p>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <Loader2 className="w-4 h-4 mr-1 animate-spin" />
            ) : (
              <PackageCheck className="w-4 h-4 mr-1" />
            )}
            Confirm Receipt
          </Button>
        </div>
      </div>
    </div>
  );
}
