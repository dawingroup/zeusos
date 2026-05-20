import { CardShell, StatusPill } from './cardShell';
import type { SearchCardProps } from './types';

export function InventoryItemCard({ hit, selected, onSelect }: SearchCardProps) {
  const { record } = hit;
  const data = record.data as {
    sku?: string;
    category?: string;
    classification?: string;
    isFamily?: boolean;
    purchaseUom?: string;
    stockUom?: string;
  };
  return (
    <CardShell
      selected={selected}
      onSelect={onSelect}
      iconName={record.icon}
      accessory={data.isFamily ? <StatusPill tone="info">family</StatusPill> : null}
    >
      <div className="font-medium truncate">{record.title}</div>
      <div className="text-xs text-muted-foreground truncate flex items-center gap-2">
        {data.sku && <span className="font-mono">{data.sku}</span>}
        {data.category && <span>· {data.category}</span>}
        {data.classification && <span className="capitalize">· {data.classification}</span>}
      </div>
    </CardShell>
  );
}
