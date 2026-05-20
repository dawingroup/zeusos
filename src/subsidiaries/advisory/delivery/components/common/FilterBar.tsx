/**
 * Filter Bar - Search and filter controls
 */

import { Search, X, SlidersHorizontal } from 'lucide-react';
import { ProjectStatus } from '../../types/project';

interface FilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter: ProjectStatus | 'all';
  onStatusChange: (status: ProjectStatus | 'all') => void;
  regionFilter?: string | 'all';
  onRegionChange?: (region: string | 'all') => void;
  regions?: string[];
  showAdvanced?: boolean;
  onToggleAdvanced?: () => void;
}

const STATUS_OPTIONS: { value: ProjectStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Statuses' },
  { value: 'planning', label: 'Planning' },
  { value: 'procurement', label: 'Procurement' },
  { value: 'mobilization', label: 'Mobilization' },
  { value: 'active', label: 'Active' },
  { value: 'substantial_completion', label: 'Substantial Completion' },
  { value: 'defects_liability', label: 'Defects Liability' },
  { value: 'completed', label: 'Completed' },
  { value: 'suspended', label: 'Suspended' },
];

export function FilterBar({
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusChange,
  regionFilter,
  onRegionChange,
  regions = [],
  showAdvanced,
  onToggleAdvanced,
}: FilterBarProps) {
  const hasFilters = searchQuery || statusFilter !== 'all' || (regionFilter && regionFilter !== 'all');

  return (
    <div className="bg-white rounded-lg border p-4">
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
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

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => onStatusChange(e.target.value as ProjectStatus | 'all')}
          className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
        >
          {STATUS_OPTIONS.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {/* Region Filter */}
        {regions.length > 0 && onRegionChange && (
          <select
            value={regionFilter || 'all'}
            onChange={(e) => onRegionChange(e.target.value)}
            className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="all">All Regions</option>
            {regions.map(region => (
              <option key={region} value={region}>
                {region}
              </option>
            ))}
          </select>
        )}

        {/* Advanced Toggle */}
        {onToggleAdvanced && (
          <button
            onClick={onToggleAdvanced}
            className={`px-3 py-2 border rounded-lg flex items-center gap-2 ${
              showAdvanced ? 'bg-gray-100' : ''
            }`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span className="hidden md:inline">Filters</span>
          </button>
        )}
      </div>

      {/* Clear Filters */}
      {hasFilters && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm text-gray-500">Active filters:</span>
          {searchQuery && (
            <FilterChip
              label={`Search: ${searchQuery}`}
              onRemove={() => onSearchChange('')}
            />
          )}
          {statusFilter !== 'all' && (
            <FilterChip
              label={STATUS_OPTIONS.find(s => s.value === statusFilter)?.label || statusFilter}
              onRemove={() => onStatusChange('all')}
            />
          )}
          {regionFilter && regionFilter !== 'all' && onRegionChange && (
            <FilterChip
              label={regionFilter}
              onRemove={() => onRegionChange('all')}
            />
          )}
        </div>
      )}
    </div>
  );
}

interface FilterChipProps {
  label: string;
  onRemove: () => void;
}

function FilterChip({ label, onRemove }: FilterChipProps) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm">
      {label}
      <button onClick={onRemove} className="hover:text-gray-900">
        <X className="w-3 h-3" />
      </button>
    </span>
  );
}
