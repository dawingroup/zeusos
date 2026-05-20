/**
 * SearchFilterBar Component
 * Unified search and filter bar following Finishes Design Manager pattern
 */

import { Search, Filter } from 'lucide-react';
import { cn } from '@/shared/lib/utils';

interface SearchFilterBarProps {
  searchValue: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder?: string;
  filterComponent?: React.ReactNode;
  viewModeComponent?: React.ReactNode;
  actionButtons?: React.ReactNode;
  resultsCount?: number;
  resultsLabel?: string;
  showFilterButton?: boolean;
  onFilterClick?: () => void;
  className?: string;
}

export function SearchFilterBar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Search...',
  filterComponent,
  viewModeComponent,
  actionButtons,
  resultsCount,
  resultsLabel = 'results',
  showFilterButton = true,
  onFilterClick,
  className,
}: SearchFilterBarProps) {
  return (
    <div className={cn("bg-white rounded-lg shadow-sm border border-gray-200 p-4", className)}>
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        {/* Search and Filter Section */}
        <div className="flex-1 w-full sm:w-auto flex flex-wrap gap-2 items-center">
          {/* Search Input */}
          <div className="relative flex-1 sm:max-w-md min-w-[200px]">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder={searchPlaceholder}
              value={searchValue}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Filter Button */}
          {showFilterButton && (
            <button
              onClick={onFilterClick}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              <Filter className="h-4 w-4" />
              Filter
            </button>
          )}

          {/* Custom Filter Component */}
          {filterComponent}

          {/* Results Count */}
          {resultsCount !== undefined && (
            <span className="text-sm text-gray-500 hidden sm:inline">
              {resultsCount} {resultsLabel}
            </span>
          )}
        </div>

        {/* Right Side - View Mode and Actions */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          {viewModeComponent}
          {actionButtons}
        </div>
      </div>
    </div>
  );
}
