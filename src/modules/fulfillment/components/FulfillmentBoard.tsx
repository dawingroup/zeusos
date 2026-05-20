/**
 * FulfillmentBoard
 * Kanban board showing items grouped by fulfillment status.
 * Migrated to the shared <KanbanColumn> primitive.
 */

import { Package, Truck, MapPin, Wrench, CheckCircle2, PackageCheck } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { FulfillmentItemCard } from './FulfillmentItemCard';
import { KanbanColumn } from '@/shared/components/data-display';
import type { FulfillmentItem } from '../services/fulfillmentQueryService';
import type { FulfillmentStatus } from '@/modules/design-manager/types';

interface FulfillmentBoardProps {
  byStatus: Record<string, FulfillmentItem[]>;
  onAction: (item: FulfillmentItem) => void;
  onStageDrop?: (itemId: string, target: FulfillmentStatus) => Promise<void> | void;
  movingItemIds?: Set<string>;
  onNavigateToProject: (projectId: string) => void;
  onNavigateToDesignProject: (projectId: string) => void;
  onNavigateToMO: (moId: string) => void;
  onOpenDetail: (itemId: string) => void;
}

interface ColumnDef {
  status: FulfillmentStatus;
  label: string;
  icon: typeof Package;
  stripeColor: string;
  terminal?: boolean;
}

const COLUMNS: ColumnDef[] = [
  { status: 'awaiting_receipt', label: 'Awaiting Receipt', icon: PackageCheck, stripeColor: 'var(--border-strong)' },
  { status: 'received', label: 'Received', icon: PackageCheck, stripeColor: 'var(--rag-blue)' },
  { status: 'packing', label: 'Packing', icon: Package, stripeColor: 'var(--rag-amber)' },
  { status: 'ready_for_dispatch', label: 'Ready', icon: Package, stripeColor: 'var(--boysenberry)' },
  { status: 'dispatched', label: 'Dispatched', icon: Truck, stripeColor: 'var(--golden-bell)' },
  { status: 'delivered', label: 'Delivered', icon: MapPin, stripeColor: 'var(--seafoam)' },
  { status: 'installed', label: 'Installed', icon: Wrench, stripeColor: 'var(--rag-blue)' },
  { status: 'complete', label: 'Complete', icon: CheckCircle2, stripeColor: 'var(--rag-green)', terminal: true },
];

export function FulfillmentBoard({
  byStatus,
  onAction,
  onStageDrop,
  movingItemIds,
  onNavigateToProject,
  onNavigateToDesignProject,
  onNavigateToMO,
  onOpenDetail,
}: FulfillmentBoardProps) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-4" style={{ minHeight: 400 }}>
      {COLUMNS.map((col) => {
        const items = byStatus[col.status] || [];

        const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
          e.preventDefault();
          e.currentTarget.style.backgroundColor = 'var(--bg-sunken)';
        };
        const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
          e.currentTarget.style.backgroundColor = 'transparent';
        };
        const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
          e.preventDefault();
          e.currentTarget.style.backgroundColor = 'transparent';
          const itemId = e.dataTransfer.getData('fulfillmentItemId');
          if (itemId && onStageDrop && !movingItemIds?.has(itemId)) {
            onStageDrop(itemId, col.status);
          }
        };

        return (
          <KanbanColumn
            key={col.status}
            label={
              <span className="inline-flex items-center gap-1.5">
                <col.icon
                  className="h-3.5 w-3.5"
                  style={{ color: col.stripeColor }}
                />
                {col.label}
              </span>
            }
            count={items.length}
            stripeColor={col.stripeColor}
            terminal={col.terminal}
            emptyLabel="No items"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="rounded-md transition-colors px-1 py-1"
          >
            {items.map((item) => {
              const isMoving = movingItemIds?.has(item.id) ?? false;
              return (
                <div
                  key={item.id}
                  draggable={!isMoving}
                  onDragStart={(e) => {
                    if (isMoving) return;
                    e.dataTransfer.setData('fulfillmentItemId', item.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  className={cn(
                    'active:cursor-grabbing',
                    isMoving ? 'cursor-wait opacity-70' : 'cursor-grab',
                  )}
                >
                  <FulfillmentItemCard
                    item={item}
                    onAction={onAction}
                    onMoveToStage={onStageDrop}
                    isMoving={isMoving}
                    onNavigateToProject={onNavigateToProject}
                    onNavigateToDesignProject={onNavigateToDesignProject}
                    onNavigateToMO={onNavigateToMO}
                    onOpenDetail={onOpenDetail}
                  />
                </div>
              );
            })}
          </KanbanColumn>
        );
      })}
    </div>
  );
}
