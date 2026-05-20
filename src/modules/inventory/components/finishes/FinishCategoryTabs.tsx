/**
 * FinishCategoryTabs Component
 * Tab navigation for filtering finishes by category.
 */

import type { FinishCategory } from '../../types';

interface FinishCategoryTabsProps {
  activeCategory: FinishCategory | 'all';
  onCategoryChange: (category: FinishCategory | 'all') => void;
  counts?: Record<string, number>;
}

const CATEGORY_TABS: { id: FinishCategory | 'all'; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'board', label: 'Boards' },
  { id: 'paint', label: 'Paints' },
  { id: 'tile', label: 'Tiles' },
  { id: 'laminate', label: 'Laminates' },
  { id: 'veneer', label: 'Veneers' },
  { id: 'fabric', label: 'Fabrics' },
  { id: 'metal', label: 'Metals' },
  { id: 'stone', label: 'Stone' },
  { id: 'glass', label: 'Glass' },
  { id: 'custom', label: 'Custom' },
];

export function FinishCategoryTabs({
  activeCategory,
  onCategoryChange,
  counts,
}: FinishCategoryTabsProps) {
  return (
    <div className="border-b border-gray-200">
      <nav className="-mb-px flex space-x-4 overflow-x-auto px-1" aria-label="Finish categories">
        {CATEGORY_TABS.map(tab => {
          const isActive = tab.id === activeCategory;
          const count = counts?.[tab.id];

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onCategoryChange(tab.id)}
              className={`
                whitespace-nowrap py-3 px-1 border-b-2 text-sm font-medium transition-colors
                ${isActive
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}
              `}
            >
              {tab.label}
              {count !== undefined && (
                <span className={`ml-1.5 py-0.5 px-2 rounded-full text-xs ${
                  isActive ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
