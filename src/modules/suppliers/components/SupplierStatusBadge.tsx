import type { SupplierStatus } from '../types/supplier.types';

const STATUS_STYLES: Record<SupplierStatus, string> = {
  ACTIVE:      'bg-emerald-100 text-emerald-800',
  INACTIVE:    'bg-slate-100 text-slate-600',
  BLACKLISTED: 'bg-rose-100 text-rose-700',
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
