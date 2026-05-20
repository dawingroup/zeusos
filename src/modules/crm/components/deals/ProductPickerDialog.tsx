/**
 * ProductPickerDialog
 * Allows selecting published inventory products to add as design items in a project.
 */

import { useState, useEffect, useMemo } from 'react';
import { X, Search, Package, Loader2, Check } from 'lucide-react';
import { useAuth } from '@/shared/hooks';
import { subscribeToInventory } from '@/modules/inventory/services/inventoryService';
import { addProductAsDesignItem } from '../../services/dealProjectService';
import type { InventoryListItem } from '@/modules/inventory/types/inventory';

interface ProductPickerDialogProps {
  open: boolean;
  onClose: () => void;
  projectId: string;
  onProductAdded: () => void;
}

export function ProductPickerDialog({
  open,
  onClose,
  projectId,
  onProductAdded,
}: ProductPickerDialogProps) {
  const { user } = useAuth();
  const [items, setItems] = useState<InventoryListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    setLoading(true);
    const unsub = subscribeToInventory(
      (allItems) => {
        setItems(allItems);
        setLoading(false);
      },
      (err) => {
        console.error('Product picker subscription error:', err);
        setLoading(false);
      },
      { status: 'active' }
    );

    return unsub;
  }, [open]);

  const products = useMemo(() => {
    let filtered = items.filter(
      (item) => item.classification === 'product'
    );

    if (search.trim()) {
      const term = search.toLowerCase().trim();
      filtered = filtered.filter(
        (item) =>
          item.name.toLowerCase().includes(term) ||
          item.sku.toLowerCase().includes(term) ||
          (item.brand || '').toLowerCase().includes(term) ||
          (item.subcategory || '').toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [items, search]);

  const handleAdd = async (item: InventoryListItem) => {
    if (!user || adding) return;

    setAdding(item.id);
    setError(null);
    try {
      await addProductAsDesignItem(projectId, item, user.uid);
      setAdded((prev) => new Set(prev).add(item.id));
      onProductAdded();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add product');
    } finally {
      setAdding(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold">Add Product to Project</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search */}
        <div className="px-6 py-3 border-b flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search products by name, SKU, or brand..."
              className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
          </div>
        </div>

        {/* Product list */}
        <div className="flex-1 overflow-y-auto px-6 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : products.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-8 w-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">
                {search ? 'No products match your search' : 'No active products in inventory'}
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {products.map((item) => {
                const isAdded = added.has(item.id);
                const isAdding = adding === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => !isAdded && handleAdd(item)}
                    disabled={isAdding || isAdded}
                    className={`w-full flex items-center justify-between p-3 rounded-lg text-left transition-colors ${
                      isAdded
                        ? 'bg-green-50 border border-green-200'
                        : 'hover:bg-gray-50 border border-transparent'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.name}</p>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className="text-xs text-gray-500">{item.sku}</span>
                        <span className="text-xs text-gray-400 capitalize">{item.category}</span>
                        {item.costPerUnit != null && (
                          <span className="text-xs text-gray-500">
                            {item.currency || 'USD'} {item.costPerUnit.toLocaleString()}/unit
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="ml-3 flex-shrink-0">
                      {isAdding ? (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      ) : isAdded ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <span className="text-xs text-blue-600 font-medium">Add</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t flex-shrink-0 flex items-center justify-between">
          <div>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {added.size > 0 && !error && (
              <p className="text-sm text-green-600">{added.size} product(s) added</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border rounded-lg hover:bg-gray-50"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
