import type { AssetCategory } from '../types/asset-item.types';

/**
 * All badges use the Zeus navy + red palette. Hue differentiation is
 * dropped in favour of a single consistent surface — categories are
 * already obvious from the asset name and the (separate) file-type
 * facet, and the dawins-era pastel grid was visually noisy. A few
 * categories keep a red accent to highlight client-facing identity
 * assets (logos, brand guidelines, palettes).
 */
const CATEGORY_STYLES: Record<AssetCategory, string> = {
  LOGO:          'bg-zeusRed-50 text-zeusRed-dark ring-1 ring-zeusRed-light/40',
  GUIDELINE:     'bg-zeusRed-50 text-zeusRed-dark ring-1 ring-zeusRed-light/40',
  COLOR_PALETTE: 'bg-zeusRed-50 text-zeusRed-dark ring-1 ring-zeusRed-light/40',
  PHOTO:         'bg-zeusNavy-50 text-zeusNavy ring-1 ring-zeusNavy-100',
  VIDEO:         'bg-zeusNavy-50 text-zeusNavy ring-1 ring-zeusNavy-100',
  FONT:          'bg-zeusNavy-50 text-zeusNavy ring-1 ring-zeusNavy-100',
  TEMPLATE:      'bg-zeusNavy-50 text-zeusNavy ring-1 ring-zeusNavy-100',
  OTHER:         'bg-muted text-muted-foreground ring-1 ring-border',
};

const CATEGORY_LABEL: Record<AssetCategory, string> = {
  LOGO:          'Logo',
  GUIDELINE:     'Guideline',
  PHOTO:         'Photo',
  VIDEO:         'Video',
  FONT:          'Font',
  COLOR_PALETTE: 'Palette',
  TEMPLATE:      'Template',
  OTHER:         'Other',
};

interface Props {
  category: AssetCategory;
}

export function AssetCategoryBadge({ category }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${CATEGORY_STYLES[category]}`}
    >
      {CATEGORY_LABEL[category]}
    </span>
  );
}
