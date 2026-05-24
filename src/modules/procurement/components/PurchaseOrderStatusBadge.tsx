import type { PurchaseOrderStatus } from '../types/purchase-order.types';

const STATUS_STYLES: Record<PurchaseOrderStatus, string> = {
  OPEN:   'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]',
  POSTED: 'bg-[var(--rag-green-soft)] text-[var(--rag-green)]',
  CLOSED: 'bg-[var(--bg-sunken)] text-muted-foreground',
  VOID:   'bg-[var(--rag-red-soft)] text-[var(--rag-red)]',
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
