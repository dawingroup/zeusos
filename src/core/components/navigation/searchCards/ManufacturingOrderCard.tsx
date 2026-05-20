import { CardShell, StatusPill } from './cardShell';
import type { SearchCardProps } from './types';

const MO_STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  draft: 'neutral',
  scheduled: 'info',
  in_progress: 'info',
  blocked: 'danger',
  completed: 'success',
  cancelled: 'danger',
  on_hold: 'warning',
};

export function ManufacturingOrderCard({ hit, selected, onSelect }: SearchCardProps) {
  const { record } = hit;
  const data = record.data as {
    productName?: string;
    orderNumber?: string;
    status?: string;
    quantity?: number;
    dueDate?: { seconds?: number } | string | number | Date;
  };
  const status = data.status?.toLowerCase();
  return (
    <CardShell
      selected={selected}
      onSelect={onSelect}
      iconName={record.icon}
      accessory={status ? <StatusPill tone={MO_STATUS_TONE[status] ?? 'neutral'}>{status.replace(/_/g, ' ')}</StatusPill> : null}
    >
      <div className="font-medium truncate flex items-center gap-2">
        <span className="font-mono text-xs">{record.title}</span>
        {data.productName && <span className="text-muted-foreground truncate">· {data.productName}</span>}
      </div>
      <div className="text-xs text-muted-foreground truncate flex items-center gap-2">
        {data.orderNumber && <span className="font-mono">{data.orderNumber}</span>}
        {typeof data.quantity === 'number' && <span>· qty {data.quantity}</span>}
      </div>
    </CardShell>
  );
}
