/**
 * DispatchDialog
 * Dialog for dispatching items with delivery method and tracking reference
 */

import { useState } from 'react';
import { Truck, Loader2 } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { markAsDispatched } from '@/modules/manufacturing/services/fulfillmentService';
import type { FulfillmentItem } from '../services/fulfillmentQueryService';

interface DispatchDialogProps {
  open: boolean;
  onClose: () => void;
  item: FulfillmentItem;
  userId: string;
  onSuccess: () => void;
}

type DeliveryMethod = 'company_vehicle' | 'third_party' | 'client_pickup';

export function DispatchDialog({ open, onClose, item, userId, onSuccess }: DispatchDialogProps) {
  const [method, setMethod] = useState<DeliveryMethod>('company_vehicle');
  const [trackingRef, setTrackingRef] = useState('');
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const handleSubmit = async () => {
    setSaving(true);
    try {
      await markAsDispatched(
        item.id,
        { deliveryMethod: method, trackingRef: trackingRef || undefined },
        userId,
        item.projectId,
      );
      onSuccess();
      onClose();
    } catch (err) {
      console.error('Dispatch failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const methods: { value: DeliveryMethod; label: string }[] = [
    { value: 'company_vehicle', label: 'Company Vehicle' },
    { value: 'third_party', label: 'Third Party Courier' },
    { value: 'client_pickup', label: 'Client Pickup' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-4">
          <Truck className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Dispatch Item</h3>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          <span className="font-medium">{item.name}</span> — {item.projectName}
        </p>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-700">Delivery Method</label>
            <div className="grid grid-cols-1 gap-2 mt-1">
              {methods.map((m) => (
                <button
                  key={m.value}
                  onClick={() => setMethod(m.value)}
                  className={`text-left px-3 py-2 rounded border text-sm ${
                    method === m.value
                      ? 'border-primary bg-primary/5 text-primary font-medium'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {method === 'third_party' && (
            <div>
              <label className="text-sm font-medium text-gray-700">Tracking Reference</label>
              <Input
                value={trackingRef}
                onChange={(e) => setTrackingRef(e.target.value)}
                placeholder="Enter tracking number..."
                className="mt-1"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 mt-6">
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Truck className="w-4 h-4 mr-1" />}
            Dispatch
          </Button>
        </div>
      </div>
    </div>
  );
}
