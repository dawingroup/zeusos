/**
 * KitBuilder Component
 *
 * UI for defining and managing kit (phantom assembly) components.
 * Allows searching inventory items, setting quantities, and previewing the kit.
 */

import { useState, useEffect } from 'react';
import {
  Plus,
  Trash2,
  Loader2,
  Package,
  Search,
  Layers,
  DollarSign,
  AlertCircle,
} from 'lucide-react';
import { searchInventory } from '../services/inventoryService';
import { getKitCost, updateKitComponents } from '../services/kitService';
import type { KitComponent, InventoryListItem } from '../types';

interface KitBuilderProps {
  kitItemId: string;
  kitComponents: KitComponent[];
  userId: string;
  onUpdated: () => void;
}

export function KitBuilder({
  kitItemId,
  kitComponents,
  userId,
  onUpdated,
}: KitBuilderProps) {
  const [components, setComponents] = useState<KitComponent[]>(kitComponents);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<InventoryListItem[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [kitCost, setKitCost] = useState<number | null>(null);
  const [costLoading, setCostLoading] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Load kit cost
  useEffect(() => {
    loadKitCost();
  }, [kitItemId]);

  const loadKitCost = async () => {
    setCostLoading(true);
    try {
      const result = await getKitCost(kitItemId);
      setKitCost(result.totalCost);
    } catch {
      // Kit might be new with no components yet
      setKitCost(null);
    } finally {
      setCostLoading(false);
    }
  };

  // Debounced search
  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await searchInventory(searchTerm, { limit: 10 });
        // Filter out kits and already-added items
        const existingIds = new Set(components.map((c) => c.inventoryItemId));
        setSearchResults(
          results.filter(
            (r) => !existingIds.has(r.id) && r.status === 'active'
          )
        );
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm, components]);

  const handleAddComponent = (item: InventoryListItem) => {
    const newComponent: KitComponent = {
      inventoryItemId: item.id,
      sku: item.sku,
      name: item.displayName || item.name,
      quantity: 1,
      unit: 'ea',
    };
    setComponents((prev) => [...prev, newComponent]);
    setSearchTerm('');
    setSearchResults([]);
    setShowSearch(false);
    setHasChanges(true);
  };

  const handleRemoveComponent = (inventoryItemId: string) => {
    setComponents((prev) => prev.filter((c) => c.inventoryItemId !== inventoryItemId));
    setHasChanges(true);
  };

  const handleQuantityChange = (inventoryItemId: string, quantity: number) => {
    setComponents((prev) =>
      prev.map((c) =>
        c.inventoryItemId === inventoryItemId ? { ...c, quantity: Math.max(1, quantity) } : c
      )
    );
    setHasChanges(true);
  };

  const handleToggleOptional = (inventoryItemId: string) => {
    setComponents((prev) =>
      prev.map((c) =>
        c.inventoryItemId === inventoryItemId ? { ...c, isOptional: !c.isOptional } : c
      )
    );
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateKitComponents(
        kitItemId,
        components.map((c) => ({
          inventoryItemId: c.inventoryItemId,
          quantity: c.quantity,
          isOptional: c.isOptional,
          notes: c.notes,
        })),
        userId,
      );
      setHasChanges(false);
      await loadKitCost();
      onUpdated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save kit components');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-purple-600" />
          <h3 className="text-sm font-medium text-gray-900">Kit Components</h3>
          {components.length > 0 && (
            <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-xs rounded-full">
              {components.length}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Kit cost summary */}
          {kitCost != null && (
            <span className="flex items-center gap-1 text-xs text-gray-500">
              <DollarSign className="w-3 h-3" />
              Kit cost: UGX {kitCost.toLocaleString()}
            </span>
          )}
          {costLoading && <Loader2 className="w-3 h-3 animate-spin text-gray-400" />}
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* Component list */}
      {components.length === 0 ? (
        <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
          <Layers className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">No components added yet.</p>
          <p className="text-xs text-gray-400 mt-1">Add inventory items to build this kit.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {components.map((comp) => (
            <div
              key={comp.inventoryItemId}
              className={`flex items-center justify-between p-3 border rounded-lg ${
                comp.isOptional ? 'bg-gray-50 border-dashed border-gray-300' : 'bg-white border-gray-200'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Package className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {comp.name}
                    </span>
                    <span className="text-xs font-mono text-gray-400">{comp.sku}</span>
                    {comp.isOptional && (
                      <span className="px-1.5 py-0.5 text-xs bg-gray-200 text-gray-600 rounded">
                        Optional
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-shrink-0">
                {/* Quantity */}
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-500">Qty:</span>
                  <input
                    type="number"
                    min="1"
                    value={comp.quantity}
                    onChange={(e) =>
                      handleQuantityChange(comp.inventoryItemId, parseInt(e.target.value) || 1)
                    }
                    className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Toggle optional */}
                <button
                  type="button"
                  onClick={() => handleToggleOptional(comp.inventoryItemId)}
                  className={`px-2 py-1 text-xs rounded ${
                    comp.isOptional
                      ? 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                  title={comp.isOptional ? 'Make required' : 'Make optional'}
                >
                  {comp.isOptional ? 'Optional' : 'Required'}
                </button>

                {/* Remove */}
                <button
                  type="button"
                  onClick={() => handleRemoveComponent(comp.inventoryItemId)}
                  className="p-1 text-gray-400 hover:text-red-600 rounded hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add component search */}
      {showSearch ? (
        <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
              placeholder="Search inventory items..."
              autoFocus
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
            )}
          </div>

          {searchResults.length > 0 && (
            <div className="max-h-48 overflow-y-auto space-y-1">
              {searchResults.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleAddComponent(item)}
                  className="w-full flex items-center justify-between p-2 text-left bg-white border border-gray-200 rounded-lg hover:bg-primary/5 hover:border-primary/30"
                >
                  <div>
                    <span className="text-sm font-medium text-gray-900">{item.name}</span>
                    <span className="ml-2 text-xs font-mono text-gray-400">{item.sku}</span>
                  </div>
                  <Plus className="w-4 h-4 text-primary" />
                </button>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => { setShowSearch(false); setSearchTerm(''); setSearchResults([]); }}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowSearch(true)}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-primary bg-primary/10 rounded-lg hover:bg-primary/20 w-full justify-center"
        >
          <Plus className="w-4 h-4" />
          Add Component
        </button>
      )}

      {/* Save button */}
      {hasChanges && (
        <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-200">
          <button
            type="button"
            onClick={() => { setComponents(kitComponents); setHasChanges(false); }}
            className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Discard Changes
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1 px-4 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save Components
          </button>
        </div>
      )}
    </div>
  );
}
