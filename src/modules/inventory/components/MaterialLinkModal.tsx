/**
 * MaterialLinkModal Component
 * Modal for linking an inventory item to a material from the palette library.
 * Mirrors the InventoryLinkModal pattern from design-manager but in reverse.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  X,
  Search,
  Link2,
  Loader2,
  Check,
  AlertCircle,
  Palette,
} from 'lucide-react';
import { searchMaterialsForLinking } from '../services/materialInventoryLinkService';
import { MATERIAL_CATEGORIES } from '@/modules/design-manager/types/materials';
import type { Material } from '@/modules/design-manager/types/materials';

interface MaterialLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  inventoryItemName: string;
  inventoryItemSku: string;
  /** Material IDs already linked — excluded from search results */
  excludeIds: string[];
  onLink: (material: Material) => Promise<void>;
}

export function MaterialLinkModal({
  isOpen,
  onClose,
  inventoryItemName,
  inventoryItemSku,
  excludeIds,
  onLink,
}: MaterialLinkModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-search on open with inventory item name
  useEffect(() => {
    if (isOpen) {
      setSearchTerm(inventoryItemName);
      handleSearch(inventoryItemName);
    }
  }, [isOpen]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setResults([]);
      setSelectedId(null);
      setError(null);
    }
  }, [isOpen]);

  const handleSearch = useCallback(
    async (term: string) => {
      if (!term.trim()) {
        setResults([]);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const searchResults = await searchMaterialsForLinking(term, excludeIds, 20);
        setResults(searchResults);
      } catch (err) {
        setError('Failed to search materials');
        console.error(err);
      } finally {
        setLoading(false);
      }
    },
    [excludeIds]
  );

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.trim()) {
        handleSearch(searchTerm);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, handleSearch]);

  const handleLink = async () => {
    if (!selectedId) return;

    const selected = results.find((r) => r.id === selectedId);
    if (!selected) return;

    setLinking(true);
    setError(null);

    try {
      await onLink(selected);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link material');
    } finally {
      setLinking(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Link to Material</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {/* Inventory Item Info */}
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Inventory Item</p>
            <p className="font-medium text-gray-900">{inventoryItemName}</p>
            <p className="text-sm text-gray-500 font-mono">{inventoryItemSku}</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Search */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Search Materials
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary focus:border-primary"
                placeholder="Search by name or code..."
              />
              {loading && (
                <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
              )}
            </div>
          </div>

          {/* Results */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {results.length === 0 && !loading && searchTerm && (
              <div className="text-center py-6 text-sm text-gray-500">
                No materials found matching &ldquo;{searchTerm}&rdquo;
              </div>
            )}

            {results.map((mat) => {
              const isSelected = selectedId === mat.id;
              const catMeta = MATERIAL_CATEGORIES[mat.category] || { label: mat.category, icon: '📋' };

              return (
                <button
                  key={mat.id}
                  type="button"
                  onClick={() => setSelectedId(mat.id)}
                  className={`w-full flex items-center justify-between p-3 border rounded-lg text-left transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Palette
                      className={`w-5 h-5 flex-shrink-0 ${
                        isSelected ? 'text-primary' : 'text-gray-400'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-900 truncate">
                          {mat.name}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="font-mono">{mat.code}</span>
                        {mat.pricing?.unitCost != null && (
                          <>
                            <span>·</span>
                            <span className="font-semibold">
                              {mat.pricing.currency || 'UGX'}{' '}
                              {mat.pricing.unitCost.toLocaleString()}
                            </span>
                          </>
                        )}
                        {mat.dimensions?.thickness && (
                          <>
                            <span>·</span>
                            <span>{mat.dimensions.thickness}mm</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-600 flex-shrink-0">
                    {catMeta.icon} {catMeta.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleLink}
            disabled={!selectedId || linking}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {linking ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Link2 className="w-4 h-4" />
            )}
            Link Material
          </button>
        </div>
      </div>
    </div>
  );
}
