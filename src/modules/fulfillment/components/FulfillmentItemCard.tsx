/**
 * FulfillmentItemCard
 * Card displayed in each kanban column showing item details and action button
 */

import { Package, PackageCheck, Truck, MapPin, Wrench, CheckCircle2, Clock, ExternalLink, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/core/components/ui/button';
import type { FulfillmentItem } from '../services/fulfillmentQueryService';
import { FULFILLMENT_STATUS_LABELS, type FulfillmentStatus } from '@/modules/design-manager/types';
import { deriveFulfillmentStatus } from '@/modules/design-manager/services/designItemStatusDerivation';

interface FulfillmentItemCardProps {
  item: FulfillmentItem;
  onAction: (item: FulfillmentItem) => void;
  onMoveToStage?: (itemId: string, target: FulfillmentStatus) => Promise<void> | void;
  isMoving?: boolean;
  onNavigateToProject?: (projectId: string) => void;
  onNavigateToDesignProject?: (projectId: string) => void;
  onNavigateToMO?: (moId: string) => void;
  onOpenDetail?: (itemId: string) => void;
}

const ACTION_LABELS: Partial<Record<FulfillmentStatus, { label: string; icon: typeof Package }>> = {
  awaiting_receipt: { label: 'Receive Item', icon: PackageCheck },
  received: { label: 'Start Packing', icon: Package },
  packing: { label: 'Mark Packed', icon: Package },
  ready_for_dispatch: { label: 'Dispatch', icon: Truck },
  dispatched: { label: 'Confirm Delivery', icon: MapPin },
  delivered: { label: 'Install / Complete', icon: Wrench },
  installed: { label: 'Mark Complete', icon: CheckCircle2 },
};

const BOARD_STATUSES: FulfillmentStatus[] = [
  'awaiting_receipt',
  'received',
  'packing',
  'ready_for_dispatch',
  'dispatched',
  'delivered',
  'installed',
  'complete',
];

function timeAgo(date: any): string {
  if (!date) return '—';
  const d = date?.toDate ? date.toDate() : new Date(date);
  const diff = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return '1d ago';
  return `${diff}d ago`;
}

export function FulfillmentItemCard({
  item,
  onAction,
  onMoveToStage,
  isMoving = false,
  onNavigateToProject,
  onNavigateToDesignProject,
  onNavigateToMO,
  onOpenDetail,
}: FulfillmentItemCardProps) {
  // P7/F10: derive from tracking timestamps — the flat field can lag.
  const currentStatus = deriveFulfillmentStatus(item);
  const action = ACTION_LABELS[currentStatus];
  const isManufacturingIntake = item.source === 'manufacturing-ready';
  const [moveTarget, setMoveTarget] = useState('');

  return (
    <div
      className="rounded-[10px] border transition-shadow hover:shadow-[var(--shadow-md)]"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
        boxShadow: 'var(--shadow-sm)',
        padding: 12,
      }}
    >
      <div className="flex flex-col gap-2">
        {/* Item name + project */}
        <div>
          <button
            type="button"
            onClick={() => onOpenDetail?.(item.id)}
            className="text-[13px] font-medium leading-snug text-left transition-colors"
            style={{ color: 'var(--fg-primary)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--fg-primary)')}
          >
            {item.name}
          </button>
          <p
            className="text-[11px] mt-0.5"
            style={{ color: 'var(--fg-tertiary)' }}
          >
            {item.projectName}
          </p>
          {isManufacturingIntake && (
            <span
              className="inline-flex mt-1 text-[10px] px-1.5 py-0.5 rounded-full"
              style={{
                backgroundColor: 'var(--bg-sunken)',
                color: 'var(--fg-secondary)',
              }}
            >
              Manufacturing Intake
            </span>
          )}
        </div>

        {/* Customer + time in status */}
        <div
          className="flex items-center justify-between text-[11px]"
          style={{ color: 'var(--fg-tertiary)' }}
        >
          <span className="truncate">{item.customerName}</span>
          <span className="inline-flex items-center gap-1 shrink-0">
            <Clock className="w-3 h-3" />
            {timeAgo(item.updatedAt)}
          </span>
        </div>

        {/* Links */}
        {(onNavigateToProject ||
          onNavigateToDesignProject ||
          (item.manufacturingOrderId && onNavigateToMO)) && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {onNavigateToProject && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateToProject(item.projectId);
                }}
                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: 'var(--accent-soft)',
                  color: 'var(--accent)',
                }}
              >
                <ExternalLink className="w-2.5 h-2.5" /> Fulfillment Project
              </button>
            )}
            {onNavigateToDesignProject && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateToDesignProject(item.projectId);
                }}
                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: 'var(--boysenberry-50)',
                  color: 'var(--boysenberry)',
                }}
              >
                <ExternalLink className="w-2.5 h-2.5" /> Open in Design
              </button>
            )}
            {item.manufacturingOrderId && onNavigateToMO && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onNavigateToMO(item.manufacturingOrderId!);
                }}
                className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full"
                style={{
                  backgroundColor: 'var(--rag-blue-soft)',
                  color: 'var(--rag-blue)',
                }}
              >
                <ExternalLink className="w-2.5 h-2.5" /> {item.moNumber || 'MO'}
              </button>
            )}
          </div>
        )}

        {/* Action button */}
        {action && (
          <Button
            size="sm"
            variant="outline"
            className="w-full h-7"
            disabled={isMoving}
            onClick={() => onAction(item)}
          >
            <action.icon className="w-3 h-3" />
            {action.label}
          </Button>
        )}

        {onMoveToStage && (
          <select
            value={moveTarget}
            onChange={(e) => {
              if (isMoving) return;
              const next = e.target.value as FulfillmentStatus | '';
              setMoveTarget('');
              if (!next) return;
              onMoveToStage(item.id, next);
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full h-7 text-[11.5px] rounded-md px-2 border"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderColor: 'var(--border-default)',
              color: 'var(--fg-secondary)',
            }}
            aria-label="Move item to fulfillment stage"
            disabled={isMoving}
          >
            <option value="">{isMoving ? 'Moving…' : 'Move to stage…'}</option>
            {BOARD_STATUSES.map((status) => (
              <option key={status} value={status} disabled={status === currentStatus}>
                {FULFILLMENT_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
        )}
        {isMoving && (
          <div
            className="flex items-center gap-1 text-[10px]"
            style={{ color: 'var(--fg-tertiary)' }}
          >
            <Loader2 className="w-3 h-3 animate-spin" />
            Updating stage…
          </div>
        )}
      </div>
    </div>
  );
}
