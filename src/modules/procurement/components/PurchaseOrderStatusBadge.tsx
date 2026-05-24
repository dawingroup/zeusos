import type { PurchaseOrderStatus } from '../types/purchase-order.types';

const STATUS_STYLES: Record<PurchaseOrderStatus, string> = {
  OPEN:   'bg-amber-100 text-amber-800',
  POSTED: 'bg-emerald-100 text-emerald-800',
  CLOSED: 'bg-[var(--bg-sunken)] text-muted-foreground',
  VOID:   'bg-rose-100 text-rose-700',
};

const STATUS_LABEL: Record<PurchaseOrderStatus, string> = {
  OPEN:   'Open',
  POSTED: 'Posted to GL',
  CLOSED: 'Closed',
  VOID:   'Void',
};

interface Props {
  status: PurchaseOrderStatus;
}

export function PurchaseOrderStatusBadge({ status }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
