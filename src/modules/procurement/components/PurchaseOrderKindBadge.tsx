import type { PurchaseOrderKind } from '../types/purchase-order.types';

const KIND_STYLES: Record<PurchaseOrderKind, string> = {
  TALENT_FREELANCER: 'bg-violet-100 text-violet-800',
  MEDIA_SUPPLIER:    'bg-sky-100 text-sky-800',
  VENDOR_OTHER:      'bg-[var(--bg-sunken)] text-muted-foreground',
};

const KIND_LABEL: Record<PurchaseOrderKind, string> = {
  TALENT_FREELANCER: 'Talent',
  MEDIA_SUPPLIER:    'Media',
  VENDOR_OTHER:      'Vendor',
};

interface Props {
  kind: PurchaseOrderKind;
}

export function PurchaseOrderKindBadge({ kind }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${KIND_STYLES[kind]}`}
    >
      {KIND_LABEL[kind]}
    </span>
  );
}
