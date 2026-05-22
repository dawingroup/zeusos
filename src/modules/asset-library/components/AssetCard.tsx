/**
 * AssetCard — compact grid card for a single asset.
 *
 * Renders a thumbnail (if `thumbnailRef` is set), name, category badge,
 * and up to three tag chips. Clicking navigates to the detail page.
 */

import { Link } from 'react-router-dom';
import type { AssetItem } from '../types/asset-item.types';
import { AssetCategoryBadge } from './AssetCategoryBadge';

interface Props {
  item: AssetItem;
}

const STATUS_DOT: Record<string, string> = {
  DRAFT:    'bg-yellow-400',
  ACTIVE:   'bg-green-500',
  ARCHIVED: 'bg-gray-400',
};

export function AssetCard({ item }: Props) {
  return (
    <Link
      to={`/assets/${item.id}`}
      className="group flex flex-col rounded border bg-background hover:shadow-md transition-shadow overflow-hidden"
    >
      <div className="aspect-square bg-muted/40 flex items-center justify-center text-muted-foreground text-xs">
        {item.thumbnailRef ? (
          <img
            src={item.thumbnailRef}
            alt={item.name}
            className="object-contain max-h-full max-w-full"
          />
        ) : (
          <span className="opacity-60">No preview</span>
        )}
      </div>
      <div className="flex-1 p-3 space-y-1.5">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 flex-shrink-0 rounded-full ${STATUS_DOT[item.status] ?? 'bg-gray-300'}`}
            title={item.status}
          />
          <p className="truncate font-medium text-sm flex-1">{item.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <AssetCategoryBadge category={item.category} />
          {item.dimensions && (
            <span className="text-xs text-muted-foreground">{item.dimensions}</span>
          )}
        </div>
        {item.tags.length > 0 && (
          <p className="truncate text-xs text-muted-foreground">
            {item.tags.slice(0, 3).map((t) => `#${t}`).join(' ')}
            {item.tags.length > 3 ? ` +${item.tags.length - 3}` : ''}
          </p>
        )}
      </div>
    </Link>
  );
}
