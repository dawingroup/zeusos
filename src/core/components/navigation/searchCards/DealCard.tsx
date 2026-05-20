import { CardShell, StatusPill } from './cardShell';
import type { SearchCardProps } from './types';

const STAGE_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  lead: 'neutral',
  qualification: 'info',
  site_visit: 'info',
  design_proposal: 'info',
  quotation: 'warning',
  negotiation: 'warning',
  won: 'success',
  lost: 'danger',
  on_hold: 'warning',
};

export function DealCard({ hit, selected, onSelect }: SearchCardProps) {
  const { record } = hit;
  const data = record.data as {
    customerName?: string;
    dealNumber?: string;
    stage?: string;
    estimatedValue?: number;
    currency?: string;
  };
  const stage = data.stage?.toLowerCase();
  return (
    <CardShell
      selected={selected}
      onSelect={onSelect}
      iconName={record.icon}
      accessory={stage ? <StatusPill tone={STAGE_TONE[stage] ?? 'neutral'}>{stage.replace(/_/g, ' ')}</StatusPill> : null}
    >
      <div className="font-medium truncate">{record.title}</div>
      <div className="text-xs text-muted-foreground truncate flex items-center gap-2">
        {data.dealNumber && <span className="font-mono">{data.dealNumber}</span>}
        {data.customerName && <span>· {data.customerName}</span>}
        {typeof data.estimatedValue === 'number' && (
          <span className="font-medium">· {data.currency ?? 'UGX'} {data.estimatedValue.toLocaleString()}</span>
        )}
      </div>
    </CardShell>
  );
}
