/**
 * Offcut Picker
 *
 * Displays available offcuts for selection in the material mapping modal.
 * Filters by the palette entry's material type and allows search by name.
 */

import { useState, useEffect } from 'react';
import {
  Loader2,
  Search,
  Recycle,
  TreePine,
  Layers,
  MapPin,
} from 'lucide-react';
import type { MaterialPaletteEntry, Offcut } from '@/shared/types';
import { queryOffcutsByMaterialType } from '@/shared/services/offcutLibraryService';

interface OffcutPickerProps {
  entry: MaterialPaletteEntry;
  onSelect: (offcut: Offcut) => void;
  selectedOffcutId?: string;
}

export function OffcutPicker({ entry, onSelect, selectedOffcutId }: OffcutPickerProps) {
  const [offcuts, setOffcuts] = useState<Offcut[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);

    queryOffcutsByMaterialType(entry.materialType)
      .then((results) => {
        if (!cancelled) {
          // Exclude damaged offcuts
          setOffcuts(results.filter(o => o.condition !== 'damaged'));
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load offcuts:', err);
        if (!cancelled) setIsLoading(false);
      });

    return () => { cancelled = true; };
  }, [entry.materialType]);

  const filtered = offcuts.filter((offcut) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      offcut.materialName.toLowerCase().includes(q) ||
      offcut.sourceProjectName.toLowerCase().includes(q) ||
      (offcut.warehouseLocation || '').toLowerCase().includes(q)
    );
  });

  const formatDimensions = (offcut: Offcut) => {
    if (offcut.crossSection) {
      return `${offcut.crossSection.thickness}×${offcut.crossSection.width}mm × ${offcut.length}mm`;
    }
    return `${offcut.length}×${offcut.width}mm (${offcut.thickness}mm)`;
  };

  const materialIcon = (type: string) => {
    switch (type) {
      case 'TIMBER': return <TreePine className="w-4 h-4 text-amber-600" />;
      case 'PANEL': case 'SOLID': case 'VENEER': return <Layers className="w-4 h-4 text-blue-600" />;
      case 'STONE': return <Layers className="w-4 h-4 text-amber-700" />;
      default: return <Layers className="w-4 h-4 text-gray-400" />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        <span className="ml-2 text-gray-500">Loading offcuts...</span>
      </div>
    );
  }

  return (
    <div>
      {/* Search */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search offcuts by name or source..."
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm"
          />
        </div>
      </div>

      {/* Offcut List */}
      <div className="p-4 max-h-80 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="text-center py-8">
            <Recycle className="w-8 h-8 text-gray-300 mx-auto mb-2" />
            <p className="text-gray-500 text-sm">
              {search
                ? 'No offcuts match your search'
                : `No available ${entry.materialType} offcuts`}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((offcut) => {
              const isSelected = selectedOffcutId === offcut.id;
              return (
                <button
                  key={offcut.id}
                  onClick={() => onSelect(offcut)}
                  className={`w-full p-3 text-left border rounded-lg transition-colors ${
                    isSelected
                      ? 'border-green-500 bg-green-50'
                      : 'border-gray-200 hover:border-green-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-start gap-2">
                      {materialIcon(offcut.materialType)}
                      <div>
                        <div className="font-medium text-gray-900">
                          {offcut.materialName}
                        </div>
                        <div className="text-sm text-gray-600 mt-0.5">
                          {formatDimensions(offcut)}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-2">
                          <span>From: {offcut.sourceProjectName}</span>
                          {offcut.warehouseLocation && (
                            <span className="flex items-center gap-0.5">
                              <MapPin className="w-3 h-3" />
                              {offcut.warehouseLocation}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0 ml-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        offcut.condition === 'good'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}>
                        {offcut.condition}
                      </span>
                      {offcut.originalCostAllocation > 0 && (
                        <div className="text-xs text-gray-500 mt-1">
                          ~{offcut.originalCostAllocation.toLocaleString()} UGX
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default OffcutPicker;
