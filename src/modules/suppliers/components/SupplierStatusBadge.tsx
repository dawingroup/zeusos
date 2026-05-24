import type { SupplierStatus } from '../types/supplier.types';

const STATUS_STYLES: Record<SupplierStatus, string> = {
  ACTIVE:      'bg-[var(--rag-green-soft)] text-[var(--rag-green)]',
  INACTIVE:    'bg-[var(--bg-sunken)] text-muted-foreground',
  BLACKLISTED: 'bg-[var(--rag-red-soft)] text-[var(--rag-red)]',
};

const STATUS_LABEL: Record<SupplierStatus, string> = {
  ACTIVE:      'Active',
  INACTIVE:    'Inactive',
  BLACKLISTED: 'Blacklisted',
};

export function SupplierStatusBadge({ status }: { status: SupplierStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
