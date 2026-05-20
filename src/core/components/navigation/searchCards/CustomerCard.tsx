import { CardShell, StatusPill } from './cardShell';
import type { SearchCardProps } from './types';

const STATUS_TONE: Record<string, 'success' | 'warning' | 'danger' | 'info' | 'neutral'> = {
  active: 'success',
  prospect: 'info',
  inactive: 'neutral',
  archived: 'neutral',
  blocked: 'danger',
};

export function CustomerCard({ hit, selected, onSelect }: SearchCardProps) {
  const { record } = hit;
  const data = record.data as { code?: string; phone?: string; email?: string; status?: string; type?: string };
  const status = data.status?.toLowerCase();
  return (
    <CardShell
      selected={selected}
      onSelect={onSelect}
      iconName={record.icon}
      accessory={status ? <StatusPill tone={STATUS_TONE[status] ?? 'neutral'}>{status}</StatusPill> : null}
    >
      <div className="font-medium truncate">{record.title}</div>
      <div className="text-xs text-muted-foreground truncate flex items-center gap-2">
        {data.code && <span className="font-mono">{data.code}</span>}
        {data.phone && <span>· {data.phone}</span>}
        {data.email && <span className="hidden sm:inline">· {data.email}</span>}
      </div>
    </CardShell>
  );
}
