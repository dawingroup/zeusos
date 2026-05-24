import type { SupplierKind } from '../types/supplier.types';

const KIND_STYLES: Record<SupplierKind, string> = {
  MEDIA_HOUSE:     'bg-sky-100 text-sky-800',
  TALENT_AGENCY:   'bg-violet-100 text-violet-800',
  PRODUCTION_HOUSE:'bg-amber-100 text-amber-800',
  PRINT_SHOP:      'bg-emerald-100 text-emerald-800',
  TECH_VENDOR:     'bg-indigo-100 text-indigo-800',
  VENDOR_OTHER:    'bg-[var(--bg-sunken)] text-muted-foreground',
};

const KIND_LABEL: Record<SupplierKind, string> = {
  MEDIA_HOUSE:     'Media House',
  TALENT_AGENCY:   'Talent Agency',
  PRODUCTION_HOUSE:'Production',
  PRINT_SHOP:      'Print',
  TECH_VENDOR:     'Tech',
  VENDOR_OTHER:    'Other',
};

export function SupplierKindBadge({ kind }: { kind: SupplierKind }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${KIND_STYLES[kind]}`}
    >
      {KIND_LABEL[kind]}
    </span>
  );
}
