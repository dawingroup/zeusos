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
      <div className="rounded-md border border-dashed border-zeusNavy-100 bg-zeusNavy-50/30 p-8 text-center text-sm text-zeusNavy/70">
        {emptyMessage ?? 'No assets found.'}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {items.map((item) => (
        <AssetCard key={item.id} item={item} />
      ))}
    </div>
  );
}
