/**
 * AssetCard — compact grid card for a single asset.
 *
 * Renders the generated 200px thumbnail (from `thumbnailUrl`) when
 * present, falling back to a category-shaped placeholder for
 * non-raster types (PDF, video, fonts, archives) and pre-thumbnail
 * uploads. Clicking navigates to the detail page.
 */

import { Link } from 'react-router-dom';
import type { AssetCategory, AssetItem } from '../types/asset-item.types';
import { AssetCategoryBadge } from './AssetCategoryBadge';

interface Props {
  item: AssetItem;
}

const STATUS_DOT: Record<string, string> = {
  DRAFT:    'bg-zeusTheAgency', // brand yellow — drawing attention to drafts
  ACTIVE:   'bg-rag-green',
  ARCHIVED: 'bg-zeusNavy-100',
};

/**
 * Visual glyph + accent colour for the no-thumbnail fallback. Tracks
 * the AssetCategoryBadge palette so the grid feels cohesive even when
 * thumbnails haven't been generated yet.
 */
const CATEGORY_FALLBACK: Record<AssetCategory, { glyph: string; tone: string }> = {
  LOGO:          { glyph: '◆',  tone: 'text-zeusRed' },
  GUIDELINE:     { glyph: '§',  tone: 'text-zeusRed' },
  PHOTO:         { glyph: '▣',  tone: 'text-zeusNavy/70' },
  VIDEO:         { glyph: '▶',  tone: 'text-zeusNavy/70' },
  FONT:          { glyph: 'Aa', tone: 'text-zeusNavy/70' },
  COLOR_PALETTE: { glyph: '◐',  tone: 'text-zeusRed' },
  TEMPLATE:      { glyph: '▥',  tone: 'text-zeusNavy/70' },
  OTHER:         { glyph: '◦',  tone: 'text-muted-foreground' },
};

export function AssetCard({ item }: Props) {
  const fallback = CATEGORY_FALLBACK[item.category];
  // Prefer the cloud-function-generated thumbnail; fall back to legacy
  // `thumbnailRef` (Phase 4 scaffold field) for back-compat.
  const previewSrc = item.thumbnailUrl ?? item.thumbnailRef;

  return (
    <Link
      to={`/assets/${item.id}`}
      className="group flex flex-col overflow-hidden rounded-md border border-zeusNavy-100 bg-background transition-all hover:border-zeusRed hover:shadow-card"
    >
      <div className="aspect-square bg-zeusNavy-50/60 flex items-center justify-center overflow-hidden">
        {previewSrc ? (
          <img
            src={previewSrc}
            alt={item.name}
            loading="lazy"
            className="max-h-full max-w-full object-contain transition-transform group-hover:scale-[1.02]"
          />
        ) : (
          <span
            aria-hidden="true"
            className={`text-5xl font-light leading-none ${fallback.tone}`}
          >
            {fallback.glyph}
          </span>
        )}
      </div>
      <div className="flex-1 space-y-1.5 p-3">
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 flex-shrink-0 rounded-full ${STATUS_DOT[item.status] ?? 'bg-zeusNavy-100'}`}
            title={item.status}
          />
          <p className="flex-1 truncate text-sm font-medium text-zeusNavy">
            {item.name}
          </p>
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
