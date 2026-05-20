import { CardShell, StatusPill } from './cardShell';
import type { SearchCardProps } from './types';

const SO_STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  draft: 'neutral',
  sent_to_client: 'info',
  client_accepted: 'info',
  awaiting_deposit: 'warning',
  in_production: 'info',
  ready_for_dispatch: 'info',
  delivered: 'success',
  closed: 'success',
  cancelled: 'danger',
  on_hold: 'warning',
};

function formatCurrency(amount: number, currency: string = 'UGX'): string {
  try {
    return new Intl.NumberFormat('en-UG', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString()}`;
  }
}

export function SalesOrderCard({ hit, selected, onSelect }: SearchCardProps) {
  const { record } = hit;
  const data = record.data as {
    customerName?: string;
    title?: string;
    status?: string;
    grandTotal?: number;
    totalAmount?: number;
    currency?: string;
    expectedDeliveryDate?: { seconds?: number } | string | number | Date;
  };
  const status = data.status?.toLowerCase();
  const total = typeof data.grandTotal === 'number'
    ? data.grandTotal
    : typeof data.totalAmount === 'number'
    ? data.totalAmount
    : undefined;
  return (
    <CardShell
      selected={selected}
      onSelect={onSelect}
      iconName={record.icon}
      accessory={status ? <StatusPill tone={SO_STATUS_TONE[status] ?? 'neutral'}>{status.replace(/_/g, ' ')}</StatusPill> : null}
    >
      <div className="font-medium truncate flex items-center gap-2">
        <span className="font-mono text-xs">{record.title}</span>
        {data.customerName && <span className="text-muted-foreground truncate">· {data.customerName}</span>}
      </div>
      <div className="text-xs text-muted-foreground truncate flex items-center gap-2">
        {data.title && <span className="truncate">{data.title}</span>}
        {total !== undefined && <span className="font-medium">· {formatCurrency(total, data.currency)}</span>}
      </div>
    </CardShell>
  );
}
