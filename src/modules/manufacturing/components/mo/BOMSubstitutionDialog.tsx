/**
 * BOM Substitution Dialog
 * Allows swapping a BOM entry with a similar inventory item
 * from the same category, family, or material classification.
 */

import { useState, useEffect } from 'react';
import { X, Search, ArrowRight, Package, Check, Loader2 } from 'lucide-react';
import type { BOMEntry } from '../../types';
import {
  findSimilarInventoryItems,
  type SimilarInventoryItem,
} from '../../services/inventoryIntegrationService';

interface BOMSubstitutionDialogProps {
  open: boolean;
  onClose: () => void;
  bomEntry: BOMEntry;
  onSubstitute: (bomEntryId: string, newItem: SimilarInventoryItem) => void;
}

export function BOMSubstitutionDialog({
  open,
  onClose,
  bomEntry,
  onSubstitute,
}: BOMSubstitutionDialogProps) {
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<SimilarInventoryItem[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setSelectedId(null);
    setSearch('');

    findSimilarInventoryItems(bomEntry)
      .then((results) => setItems(results))
      .catch((err) => {
        console.error('Failed to find similar items:', err);
        setItems([]);
      })
      .finally(() => setLoading(false));
  }, [open, bomEntry]);

  if (!open) return null;

  const filtered = search
    ? items.filter(
        (item) =>
          item.name.toLowerCase().includes(search.toLowerCase()) ||
          item.sku.toLowerCase().includes(search.toLowerCase()) ||
          (item.brand ?? '').toLowerCase().includes(search.toLowerCase()) ||
          (item.subcategory ?? '').toLowerCase().includes(search.toLowerCase()),
      )
    : items;

  const handleConfirm = () => {
    const selected = items.find((i) => i.id === selectedId);
    if (!selected) return;
    onSubstitute(bomEntry.id, selected);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Substitute BOM Item
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Replace <span className="font-medium text-gray-700">{bomEntry.itemName}</span> with
              a similar item
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Current Item */}
        <div className="px-4 py-3 bg-gray-50 border-b border-gray-200">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">
            Current Item
          </div>
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-gray-900">{bomEntry.itemName}</span>
              {bomEntry.sku && (
                <span className="ml-2 text-xs text-gray-500">({bomEntry.sku})</span>
              )}
            </div>
            <div className="text-sm text-gray-600">
              {bomEntry.quantityRequired} {bomEntry.unit} @ {bomEntry.unitCost.toLocaleString()}/unit
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-gray-200">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name, SKU, brand..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-500">Finding similar items...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12 text-gray-500 text-sm">
              {search
                ? 'No matching items found. Try a different search.'
                : 'No similar items found in inventory.'}
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filtered.map((item) => {
                const isSelected = selectedId === item.id;
                const costDiff = item.unitCost - bomEntry.unitCost;
                const totalDiff = costDiff * bomEntry.quantityRequired;

                return (
                  <button
                    key={item.id}
                    onClick={() => setSelectedId(isSelected ? null : item.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${
                      isSelected ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          {isSelected && (
                            <Check className="h-4 w-4 text-primary flex-shrink-0" />
                          )}
                          <span className="text-sm font-medium text-gray-900 truncate">
                            {item.displayName || item.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-gray-500">{item.sku}</span>
                          {item.brand && (
                            <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">
                              {item.brand}
                            </span>
                          )}
                          {item.subcategory && (
                            <span className="text-xs text-gray-400">{item.subcategory}</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">{item.matchReason}</div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <div className="text-sm font-medium text-gray-900">
                          {item.unitCost.toLocaleString()} {item.currency}/{item.unit}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 justify-end">
                          <Package className="h-3 w-3 text-gray-400" />
                          <span
                            className={`text-xs font-medium ${
                              item.inStock > 0 ? 'text-green-600' : 'text-red-500'
                            }`}
                          >
                            {item.inStock > 0 ? `${item.inStock} in stock` : 'Out of stock'}
                          </span>
                        </div>
                        {costDiff !== 0 && (
                          <div
                            className={`text-xs mt-0.5 ${
                              costDiff > 0 ? 'text-red-600' : 'text-green-600'
                            }`}
                          >
                            {costDiff > 0 ? '+' : ''}
                            {totalDiff.toLocaleString()} total
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

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-xs text-gray-500">
            {filtered.length} similar item{filtered.length !== 1 ? 's' : ''} found
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors text-sm"
            >
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!selectedId}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 text-sm"
            >
              <ArrowRight className="h-4 w-4" />
              Substitute Item
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
