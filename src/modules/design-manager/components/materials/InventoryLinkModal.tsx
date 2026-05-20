/**
 * InventoryLinkModal Component
 * Modal for linking a material to an inventory item
 */

import { useState, useEffect, useCallback } from 'react';
import { X, Search, Link2, Loader2, Package, Check, AlertCircle } from 'lucide-react';
import { searchInventoryForLinking } from '@/modules/inventory/services/materialInventoryLinkService';
import type { Material } from '../../types/materials';

interface InventorySearchResult {
  id: string;
  sku: string;
  name: string;
  inStock: number;
  costPerUnit: number;
  currency: string;
}

interface InventoryLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  material: Material;
  onLink: (inventoryItemId: string, inventoryItemSku: string) => Promise<void>;
}

export function InventoryLinkModal({
  isOpen,
  onClose,
  material,
  onLink,
}: InventoryLinkModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<InventorySearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [linking, setLinking] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Auto-search on open with material name
  useEffect(() => {
    if (isOpen && material) {
      setSearchTerm(material.name);
      handleSearch(material.name);
    }
  }, [isOpen, material?.id]);

  // Reset on close
  useEffect(() => {
    if (!isOpen) {
      setSearchTerm('');
      setResults([]);
      setSelectedId(null);
      setError(null);
    }
  }, [isOpen]);

  const handleSearch = useCallback(async (term: string) => {
    if (!term.trim()) {
      setResults([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const searchResults = await searchInventoryForLinking(term, 20);
      setResults(searchResults);
    } catch (err) {
      setError('Failed to search inventory');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

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
      await onLink(selected.id, selected.sku);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link material');
    } finally {
      setLinking(false);
    }
  };

  const formatCurrency = (amount: number, curr: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: curr === 'UGX' ? 'UGX' : curr === 'KES' ? 'KES' : 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getStockStatus = (inStock: number) => {
    if (inStock <= 0) return { label: 'Out of Stock', color: 'text-red-600 bg-red-50' };
    if (inStock < 10) return { label: 'Low Stock', color: 'text-amber-600 bg-amber-50' };
    return { label: 'In Stock', color: 'text-green-600 bg-green-50' };
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Link2 className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Link to Inventory</h2>
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
          {/* Material Info */}
          <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Linking Material</p>
            <p className="font-medium text-gray-900">{material.name}</p>
            <p className="text-sm text-gray-500">Code: {material.code}</p>
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
              Search Inventory Items
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary focus:border-primary"
                placeholder="Search by name or SKU..."
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
                No inventory items found matching "{searchTerm}"
              </div>
            )}

            {results.map((item) => {
              const isSelected = selectedId === item.id;
              const stockStatus = getStockStatus(item.inStock);

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full flex items-center justify-between p-3 border rounded-lg text-left transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/5 ring-1 ring-primary'
                      : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Package
                      className={`w-5 h-5 flex-shrink-0 ${
                        isSelected ? 'text-primary' : 'text-gray-400'
                      }`}
                    />
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm text-gray-900 truncate">
                          {item.name}
                        </span>
                        {isSelected && <Check className="w-4 h-4 text-primary flex-shrink-0" />}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <span className="font-mono">{item.sku}</span>
                        <span>•</span>
                        <span className="font-semibold">
                          {formatCurrency(item.costPerUnit, item.currency)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <span
                    className={`px-2 py-1 text-xs font-medium rounded ${stockStatus.color}`}
                  >
                    {item.inStock} in stock
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
            Link to Inventory
          </button>
        </div>
      </div>
    </div>
  );
}

export default InventoryLinkModal;
