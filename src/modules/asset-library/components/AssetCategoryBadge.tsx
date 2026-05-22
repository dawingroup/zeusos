import type { AssetCategory } from '../types/asset-item.types';

const CATEGORY_STYLES: Record<AssetCategory, string> = {
  LOGO:          'bg-purple-100 text-purple-700',
  GUIDELINE:     'bg-indigo-100 text-indigo-700',
  PHOTO:         'bg-amber-100 text-amber-700',
  VIDEO:         'bg-rose-100 text-rose-700',
  FONT:          'bg-blue-100 text-blue-700',
  COLOR_PALETTE: 'bg-pink-100 text-pink-700',
  TEMPLATE:      'bg-emerald-100 text-emerald-700',
  OTHER:         'bg-gray-100 text-gray-700',
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
