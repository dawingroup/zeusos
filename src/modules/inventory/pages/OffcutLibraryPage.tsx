/**
 * Offcut Library Page
 *
 * Standalone page for managing the offcut library — browsing all offcuts
 * across statuses, editing details, performing bulk operations, and
 * tracking lifecycle (available → reserved → used | scrapped).
 */

import { useState, useEffect, useCallback } from 'react';
import {
  Recycle,
  Loader2,
  Trash2,
  Filter,
  TreePine,
  Layers,
  Plus,
  Pencil,
  MapPin,
  Search,
  CheckSquare,
  Square,
  Unlock,
  RefreshCw,
} from 'lucide-react';
import type { Offcut, OffcutStatus } from '@/shared/types/offcut';
import type { MaterialType } from '@/shared/types';
import {
  queryAllOffcuts,
  getFullOffcutStats,
  scrapOffcut,
  releaseOffcut,
  bulkScrapOffcuts,
  bulkMoveOffcuts,
} from '@/shared/services/offcutLibraryService';
import { AddOffcutDialog } from '@/modules/design-manager/components/production/AddOffcutDialog';
import { EditOffcutDialog } from '../components/EditOffcutDialog';
import { KPIGrid, KPICard } from '@/shared/components/data-display';

// ============================================
// Constants
// ============================================

const STATUS_TABS: { value: OffcutStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'used', label: 'Used' },
  { value: 'scrapped', label: 'Scrapped' },
];

const MATERIAL_TYPE_OPTIONS: { value: MaterialType | ''; label: string }[] = [
  { value: '', label: 'All Materials' },
  { value: 'TIMBER', label: 'Timber' },
  { value: 'PANEL', label: 'Panel / Board' },
  { value: 'GLASS', label: 'Glass' },
  { value: 'METAL_BAR', label: 'Metal Bar' },
  { value: 'ALUMINIUM', label: 'Aluminium' },
  { value: 'STONE', label: 'Stone' },
];

const STATUS_BADGE: Record<string, string> = {
  available: 'bg-green-100 text-green-700',
  reserved: 'bg-blue-100 text-blue-700',
  used: 'bg-gray-100 text-gray-600',
  scrapped: 'bg-red-100 text-red-700',
};

const CONDITION_BADGE: Record<string, string> = {
  good: 'bg-green-100 text-green-700',
  fair: 'bg-amber-100 text-amber-700',
  damaged: 'bg-red-100 text-red-700',
};

// ============================================
// Helpers
// ============================================

const materialIcon = (type: string) => {
  switch (type) {
    case 'TIMBER':
      return <TreePine className="w-4 h-4 text-amber-600" />;
    case 'PANEL':
    case 'SOLID':
    case 'VENEER':
      return <Layers className="w-4 h-4 text-blue-600" />;
    case 'STONE':
      return <Layers className="w-4 h-4 text-amber-700" />;
    default:
      return <Layers className="w-4 h-4 text-gray-400" />;
  }
};

const formatDimensions = (offcut: Offcut) => {
  if (offcut.crossSection) {
    return `${offcut.crossSection.thickness}×${offcut.crossSection.width}mm × ${offcut.length}mm`;
  }
  return `${offcut.length}×${offcut.width}mm (${offcut.thickness}mm)`;
};

const formatCost = (amount: number) => {
  if (amount >= 1000000) return `${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`;
  return amount.toLocaleString();
};

function formatTimestamp(ts: unknown): string {
  if (!ts) return '';
  if (ts && typeof ts === 'object' && 'toDate' in ts) {
    return (ts as { toDate: () => Date }).toDate().toLocaleDateString();
  }
  if (ts instanceof Date) return ts.toLocaleDateString();
  return '';
}

// ============================================
// Component
// ============================================

export default function OffcutLibraryPage() {
  const [offcuts, setOffcuts] = useState<Offcut[]>([]);
  const [stats, setStats] = useState<{
    byStatus: Record<string, { count: number; value: number }>;
    byMaterialType: Record<string, { count: number; value: number }>;
    totalCount: number;
    totalValue: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<OffcutStatus | ''>('');
  const [materialFilter, setMaterialFilter] = useState<MaterialType | ''>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dialogs
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [editOffcut, setEditOffcut] = useState<Offcut | null>(null);
  const [showBulkMoveInput, setShowBulkMoveInput] = useState(false);
  const [bulkMoveLocation, setBulkMoveLocation] = useState('');

  // Action loading
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const filters: { status?: OffcutStatus; materialType?: MaterialType } = {};
      if (statusFilter) filters.status = statusFilter;
      if (materialFilter) filters.materialType = materialFilter;

      const [offcutList, offcutStats] = await Promise.all([
        queryAllOffcuts(filters),
        getFullOffcutStats(),
      ]);
      setOffcuts(offcutList);
      setStats(offcutStats);
      setSelectedIds(new Set());
    } catch (err) {
      console.error('Failed to load offcuts:', err);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, materialFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Client-side search filter
  const filtered = offcuts.filter((offcut) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      offcut.materialName.toLowerCase().includes(q) ||
      offcut.sourceProjectName.toLowerCase().includes(q) ||
      (offcut.warehouseLocation || '').toLowerCase().includes(q)
    );
  });

  // Selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((o) => o.id)));
    }
  };

  // Actions
  const handleScrap = async (offcutId: string) => {
    if (!confirm('Mark this offcut as scrapped? This cannot be undone.')) return;
    setActionLoading(offcutId);
    try {
      await scrapOffcut(offcutId, 'Manually scrapped from library');
      await loadData();
    } catch (err) {
      console.error('Failed to scrap offcut:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRelease = async (offcutId: string) => {
    setActionLoading(offcutId);
    try {
      await releaseOffcut(offcutId);
      await loadData();
    } catch (err) {
      console.error('Failed to release offcut:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkScrap = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`Scrap ${selectedIds.size} selected offcut(s)?`)) return;
    setActionLoading('bulk-scrap');
    try {
      await bulkScrapOffcuts([...selectedIds], 'Bulk scrapped from library');
      await loadData();
    } catch (err) {
      console.error('Failed to bulk scrap:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkMove = async () => {
    if (selectedIds.size === 0 || !bulkMoveLocation.trim()) return;
    setActionLoading('bulk-move');
    try {
      await bulkMoveOffcuts([...selectedIds], bulkMoveLocation.trim());
      setShowBulkMoveInput(false);
      setBulkMoveLocation('');
      await loadData();
    } catch (err) {
      console.error('Failed to bulk move:', err);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Recycle className="w-6 h-6 text-green-600" />
          <div>
            <h1 className="text-xl font-bold text-gray-900">Offcut Library</h1>
            <p className="text-sm text-gray-500">
              Track and manage reusable material remnants from production
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowAddDialog(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700"
          >
            <Plus className="w-4 h-4" />
            Register Offcut
          </button>
        </div>
      </div>

      {/* Stats Dashboard */}
      {stats && (
        <KPIGrid cols={5}>
          <KPICard label="Available" value={stats.byStatus['available']?.count ?? 0} trend="up" />
          <KPICard label="Reserved" value={stats.byStatus['reserved']?.count ?? 0} />
          <KPICard label="Used" value={stats.byStatus['used']?.count ?? 0} />
          <KPICard label="Scrapped" value={stats.byStatus['scrapped']?.count ?? 0} />
          <KPICard
            label="Available Value"
            value={formatCost(stats.byStatus['available']?.value ?? 0)}
            unit="UGX"
          />
        </KPIGrid>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Status Tabs */}
        <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value as OffcutStatus | '')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                statusFilter === tab.value
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {stats && tab.value && stats.byStatus[tab.value] && (
                <span className="ml-1 text-[10px] text-gray-400">
                  ({stats.byStatus[tab.value].count})
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Material Type Filter */}
        <div className="flex items-center gap-1">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={materialFilter}
            onChange={(e) => setMaterialFilter(e.target.value as MaterialType | '')}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
          >
            {MATERIAL_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name, source, or location..."
            className="w-full pl-10 pr-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Bulk Actions Toolbar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
          <span className="text-sm font-medium text-indigo-700">
            {selectedIds.size} selected
          </span>
          <div className="flex items-center gap-2 ml-auto">
            {showBulkMoveInput ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={bulkMoveLocation}
                  onChange={(e) => setBulkMoveLocation(e.target.value)}
                  placeholder="New location..."
                  className="px-2 py-1 border border-gray-300 rounded text-sm w-40"
                  autoFocus
                />
                <button
                  onClick={handleBulkMove}
                  disabled={!bulkMoveLocation.trim() || actionLoading === 'bulk-move'}
                  className="px-3 py-1 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50"
                >
                  {actionLoading === 'bulk-move' ? 'Moving...' : 'Move'}
                </button>
                <button
                  onClick={() => { setShowBulkMoveInput(false); setBulkMoveLocation(''); }}
                  className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowBulkMoveInput(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-white border border-indigo-300 rounded-lg hover:bg-indigo-50"
              >
                <MapPin className="w-3.5 h-3.5" />
                Move Selected
              </button>
            )}
            <button
              onClick={handleBulkScrap}
              disabled={actionLoading === 'bulk-scrap'}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-red-700 bg-white border border-red-300 rounded-lg hover:bg-red-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {actionLoading === 'bulk-scrap' ? 'Scrapping...' : 'Scrap Selected'}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Recycle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No offcuts found</p>
          <p className="text-sm text-gray-400 mt-1">
            {searchQuery || statusFilter || materialFilter
              ? 'Try adjusting your filters'
              : 'Register offcuts from production or add them manually'}
          </p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">
                    <button onClick={toggleSelectAll} className="p-0.5">
                      {selectedIds.size === filtered.length ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Material
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Dimensions
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Status
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Condition
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Source
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Location
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Value
                  </th>
                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {filtered.map((offcut) => {
                  const isSelected = selectedIds.has(offcut.id);
                  const isActioning = actionLoading === offcut.id;

                  return (
                    <tr
                      key={offcut.id}
                      className={`hover:bg-gray-50 ${isSelected ? 'bg-indigo-50/50' : ''}`}
                    >
                      <td className="px-3 py-3">
                        <button onClick={() => toggleSelect(offcut.id)} className="p-0.5">
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-600" />
                          ) : (
                            <Square className="w-4 h-4 text-gray-400" />
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <div className="flex items-center gap-2">
                          {materialIcon(offcut.materialType)}
                          <div>
                            <div className="text-gray-900 font-medium">
                              {offcut.materialName}
                            </div>
                            <div className="text-xs text-gray-400">{offcut.materialType}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {formatDimensions(offcut)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            STATUS_BADGE[offcut.status] || 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {offcut.status}
                        </span>
                        {offcut.status === 'reserved' && offcut.reservedForProjectId && (
                          <div className="text-[10px] text-blue-500 mt-0.5">
                            {formatTimestamp(offcut.reservedAt)}
                          </div>
                        )}
                        {offcut.status === 'used' && (
                          <div className="text-[10px] text-gray-400 mt-0.5">
                            {formatTimestamp(offcut.usedAt)}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            CONDITION_BADGE[offcut.condition] || 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {offcut.condition}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {offcut.sourceProjectName}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {offcut.warehouseLocation ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-gray-400" />
                            {offcut.warehouseLocation}
                          </span>
                        ) : (
                          <span className="text-gray-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {offcut.originalCostAllocation.toLocaleString()} UGX
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditOffcut(offcut)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                            title="Edit offcut"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {offcut.status === 'reserved' && (
                            <button
                              onClick={() => handleRelease(offcut.id)}
                              disabled={isActioning}
                              className="p-1.5 text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg disabled:opacity-50"
                              title="Release reservation"
                            >
                              {isActioning ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Unlock className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                          {(offcut.status === 'available' || offcut.status === 'reserved') && (
                            <button
                              onClick={() => handleScrap(offcut.id)}
                              disabled={isActioning}
                              className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                              title="Scrap offcut"
                            >
                              {isActioning ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Total count footer */}
      {!isLoading && filtered.length > 0 && (
        <div className="text-xs text-gray-400 text-right">
          Showing {filtered.length} of {offcuts.length} offcut{offcuts.length !== 1 ? 's' : ''}
          {stats && ` · Total library value: ${formatCost(stats.totalValue)} UGX`}
        </div>
      )}

      {/* Add Offcut Dialog */}
      <AddOffcutDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onCreated={() => {
          setShowAddDialog(false);
          loadData();
        }}
      />

      {/* Edit Offcut Dialog */}
      {editOffcut && (
        <EditOffcutDialog
          open={!!editOffcut}
          offcut={editOffcut}
          onClose={() => setEditOffcut(null)}
          onSaved={() => {
            setEditOffcut(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
