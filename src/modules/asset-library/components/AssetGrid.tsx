/**
 * AssetGrid — responsive grid of AssetCard components.
 */

import type { AssetItem } from '../types/asset-item.types';
import { AssetCard } from './AssetCard';

interface Props {
  items: AssetItem[];
  emptyMessage?: string;
}

export function AssetGrid({ items, emptyMessage }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
        {emptyMessage ?? 'No assets found.'}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((item) => (
        <AssetCard key={item.id} item={item} />
      ))}
    </div>
  );
}
