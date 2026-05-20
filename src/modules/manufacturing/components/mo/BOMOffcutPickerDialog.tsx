/**
 * BOM Offcut Picker Dialog
 *
 * Allows users to browse available offcuts from the library and assign one
 * to a BOM entry on a Manufacturing Order. Inlines picker logic to avoid
 * cross-module coupling with the design-manager OffcutPicker.
 */

import { useState, useEffect } from 'react';
import {
  X,
  Recycle,
  Loader2,
  Search,
  TreePine,
  Layers,
  MapPin,
} from 'lucide-react';
import type { BOMEntry } from '../../types';
import type { Offcut } from '@/shared/types/offcut';
import type { MaterialType } from '@/shared/types';
import {
  queryOffcutsByMaterialType,
  reserveOffcut,
} from '@/shared/services/offcutLibraryService';

interface BOMOffcutPickerDialogProps {
  open: boolean;
  bomEntry: BOMEntry;
  moId: string;
  projectId: string;
  onAssigned: (offcutId: string, offcut: Offcut) => void;
  onClose: () => void;
}

/** Map BOM category strings to MaterialType for offcut querying */
function bomCategoryToMaterialType(category: string): MaterialType | undefined {
  const map: Record<string, MaterialType> = {
    'sheet-goods': 'PANEL',
    timber: 'TIMBER',
    'solid-wood': 'TIMBER',
    glass: 'GLASS',
    metal: 'METAL_BAR',
    aluminium: 'ALUMINIUM',
    stone: 'STONE',
  };
  return map[category.toLowerCase()];
}

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

export function BOMOffcutPickerDialog({
  open,
  bomEntry,
  moId,
  projectId,
  onAssigned,
  onClose,
}: BOMOffcutPickerDialogProps) {
  const [offcuts, setOffcuts] = useState<Offcut[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [assigning, setAssigning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const materialType = bomCategoryToMaterialType(bomEntry.category);

  useEffect(() => {
    if (!open || !materialType) return;
    let cancelled = false;
    setIsLoading(true);

    queryOffcutsByMaterialType(materialType)
      .then((results) => {
        if (!cancelled) {
          setOffcuts(results.filter((o) => o.condition !== 'damaged'));
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load offcuts:', err);
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, materialType]);

  if (!open) return null;

  const filtered = offcuts.filter((offcut) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      offcut.materialName.toLowerCase().includes(q) ||
      offcut.sourceProjectName.toLowerCase().includes(q) ||
      (offcut.warehouseLocation || '').toLowerCase().includes(q)
    );
  });

  const handleAssign = async (offcut: Offcut) => {
    setAssigning(offcut.id);
    setError(null);
    try {
      await reserveOffcut(offcut.id, projectId || moId);
      onAssigned(offcut.id, offcut);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reserve offcut');
    } finally {
      setAssigning(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-green-50">
          <div>
            <div className="flex items-center gap-2">
              <Recycle className="w-5 h-5 text-green-600" />
              <h2 className="text-lg font-semibold text-gray-900">
                Assign Offcut
              </h2>
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {bomEntry.itemName} — {bomEntry.category}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b border-gray-100 bg-gray-50">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, source project, or location..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {error && (
            <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              <span className="ml-2 text-gray-500">Loading offcuts...</span>
            </div>
          ) : !materialType ? (
            <div className="text-center py-12">
              <Recycle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">
                Category &quot;{bomEntry.category}&quot; does not support offcuts
              </p>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Recycle className="w-10 h-10 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500 text-sm">
                {search
                  ? 'No offcuts match your search'
                  : `No available ${materialType} offcuts in the library`}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filtered.map((offcut) => {
                const isAssigning = assigning === offcut.id;
                return (
                  <button
                    key={offcut.id}
                    onClick={() => handleAssign(offcut)}
                    disabled={!!assigning}
                    className="w-full p-3 text-left border border-gray-200 rounded-lg hover:border-green-400 hover:bg-green-50 transition-colors disabled:opacity-50"
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
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            offcut.condition === 'good'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-amber-100 text-amber-700'
                          }`}
                        >
                          {offcut.condition}
                        </span>
                        {offcut.originalCostAllocation > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            ~{offcut.originalCostAllocation.toLocaleString()} UGX
                          </div>
                        )}
                        {isAssigning && (
                          <Loader2 className="w-4 h-4 animate-spin text-green-600 mt-1 ml-auto" />
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 bg-gray-50">
          <span className="text-xs text-gray-500">
            {filtered.length} offcut{filtered.length !== 1 ? 's' : ''} available
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export default BOMOffcutPickerDialog;
