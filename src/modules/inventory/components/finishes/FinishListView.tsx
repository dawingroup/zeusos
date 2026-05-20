/**
 * FinishListView Component
 * Table view of finishes with search and filters.
 */

import { useState } from 'react';
import { Search, Loader2, Edit2, Archive, MoreVertical, Globe } from 'lucide-react';
import type { FinishDocument, FinishAvailability } from '../../types';
import { FINISH_AVAILABILITY_OPTIONS } from '../../types/finishLibrary';

interface FinishListViewProps {
  finishes: FinishDocument[];
  loading: boolean;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onEdit: (finish: FinishDocument) => void;
  onArchive: (finish: FinishDocument) => void;
  onOpenStorefront?: (finish: FinishDocument) => void;
  subtypeFilter?: string;
  onSubtypeFilterChange?: (subtype: string) => void;
  availabilityFilter?: FinishAvailability;
  onAvailabilityFilterChange?: (availability: FinishAvailability | undefined) => void;
}

const SYNC_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  syncing: 'bg-blue-100 text-blue-800',
  synced: 'bg-emerald-100 text-emerald-800',
  error: 'bg-rose-100 text-rose-800',
  unpublished: 'bg-gray-100 text-gray-600',
};

export function FinishListView({
  finishes,
  loading,
  searchTerm,
  onSearchChange,
  onEdit,
  onArchive,
  onOpenStorefront,
  subtypeFilter,
  onSubtypeFilterChange,
  availabilityFilter,
  onAvailabilityFilterChange,
}: FinishListViewProps) {
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  // Apply client-side filters
  let filtered = finishes;
  if (subtypeFilter) {
    filtered = filtered.filter(f => f.subtype === subtypeFilter);
  }
  if (availabilityFilter) {
    filtered = filtered.filter(f => f.availability === availabilityFilter);
  }

  // Get unique subtypes from current finishes
  const subtypes = [...new Set(finishes.map(f => f.subtype))].sort();

  return (
    <div className="space-y-4">
      {/* Search & Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="Search finishes..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {subtypes.length > 1 && onSubtypeFilterChange && (
          <select
            value={subtypeFilter || ''}
            onChange={e => onSubtypeFilterChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Subtypes</option>
            {subtypes.map(st => (
              <option key={st} value={st}>{String(st)}</option>
            ))}
          </select>
        )}

        {onAvailabilityFilterChange && (
          <select
            value={availabilityFilter || ''}
            onChange={e => onAvailabilityFilterChange(e.target.value as FinishAvailability || undefined)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
          >
            <option value="">All Availability</option>
            {FINISH_AVAILABILITY_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        )}
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      )}

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg font-medium">No finishes found</p>
          <p className="text-sm mt-1">
            {searchTerm ? 'Try a different search term' : 'Add your first finish to get started'}
          </p>
        </div>
      )}

      {/* Table */}
      {!loading && filtered.length > 0 && (
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Swatch</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Subtype</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Availability</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost Modifier</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Storefront</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {filtered.map(finish => (
                <tr
                  key={finish.id}
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => onEdit(finish)}
                >
                  <td className="px-4 py-3">
                    <div
                      className="w-8 h-8 rounded-md border border-gray-200"
                      style={{
                        backgroundColor: finish.hexColor || '#ccc',
                        backgroundImage: finish.thumbnailUrl ? `url(${finish.thumbnailUrl})` : undefined,
                        backgroundSize: 'cover',
                      }}
                    />
                  </td>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{finish.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 font-mono">{finish.code}</td>
                  <td className="px-4 py-3 text-sm text-gray-500 capitalize">{String(finish.subtype).replace(/_/g, ' ')}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      finish.availability === 'in_stock' ? 'bg-green-100 text-green-700' :
                      finish.availability === 'made_to_order' ? 'bg-blue-100 text-blue-700' :
                      finish.availability === 'discontinued' ? 'bg-red-100 text-red-700' :
                      'bg-yellow-100 text-yellow-700'
                    }`}>
                      {FINISH_AVAILABILITY_OPTIONS.find(o => o.value === finish.availability)?.label || finish.availability}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {finish.costModifier
                      ? `${finish.costModifierType === 'percentage' ? '' : '+'}${finish.costModifier}${finish.costModifierType === 'percentage' ? '%' : ` ${finish.costModifierUnit || ''}`}`
                      : '-'}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {finish.dawinFinishes?.shopifySyncStatus ? (
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${SYNC_BADGE[finish.dawinFinishes.shopifySyncStatus] || 'bg-gray-100'}`}>
                        {finish.dawinFinishes.shopifySyncStatus}
                      </span>
                    ) : finish.dawinFinishes ? (
                      <span className="text-gray-400 text-xs">configured · draft</span>
                    ) : (
                      <span className="text-gray-300 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="relative inline-block">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); setMenuOpen(menuOpen === finish.id ? null : finish.id); }}
                        className="p-1 rounded hover:bg-gray-100"
                      >
                        <MoreVertical className="w-4 h-4 text-gray-400" />
                      </button>
                      {menuOpen === finish.id && (
                        <div className="absolute right-0 mt-1 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setMenuOpen(null); onEdit(finish); }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                          >
                            <Edit2 className="w-3.5 h-3.5" /> Edit
                          </button>
                          {onOpenStorefront && (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); setMenuOpen(null); onOpenStorefront(finish); }}
                              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                            >
                              <Globe className="w-3.5 h-3.5" /> Storefront…
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setMenuOpen(null); onArchive(finish); }}
                            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                          >
                            <Archive className="w-3.5 h-3.5" /> Archive
                          </button>
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="text-xs text-gray-400 text-right">
        {filtered.length} finish{filtered.length !== 1 ? 'es' : ''}
      </div>
    </div>
  );
}
