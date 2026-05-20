/**
 * FulfillmentItemDetailPage
 * Detail workspace for completing a fulfillment item end-to-end.
 */

import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, PackageCheck, Clock, Truck, MapPin, Wrench, CheckCircle2 } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { useFulfillmentItems } from '../hooks/useFulfillmentItems';
import { ReceiveDialog } from '../components/ReceiveDialog';
import { PackingDialog } from '../components/PackingDialog';
import { DispatchDialog } from '../components/DispatchDialog';
import { DeliveryDialog } from '../components/DeliveryDialog';
import { InstallationDialog } from '../components/InstallationDialog';
import type { FulfillmentItem } from '../services/fulfillmentQueryService';
import { deriveFulfillmentStatus } from '@/modules/design-manager/services/designItemStatusDerivation';
import type { FulfillmentStatus } from '@/modules/design-manager/types';

type DialogType = 'receive' | 'packing' | 'dispatch' | 'delivery' | 'installation' | null;

const STATUS_STEPS: Array<{ status: FulfillmentStatus; label: string }> = [
  { status: 'awaiting_receipt', label: 'Awaiting Receipt' },
  { status: 'received', label: 'Received' },
  { status: 'packing', label: 'Packing' },
  { status: 'ready_for_dispatch', label: 'Ready for Dispatch' },
  { status: 'dispatched', label: 'Dispatched' },
  { status: 'delivered', label: 'Delivered' },
  { status: 'installed', label: 'Installed' },
  { status: 'complete', label: 'Complete' },
];

export default function FulfillmentItemDetailPage() {
  const { itemId } = useParams();
  const decodedItemId = decodeURIComponent(itemId || '');
  const navigate = useNavigate();
  const { user } = useAuth();
  const { items, loading } = useFulfillmentItems();
  const [activeDialog, setActiveDialog] = useState<DialogType>(null);

  const item = useMemo(
    () => items.find((i) => i.id === decodedItemId) || null,
    [decodedItemId, items],
  );

  const status = item ? deriveFulfillmentStatus(item) : null;
  const userId = user?.email || '';

  const openAction = (target: FulfillmentItem) => {
    const derived = deriveFulfillmentStatus(target);
    if (derived === 'awaiting_receipt') return setActiveDialog('receive');
    if (derived === 'received' || derived === 'packing') return setActiveDialog('packing');
    if (derived === 'ready_for_dispatch') return setActiveDialog('dispatch');
    if (derived === 'dispatched') return setActiveDialog('delivery');
    if (derived === 'delivered' || derived === 'installed') return setActiveDialog('installation');
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (!item) {
    return (
      <div className="p-6 space-y-4">
        <Button variant="outline" onClick={() => navigate('/fulfillment')}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to Fulfillment
        </Button>
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
          <p className="text-gray-600">Fulfillment item not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" onClick={() => navigate('/fulfillment')}>
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(`/design/project/${item.projectId}`)}>
            Project
          </Button>
          {item.manufacturingOrderId && (
            <Button variant="outline" onClick={() => navigate(`/manufacturing/orders/${item.manufacturingOrderId}`)}>
              {item.moNumber || 'Manufacturing Order'}
            </Button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5 space-y-3">
        <h1 className="text-2xl font-bold text-gray-900">{item.name}</h1>
        {item.source === 'manufacturing-ready' && (
          <span className="inline-flex text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
            Manufacturing Intake
          </span>
        )}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-gray-500">Project</p>
            <p className="font-medium text-gray-900">{item.projectName}</p>
          </div>
          <div>
            <p className="text-gray-500">Customer</p>
            <p className="font-medium text-gray-900">{item.customerName}</p>
          </div>
          <div>
            <p className="text-gray-500">Current Status</p>
            <p className="font-medium text-gray-900">{status?.replace(/_/g, ' ')}</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Fulfillment Progress</h2>
        <div className="grid grid-cols-1 md:grid-cols-7 gap-2">
          {STATUS_STEPS.map((step) => {
            const active = status === step.status;
            const done = STATUS_STEPS.findIndex((s) => s.status === (status || 'awaiting_receipt')) >= STATUS_STEPS.findIndex((s) => s.status === step.status);
            return (
              <div
                key={step.status}
                className={`rounded-md border p-2 text-xs ${
                  active
                    ? 'border-primary bg-primary/10 text-primary'
                    : done
                      ? 'border-green-200 bg-green-50 text-green-700'
                      : 'border-gray-200 bg-gray-50 text-gray-500'
                }`}
              >
                {step.label}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-base font-semibold text-gray-900 mb-3">Next Action</h2>
        <div className="flex flex-wrap gap-2">
          {status === 'awaiting_receipt' && (
            <Button onClick={() => openAction(item)}>
              <PackageCheck className="w-4 h-4 mr-1" />
              Receive into Fulfillment
            </Button>
          )}
          {(status === 'received' || status === 'packing') && (
            <Button onClick={() => openAction(item)}>
              <Clock className="w-4 h-4 mr-1" />
              Packing
            </Button>
          )}
          {status === 'ready_for_dispatch' && (
            <Button onClick={() => openAction(item)}>
              <Truck className="w-4 h-4 mr-1" />
              Dispatch
            </Button>
          )}
          {status === 'dispatched' && (
            <Button onClick={() => openAction(item)}>
              <MapPin className="w-4 h-4 mr-1" />
              Confirm Delivery
            </Button>
          )}
          {(status === 'delivered' || status === 'installed') && (
            <Button onClick={() => openAction(item)}>
              <Wrench className="w-4 h-4 mr-1" />
              Installation / Completion
            </Button>
          )}
          {status === 'complete' && (
            <Button variant="outline" disabled>
              <CheckCircle2 className="w-4 h-4 mr-1" />
              Fulfillment Complete
            </Button>
          )}
        </div>
      </div>

      <ReceiveDialog
        open={activeDialog === 'receive'}
        onClose={() => setActiveDialog(null)}
        item={item}
        userId={userId}
        onSuccess={() => setActiveDialog(null)}
      />
      <PackingDialog
        open={activeDialog === 'packing'}
        onClose={() => setActiveDialog(null)}
        item={item}
        userId={userId}
        onSuccess={() => setActiveDialog(null)}
      />
      <DispatchDialog
        open={activeDialog === 'dispatch'}
        onClose={() => setActiveDialog(null)}
        item={item}
        userId={userId}
        onSuccess={() => setActiveDialog(null)}
      />
      <DeliveryDialog
        open={activeDialog === 'delivery'}
        onClose={() => setActiveDialog(null)}
        item={item}
        userId={userId}
        onSuccess={() => setActiveDialog(null)}
      />
      <InstallationDialog
        open={activeDialog === 'installation'}
        onClose={() => setActiveDialog(null)}
        item={item}
        userId={userId}
        onSuccess={() => setActiveDialog(null)}
      />
    </div>
  );
}
