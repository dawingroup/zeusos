/**
 * Offcut Library Browser
 *
 * Displays available offcuts from previous production runs.
 * Users can view, filter, and scrap offcuts.
 */

import React, { useState, useEffect } from 'react';
import {
  Recycle,
  Loader2,
  Trash2,
  Filter,
  TreePine,
  Layers,
  Plus,
} from 'lucide-react';
import { AddOffcutDialog } from './AddOffcutDialog';
import type { Offcut, MaterialType } from '@/shared/types';
import {
  queryOffcutsByMaterialType,
  getOffcutStats,
  scrapOffcut,
} from '@/shared/services/offcutLibraryService';

interface OffcutLibraryProps {
  className?: string;
}

const MATERIAL_TYPE_OPTIONS: { value: MaterialType | ''; label: string }[] = [
  { value: '', label: 'All Materials' },
  { value: 'TIMBER', label: 'Timber' },
  { value: 'PANEL', label: 'Panel / Board' },
  { value: 'GLASS', label: 'Glass' },
  { value: 'METAL_BAR', label: 'Metal Bar' },
  { value: 'ALUMINIUM', label: 'Aluminium' },
  { value: 'STONE', label: 'Stone' },
];

export const OffcutLibrary: React.FC<OffcutLibraryProps> = ({ className = '' }) => {
  const [offcuts, setOffcuts] = useState<Offcut[]>([]);
  const [stats, setStats] = useState<{
    totalAvailable: number;
    totalValue: number;
    byMaterialType: Record<string, { count: number; value: number }>;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filterType, setFilterType] = useState<MaterialType | ''>('');
  const [scrappingId, setScrappingId] = useState<string | null>(null);
  const [showAddDialog, setShowAddDialog] = useState(false);

  const loadOffcuts = async () => {
    setIsLoading(true);
    try {
      const materialType = filterType || undefined;
      const [offcutList, offcutStats] = await Promise.all([
        queryOffcutsByMaterialType(materialType),
        getOffcutStats(),
      ]);
      setOffcuts(offcutList);
      setStats(offcutStats);
    } catch (err) {
      console.error('Failed to load offcuts:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOffcuts();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterType]);

  const handleScrap = async (offcutId: string) => {
    if (!confirm('Mark this offcut as scrapped? This cannot be undone.')) return;
    setScrappingId(offcutId);
    try {
      await scrapOffcut(offcutId, 'Manually scrapped from library');
      await loadOffcuts();
    } catch (err) {
      console.error('Failed to scrap offcut:', err);
    } finally {
      setScrappingId(null);
    }
  };

  const formatCost = (amount: number) => {
    if (amount >= 1000000) return `${(amount / 1000000).toFixed(2)}M`;
    if (amount >= 1000) return `${(amount / 1000).toFixed(0)}K`;
    return amount.toLocaleString();
  };

  const materialIcon = (type: string) => {
    switch (type) {
      case 'TIMBER': return <TreePine className="w-4 h-4 text-amber-600" />;
      case 'PANEL': case 'SOLID': case 'VENEER': return <Layers className="w-4 h-4 text-blue-600" />;
      case 'STONE': return <Layers className="w-4 h-4 text-amber-700" />;
      default: return <Layers className="w-4 h-4 text-gray-400" />;
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Recycle className="w-5 h-5 text-green-600" />
          <div>
            <h3 className="font-semibold text-gray-900">Offcut Library</h3>
            <p className="text-sm text-gray-500">
              Reusable remnants from completed production runs
            </p>
          </div>
        </div>
        <button
          onClick={() => setShowAddDialog(true)}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-green-600 rounded-md hover:bg-green-700"
        >
          <Plus className="w-4 h-4" />
          Register Offcut
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-green-50 rounded-lg p-3">
            <div className="text-xl font-bold text-green-700">{stats.totalAvailable}</div>
            <div className="text-xs text-green-600">Available Offcuts</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="text-xl font-bold text-blue-700">
              {formatCost(stats.totalValue)} UGX
            </div>
            <div className="text-xs text-blue-600">Total Value</div>
          </div>
          {Object.entries(stats.byMaterialType).map(([type, data]) => (
            <div key={type} className="bg-gray-50 rounded-lg p-3">
              <div className="text-xl font-bold text-gray-700">{data.count}</div>
              <div className="text-xs text-gray-500 flex items-center gap-1">
                {materialIcon(type)} {type}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter */}
      <div className="flex items-center gap-2">
        <Filter className="w-4 h-4 text-gray-400" />
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as MaterialType | '')}
          className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#872E5C] focus:border-transparent"
        >
          {MATERIAL_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Offcut Table */}
      {isLoading ? (
        <div className="flex items-center justify-center h-32">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : offcuts.length === 0 ? (
        <div className="text-center py-12">
          <Recycle className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No available offcuts</p>
          <p className="text-sm text-gray-400 mt-1">
            Run production optimization to generate reusable offcuts
          </p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Dimensions</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Source Project</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Condition</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Value</th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {offcuts.map((offcut) => (
                <tr key={offcut.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm">
                    <div className="flex items-center gap-2">
                      {materialIcon(offcut.materialType)}
                      <div>
                        <div className="text-gray-900">{offcut.materialName}</div>
                        <div className="text-xs text-gray-400">{offcut.materialType}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {offcut.crossSection ? (
                      <span>{offcut.crossSection.thickness}×{offcut.crossSection.width}mm × {offcut.length}mm</span>
                    ) : (
                      <span>{offcut.length}×{offcut.width}mm ({offcut.thickness}mm)</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {offcut.sourceProjectName}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                      offcut.condition === 'good'
                        ? 'bg-green-100 text-green-700'
                        : offcut.condition === 'fair'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {offcut.condition}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {offcut.originalCostAllocation.toLocaleString()} UGX
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleScrap(offcut.id)}
                      disabled={scrappingId === offcut.id}
                      className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg disabled:opacity-50"
                      title="Scrap this offcut"
                    >
                      {scrappingId === offcut.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {/* Add Offcut Dialog */}
      <AddOffcutDialog
        open={showAddDialog}
        onClose={() => setShowAddDialog(false)}
        onCreated={() => {
          setShowAddDialog(false);
          loadOffcuts();
        }}
      />
    </div>
  );
};

export default OffcutLibrary;
