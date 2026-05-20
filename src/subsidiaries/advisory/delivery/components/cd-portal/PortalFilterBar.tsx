/**
 * PortalFilterBar - Search and filter controls for CD Portal
 *
 * Provides search, status filter, and variance filter capabilities
 * for the Country Director Portal requisition list.
 */

import { useState, useCallback } from 'react';
import { Search, Filter, X, ChevronDown, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { AccountabilityStatus } from '../../types/requisition';
import { VarianceStatus } from '../../types/accountability';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface PortalFilters {
  searchQuery: string;
  status: AccountabilityStatus | 'all';
  variance: VarianceStatus | 'all';
}

export type SortField = 'date' | 'amount' | 'status' | 'variance';
export type SortDirection = 'asc' | 'desc';

export interface PortalSort {
  field: SortField;
  direction: SortDirection;
}

export interface PortalFilterBarProps {
  filters: PortalFilters;
  onChange: (filters: PortalFilters) => void;
  sort: PortalSort;
  onSortChange: (sort: PortalSort) => void;
  totalCount: number;
  filteredCount: number;
}

// ─────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: AccountabilityStatus | 'all'; label: string; color: string }[] = [
  { value: 'all', label: 'All Statuses', color: 'text-gray-600' },
  { value: 'pending', label: 'Pending', color: 'text-amber-600' },
  { value: 'partial', label: 'Partial', color: 'text-blue-600' },
  { value: 'complete', label: 'Complete', color: 'text-green-600' },
  { value: 'overdue', label: 'Overdue', color: 'text-red-600' },
];

const VARIANCE_OPTIONS: { value: VarianceStatus | 'all'; label: string; color: string }[] = [
  { value: 'all', label: 'All Variances', color: 'text-gray-600' },
  { value: 'compliant', label: 'Compliant', color: 'text-green-600' },
  { value: 'minor', label: 'Minor', color: 'text-blue-600' },
  { value: 'moderate', label: 'Moderate', color: 'text-amber-600' },
  { value: 'severe', label: 'Severe', color: 'text-red-600' },
];

const SORT_OPTIONS: { value: SortField; label: string }[] = [
  { value: 'date', label: 'Date' },
  { value: 'amount', label: 'Amount' },
  { value: 'status', label: 'Status' },
  { value: 'variance', label: 'Variance' },
];

// ─────────────────────────────────────────────────────────────────
// COMPONENT
// ─────────────────────────────────────────────────────────────────

export function PortalFilterBar({
  filters,
  onChange,
  sort,
  onSortChange,
  totalCount,
  filteredCount,
}: PortalFilterBarProps) {
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [varianceDropdownOpen, setVarianceDropdownOpen] = useState(false);
  const [sortDropdownOpen, setSortDropdownOpen] = useState(false);

  const handleSearchChange = useCallback(
    (value: string) => {
      onChange({ ...filters, searchQuery: value });
    },
    [filters, onChange]
  );

  const handleStatusChange = useCallback(
    (value: AccountabilityStatus | 'all') => {
      onChange({ ...filters, status: value });
      setStatusDropdownOpen(false);
    },
    [filters, onChange]
  );

  const handleVarianceChange = useCallback(
    (value: VarianceStatus | 'all') => {
      onChange({ ...filters, variance: value });
      setVarianceDropdownOpen(false);
    },
    [filters, onChange]
  );

  const handleSortChange = useCallback(
    (field: SortField) => {
      if (sort.field === field) {
        // Toggle direction if same field
        onSortChange({ field, direction: sort.direction === 'asc' ? 'desc' : 'asc' });
      } else {
        // Default to descending for new field
        onSortChange({ field, direction: 'desc' });
      }
      setSortDropdownOpen(false);
    },
    [sort, onSortChange]
  );

  const toggleSortDirection = useCallback(() => {
    onSortChange({ ...sort, direction: sort.direction === 'asc' ? 'desc' : 'asc' });
  }, [sort, onSortChange]);

  const clearAllFilters = useCallback(() => {
    onChange({
      searchQuery: '',
      status: 'all',
      variance: 'all',
    });
  }, [onChange]);

  const hasActiveFilters =
    filters.searchQuery !== '' ||
    filters.status !== 'all' ||
    filters.variance !== 'all';

  const selectedStatus = STATUS_OPTIONS.find((o) => o.value === filters.status);
  const selectedVariance = VARIANCE_OPTIONS.find((o) => o.value === filters.variance);
  const selectedSort = SORT_OPTIONS.find((o) => o.value === sort.field);

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm space-y-4">
      {/* Search and Filters Row */}
      <div className="flex flex-col md:flex-row gap-3">
        {/* Search Input */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={filters.searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="Search by ref number, description, project, or vendor..."
            className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {filters.searchQuery && (
            <button
              onClick={() => handleSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Status Filter Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setStatusDropdownOpen(!statusDropdownOpen);
              setVarianceDropdownOpen(false);
              setSortDropdownOpen(false);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium transition-colors ${
              filters.status !== 'all'
                ? 'border-blue-300 bg-blue-50 text-blue-700'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span className={selectedStatus?.color}>{selectedStatus?.label}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${statusDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {statusDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
              {STATUS_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleStatusChange(option.value)}
                  className={`w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                    filters.status === option.value ? 'bg-blue-50' : ''
                  }`}
                >
                  <span className={option.color}>{option.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Variance Filter Dropdown */}
        <div className="relative">
          <button
            onClick={() => {
              setVarianceDropdownOpen(!varianceDropdownOpen);
              setStatusDropdownOpen(false);
              setSortDropdownOpen(false);
            }}
            className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg text-sm font-medium transition-colors ${
              filters.variance !== 'all'
                ? 'border-purple-300 bg-purple-50 text-purple-700'
                : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            <span className={selectedVariance?.color}>{selectedVariance?.label}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${varianceDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {varianceDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
              {VARIANCE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleVarianceChange(option.value)}
                  className={`w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                    filters.variance === option.value ? 'bg-purple-50' : ''
                  }`}
                >
                  <span className={option.color}>{option.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Sort Dropdown */}
        <div className="relative flex items-center gap-1">
          <button
            onClick={() => {
              setSortDropdownOpen(!sortDropdownOpen);
              setStatusDropdownOpen(false);
              setVarianceDropdownOpen(false);
            }}
            className="flex items-center gap-2 px-4 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <ArrowUpDown className="w-4 h-4" />
            <span>Sort: {selectedSort?.label}</span>
            <ChevronDown className={`w-4 h-4 transition-transform ${sortDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Direction toggle button */}
          <button
            onClick={toggleSortDirection}
            className="p-2.5 border border-gray-200 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            title={sort.direction === 'asc' ? 'Ascending' : 'Descending'}
          >
            {sort.direction === 'asc' ? (
              <ArrowUp className="w-4 h-4" />
            ) : (
              <ArrowDown className="w-4 h-4" />
            )}
          </button>

          {sortDropdownOpen && (
            <div className="absolute top-full left-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
              {SORT_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => handleSortChange(option.value)}
                  className={`w-full px-4 py-2.5 text-left text-sm hover:bg-gray-50 first:rounded-t-lg last:rounded-b-lg ${
                    sort.field === option.value ? 'bg-gray-100 font-medium' : ''
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Active Filters & Results Count */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Active Filter Chips */}
          {filters.status !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
              Status: {selectedStatus?.label}
              <button
                onClick={() => handleStatusChange('all')}
                className="hover:text-blue-900"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.variance !== 'all' && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-purple-100 text-purple-700 rounded-full text-xs font-medium">
              Variance: {selectedVariance?.label}
              <button
                onClick={() => handleVarianceChange('all')}
                className="hover:text-purple-900"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {filters.searchQuery && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-gray-100 text-gray-700 rounded-full text-xs font-medium">
              Search: "{filters.searchQuery.slice(0, 20)}{filters.searchQuery.length > 20 ? '...' : ''}"
              <button
                onClick={() => handleSearchChange('')}
                className="hover:text-gray-900"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          )}
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-xs text-gray-500 hover:text-gray-700 underline"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Results Count */}
        <div className="text-sm text-gray-500">
          {filteredCount === totalCount ? (
            <span>{totalCount} requisitions</span>
          ) : (
            <span>
              Showing <span className="font-medium text-gray-700">{filteredCount}</span> of{' '}
              {totalCount} requisitions
            </span>
          )}
        </div>
      </div>

      {/* Click outside to close dropdowns */}
      {(statusDropdownOpen || varianceDropdownOpen || sortDropdownOpen) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setStatusDropdownOpen(false);
            setVarianceDropdownOpen(false);
            setSortDropdownOpen(false);
          }}
        />
      )}
    </div>
  );
}

export default PortalFilterBar;
