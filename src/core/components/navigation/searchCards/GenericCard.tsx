import { Badge } from '@/core/components/ui/badge';
import { CardShell } from './cardShell';
import type { SearchCardProps } from './types';

/** Default card — renders title, optional subtitle, and the entity type label. */
export function GenericCard({ hit, selected, onSelect }: SearchCardProps) {
  const { record } = hit;
  return (
    <CardShell
      selected={selected}
      onSelect={onSelect}
      iconName={record.icon}
      accessory={
        <Badge variant="outline" className="text-[10px] capitalize shrink-0">
          {record.type.replace(/_/g, ' ')}
        </Badge>
      }
    >
      <div className="font-medium truncate">{record.title}</div>
      {record.subtitle && (
        <div className="text-xs text-muted-foreground truncate">{record.subtitle}</div>
      )}
    </CardShell>
  );
}
