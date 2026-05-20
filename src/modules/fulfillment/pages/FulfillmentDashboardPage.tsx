/**
 * FulfillmentDashboardPage
 * Main fulfillment page with kanban board and summary stats
 */

import { useState, useMemo } from 'react';
import { Package } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useFulfillmentItems } from '../hooks/useFulfillmentItems';
import { FulfillmentBoard } from '../components/FulfillmentBoard';
import { ReceiveDialog } from '../components/ReceiveDialog';
import { PackingDialog } from '../components/PackingDialog';
import { DispatchDialog } from '../components/DispatchDialog';
import { DeliveryDialog } from '../components/DeliveryDialog';
import { KPIGrid, KPICard } from '@/shared/components/data-display';
import { InstallationDialog } from '../components/InstallationDialog';
import type { FulfillmentItem } from '../services/fulfillmentQueryService';
import type { FulfillmentStatus } from '@/modules/design-manager/types';
import { deriveFulfillmentStatus } from '@/modules/design-manager/services/designItemStatusDerivation';
import { moveToFulfillmentStage } from '@/modules/manufacturing/services/fulfillmentService';

type DialogType = 'receive' | 'packing' | 'dispatch' | 'delivery' | 'installation' | null;

export default function FulfillmentDashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const filterProject = searchParams.get('project') || undefined;

  const { items, byStatus, loading } = useFulfillmentItems(filterProject);
  const [activeDialog, setActiveDialog] = useState<DialogType>(null);
  const [selectedItem, setSelectedItem] = useState<FulfillmentItem | null>(null);
  const [movingItemIds, setMovingItemIds] = useState<Set<string>>(new Set());

  // P7/F10: derive fulfillment status from tracking timestamps so UI
  // state survives drift between the flat field and the FulfillmentTracking
  // sub-object.
  const stats = useMemo(() => {
    const needsAction = items.filter(
      (i) => ['awaiting_receipt', 'received', 'ready_for_dispatch', 'delivered'].includes(deriveFulfillmentStatus(i))
    ).length;
    const inTransit = items.filter(
      (i) => deriveFulfillmentStatus(i) === 'dispatched'
    ).length;
    const completed = items.filter(
      (i) => deriveFulfillmentStatus(i) === 'complete'
    ).length;
    return { total: items.length, needsAction, inTransit, completed };
  }, [items]);

  const handleAction = (item: FulfillmentItem) => {
    setSelectedItem(item);
    switch (deriveFulfillmentStatus(item)) {
      case 'awaiting_receipt':
        setActiveDialog('receive');
        break;
      case 'received':
      case 'packing':
        setActiveDialog('packing');
        break;
      case 'ready_for_dispatch':
        setActiveDialog('dispatch');
        break;
      case 'dispatched':
        setActiveDialog('delivery');
        break;
      case 'delivered':
      case 'installed':
        setActiveDialog('installation');
        break;
    }
  };

  const handleStageDrop = async (itemId: string, target: FulfillmentStatus) => {
    const item = items.find((i) => i.id === itemId);
    if (!item || !userId) return;
    if (movingItemIds.has(itemId)) return;

    setMovingItemIds((prev) => {
      const next = new Set(prev);
      next.add(itemId);
      return next;
    });

    try {
      await moveToFulfillmentStage(item.id, target, userId, item.projectId);
    } catch (err) {
      console.error('Stage move failed:', err);
    } finally {
      setMovingItemIds((prev) => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const closeDialog = () => {
    setActiveDialog(null);
    setSelectedItem(null);
  };

  const userId = user?.email || '';

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Fulfillment</h1>
        <p className="text-muted-foreground">Post-production pipeline — packing, dispatch, delivery & installation</p>
      </div>

      {/* Stats */}
      <KPIGrid cols={4}>
        <KPICard label="Total Items" value={stats.total} />
        <KPICard label="Needs Action" value={stats.needsAction} />
        <KPICard label="In Transit" value={stats.inTransit} />
        <KPICard label="Completed" value={stats.completed} trend="up" />
      </KPIGrid>

      {/* Kanban Board */}
      {items.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-600">No items in fulfillment</h3>
          <p className="text-sm text-gray-400 mt-1">
            Items enter fulfillment when manufacturing orders are closed out
          </p>
        </div>
      ) : (
        <FulfillmentBoard
          byStatus={byStatus}
          onAction={handleAction}
          onStageDrop={handleStageDrop}
          movingItemIds={movingItemIds}
          onNavigateToProject={(pid) => navigate(`/fulfillment/project/${pid}`)}
          onNavigateToDesignProject={(pid) => navigate(`/design/project/${pid}`)}
          onNavigateToMO={(moId) => navigate(`/manufacturing/orders/${moId}`)}
          onOpenDetail={(itemId) => navigate(`/fulfillment/item/${encodeURIComponent(itemId)}`)}
        />
      )}

      {/* Dialogs */}
      {selectedItem && (
        <>
          <ReceiveDialog
            open={activeDialog === 'receive'}
            onClose={closeDialog}
            item={selectedItem}
            userId={userId}
            onSuccess={closeDialog}
          />
          <PackingDialog
            open={activeDialog === 'packing'}
            onClose={closeDialog}
            item={selectedItem}
            userId={userId}
            onSuccess={closeDialog}
          />
          <DispatchDialog
            open={activeDialog === 'dispatch'}
            onClose={closeDialog}
            item={selectedItem}
            userId={userId}
            onSuccess={closeDialog}
          />
          <DeliveryDialog
            open={activeDialog === 'delivery'}
            onClose={closeDialog}
            item={selectedItem}
            userId={userId}
            onSuccess={closeDialog}
          />
          <InstallationDialog
            open={activeDialog === 'installation'}
            onClose={closeDialog}
            item={selectedItem}
            userId={userId}
            onSuccess={closeDialog}
          />
        </>
      )}
    </div>
  );
}
