/**
 * KPI Library Filters
 * Filter controls for the KPI library browsing page.
 */

import { Search, X, Filter } from 'lucide-react';
import { KPI_LIBRARY_CATEGORIES } from '../../constants/kpiLibrary.constants';

interface KPILibraryFiltersProps {
  searchQuery: string;
  onSearchChange: (q: string) => void;
  selectedCategory: string;
  onCategoryChange: (c: string) => void;
  selectedSubCategory: string;
  onSubCategoryChange: (sc: string) => void;
  selectedModule: string;
  onModuleChange: (m: string) => void;
  showTrackedOnly: boolean;
  onTrackedOnlyChange: (v: boolean) => void;
  onClearFilters: () => void;
  filteredCount: number;
  totalCount: number;
}

const MODULE_OPTIONS = [
  { value: '', label: 'All Modules' },
  { value: 'finance', label: 'Finance' },
  { value: 'hr', label: 'HR' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'sales', label: 'Sales' },
];

export function KPILibraryFilters({
  searchQuery,
  onSearchChange,
  selectedCategory,
  onCategoryChange,
  selectedSubCategory,
  onSubCategoryChange,
  selectedModule,
  onModuleChange,
  showTrackedOnly,
  onTrackedOnlyChange,
  onClearFilters,
  filteredCount,
  totalCount,
}: KPILibraryFiltersProps) {
  const activeCategory = KPI_LIBRARY_CATEGORIES.find((c) => c.id === selectedCategory);
  const hasFilters = searchQuery || selectedCategory || selectedSubCategory || selectedModule || showTrackedOnly;

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Search KPIs by name, formula, or tag..."
          className="w-full pl-10 pr-10 py-2.5 bg-white border border-gray-200 rounded-lg text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {searchQuery && (
          <button
            onClick={() => onSearchChange('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Filter row */}
      <div className="flex flex-wrap items-center gap-2">
        <Filter className="w-4 h-4 text-gray-400" />

        {/* Category */}
        <select
          value={selectedCategory}
          onChange={(e) => {
            onCategoryChange(e.target.value);
            onSubCategoryChange('');
          }}
          className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All Categories</option>
          {KPI_LIBRARY_CATEGORIES.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.label}
            </option>
          ))}
        </select>

        {/* Sub-category (only if category selected) */}
        {activeCategory && activeCategory.subCategories.length > 0 && (
          <select
            value={selectedSubCategory}
            onChange={(e) => onSubCategoryChange(e.target.value)}
            className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Sub-Categories</option>
            {activeCategory.subCategories.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.label}
              </option>
            ))}
          </select>
        )}

        {/* Module */}
        <select
          value={selectedModule}
          onChange={(e) => onModuleChange(e.target.value)}
          className="text-sm border border-gray-200 rounded-md px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {MODULE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {/* Tracked only toggle */}
        <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={showTrackedOnly}
            onChange={(e) => onTrackedOnlyChange(e.target.checked)}
            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
          />
          Tracked only
        </label>

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={onClearFilters}
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
          >
            Clear all
          </button>
        )}

        {/* Result count */}
        <span className="ml-auto text-xs text-gray-400">
          {filteredCount} of {totalCount} KPIs
        </span>
      </div>
    </div>
  );
}
