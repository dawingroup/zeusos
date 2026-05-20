import { CardShell, StatusPill } from './cardShell';
import type { SearchCardProps } from './types';

const PO_STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  draft: 'neutral',
  pending: 'warning',
  approved: 'info',
  sent: 'info',
  received: 'success',
  closed: 'success',
  cancelled: 'danger',
};

function formatCurrency(amount: number, currency: string = 'UGX'): string {
  try {
    return new Intl.NumberFormat('en-UG', { style: 'currency', currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export function PurchaseOrderCard({ hit, selected, onSelect }: SearchCardProps) {
  const { record } = hit;
  const data = record.data as {
    supplierName?: string;
    reference?: string;
    status?: string;
    totalAmount?: number;
    grandTotal?: number;
    currency?: string;
  };
  const status = data.status?.toLowerCase();
  const total = typeof data.grandTotal === 'number' ? data.grandTotal
              : typeof data.totalAmount === 'number' ? data.totalAmount
              : undefined;
  return (
    <CardShell
      selected={selected}
      onSelect={onSelect}
      iconName={record.icon}
      accessory={status ? <StatusPill tone={PO_STATUS_TONE[status] ?? 'neutral'}>{status}</StatusPill> : null}
    >
      <div className="font-medium truncate flex items-center gap-2">
        <span className="font-mono text-xs">{record.title}</span>
        {data.supplierName && <span className="text-muted-foreground truncate">· {data.supplierName}</span>}
      </div>
      <div className="text-xs text-muted-foreground truncate flex items-center gap-2">
        {data.reference && <span>{data.reference}</span>}
        {total !== undefined && <span className="font-medium">· {formatCurrency(total, data.currency)}</span>}
      </div>
    </CardShell>
  );
}
