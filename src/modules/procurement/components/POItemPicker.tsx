/**
 * POItemPicker
 * Unified autocomplete picker for searching inventory items, materials, and products.
 * Follows the SupplierPicker pattern with grouped results by source.
 * Includes inline "Create New Item" when no matches are found.
 */

import { useEffect, useState, useRef } from 'react';
import { Search, ChevronDown, X, Package, Layers, ShoppingBag, Link2, Plus, Loader2 } from 'lucide-react';
import { usePOItemSearch } from '../hooks/usePOItemSearch';
import type { UnifiedSearchResult } from '../hooks/usePOItemSearch';
import { createInventoryItem, generateSku } from '@/modules/inventory/services/inventoryService';
import { useCategories } from '@/modules/inventory/hooks/useCategories';
import type { InventoryCategory, InventoryListItem, InventoryUnit } from '@/modules/inventory/types';

interface POItemPickerProps {
  /** Display value (item description) */
  value: string;
  /** Called when user types (for manual entry fallback) */
  onInputChange: (value: string) => void;
  /** Called when user selects an item from the dropdown */
  onSelect: (result: UnifiedSearchResult) => void;
  /** User ID for creating new inventory items */
  userId?: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function POItemPicker({
  value,
  onInputChange,
  onSelect,
  userId,
  placeholder = 'Search inventory, materials, products...',
  disabled = false,
  className = '',
}: POItemPickerProps) {
  const { results, loading, search, clear } = usePOItemSearch();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Create new item form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createCategory, setCreateCategory] = useState<InventoryCategory>('other');
  const [createCost, setCreateCost] = useState('');
  const [createUnit, setCreateUnit] = useState('pcs');
  const [creating, setCreating] = useState(false);

  // Reset create form when search text changes
  useEffect(() => {
    setShowCreateForm(false);
  }, [value]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setShowCreateForm(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onInputChange(newValue);
    search(newValue);
    setIsOpen(true);
  };

  const handleSelect = (result: UnifiedSearchResult) => {
    onSelect(result);
    setIsOpen(false);
    setShowCreateForm(false);
    clear();
  };

  const handleClear = () => {
    onInputChange('');
    clear();
    setShowCreateForm(false);
    inputRef.current?.focus();
  };

  const handleFocus = () => {
    if (value.trim().length >= 2) {
      search(value);
    }
    setIsOpen(true);
  };

  const handleCreateItem = async () => {
    if (!userId || !value.trim()) return;
    setCreating(true);
    try {
      const name = value.trim();
      const sku = generateSku(name, createCategory);
      const costPerUnit = parseFloat(createCost) || 0;

      const newItemId = await createInventoryItem(
        {
          sku,
          name,
          description: '',
          category: createCategory,
          status: 'active',
          pricing: {
            costPerUnit,
            currency: 'UGX',
            unit: (createUnit || 'pcs') as InventoryUnit,
          },
        },
        userId,
      );

      // Build a UnifiedSearchResult and call onSelect to populate the line item
      const result: UnifiedSearchResult = {
        source: 'inventory',
        item: {
          id: newItemId,
          name,
          sku,
          category: createCategory,
          status: 'active',
          costPerUnit,
          currency: 'UGX',
          tier: 'catalogue',
          source: 'manual',
        } as InventoryListItem,
      };
      handleSelect(result);

      // Reset form
      setShowCreateForm(false);
      setCreateCategory('other');
      setCreateCost('');
      setCreateUnit('pcs');
    } catch (err) {
      console.error('Failed to create inventory item:', err);
    } finally {
      setCreating(false);
    }
  };

  // Group results by source
  const inventoryResults = results.filter((r) => r.source === 'inventory');
  const materialResults = results.filter((r) => r.source === 'material');
  const productResults = results.filter((r) => r.source === 'product');
  const hasResults = results.length > 0;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-2 flex items-center pointer-events-none">
          <Search className="h-3.5 w-3.5 text-gray-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={handleFocus}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full pl-7 pr-14 py-1.5 border rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-gray-100 disabled:cursor-not-allowed border-gray-200 h-8`}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-1 gap-0.5">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-0.5 hover:bg-gray-100 rounded transition-colors"
            >
              <X className="h-3.5 w-3.5 text-gray-400" />
            </button>
          )}
          <button
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            disabled={disabled}
            className="p-0.5 hover:bg-gray-100 rounded transition-colors disabled:cursor-not-allowed"
          >
            <ChevronDown
              className={`h-3.5 w-3.5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 w-[420px] bg-white rounded-lg shadow-lg border border-gray-200 max-h-72 overflow-auto">
          {loading ? (
            <div className="p-3 text-center text-gray-500 text-sm">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mx-auto" />
            </div>
          ) : !hasResults && value.trim().length >= 2 ? (
            <div className="p-3 space-y-2">
              <p className="text-center text-gray-500 text-sm">
                No items found. Type to use as description.
              </p>
              {userId && !showCreateForm && (
                <button
                  type="button"
                  onClick={() => setShowCreateForm(true)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary/5 rounded-md border border-dashed border-primary/40 transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Create as new inventory item
                </button>
              )}
              {showCreateForm && (
                <CreateItemInlineForm
                  name={value.trim()}
                  category={createCategory}
                  onCategoryChange={setCreateCategory}
                  cost={createCost}
                  onCostChange={setCreateCost}
                  unit={createUnit}
                  onUnitChange={setCreateUnit}
                  creating={creating}
                  onSubmit={handleCreateItem}
                  onCancel={() => setShowCreateForm(false)}
                />
              )}
            </div>
          ) : !hasResults ? (
            <div className="p-3 text-center text-gray-500 text-sm">
              Type at least 2 characters to search
            </div>
          ) : (
            <div className="py-1">
              {/* Inventory results */}
              {inventoryResults.length > 0 && (
                <ResultGroup label="Inventory" icon={<Package className="h-3.5 w-3.5" />} color="blue">
                  {inventoryResults.map((r) => {
                    if (r.source !== 'inventory') return null;
                    const item = r.item;
                    return (
                      <ResultRow
                        key={`inv-${item.id}`}
                        onClick={() => handleSelect(r)}
                        primary={item.displayName || item.name}
                        secondary={item.sku}
                        meta={
                          <span className="text-xs">
                            {item.costPerUnit != null ? `${item.costPerUnit.toLocaleString()} ${item.currency ?? ''}` : '—'}
                            {item.inStock != null && (
                              <span className="ml-2 text-muted-foreground">
                                Stock: {item.inStock}
                              </span>
                            )}
                          </span>
                        }
                      />
                    );
                  })}
                </ResultGroup>
              )}

              {/* Material results */}
              {materialResults.length > 0 && (
                <ResultGroup label="Materials" icon={<Layers className="h-3.5 w-3.5" />} color="amber">
                  {materialResults.map((r) => {
                    if (r.source !== 'material') return null;
                    const mat = r.item;
                    const hasLink = !!r.linkedInventory;
                    return (
                      <ResultRow
                        key={`mat-${mat.id}`}
                        onClick={() => handleSelect(r)}
                        primary={mat.name}
                        secondary={mat.code}
                        meta={
                          <span className="flex items-center gap-2 text-xs">
                            {mat.pricing?.unitCost != null
                              ? `${mat.pricing.unitCost.toLocaleString()} ${mat.pricing.currency ?? ''}`
                              : '—'}
                            {hasLink && (
                              <span className="inline-flex items-center gap-0.5 text-green-600" title="Linked to inventory">
                                <Link2 className="h-3 w-3" />
                              </span>
                            )}
                            {!hasLink && (
                              <span className="text-orange-500 text-[10px]">No inv. link</span>
                            )}
                          </span>
                        }
                      />
                    );
                  })}
                </ResultGroup>
              )}

              {/* Product results */}
              {productResults.length > 0 && (
                <ResultGroup label="Products" icon={<ShoppingBag className="h-3.5 w-3.5" />} color="green">
                  {productResults.map((r) => {
                    if (r.source !== 'product') return null;
                    const prod = r.item;
                    return (
                      <ResultRow
                        key={`prod-${prod.id}`}
                        onClick={() => handleSelect(r)}
                        primary={prod.name}
                        secondary={prod.category}
                        meta={
                          <span className="text-xs">
                            {prod.pricing?.basePrice != null
                              ? `${prod.pricing.basePrice.toLocaleString()} ${prod.pricing.currency ?? ''}`
                              : '—'}
                          </span>
                        }
                      />
                    );
                  })}
                </ResultGroup>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================
// Sub-components
// ============================================

function CreateItemInlineForm({
  name,
  category,
  onCategoryChange,
  cost,
  onCostChange,
  unit,
  onUnitChange,
  creating,
  onSubmit,
  onCancel,
}: {
  name: string;
  category: InventoryCategory;
  onCategoryChange: (c: InventoryCategory) => void;
  cost: string;
  onCostChange: (v: string) => void;
  unit: string;
  onUnitChange: (v: string) => void;
  creating: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const { selectableCategories } = useCategories();

  return (
    <div className="border rounded-md p-2.5 space-y-2 bg-blue-50/50">
      <p className="text-xs font-medium text-gray-700 truncate">
        New item: <span className="font-semibold">{name}</span>
      </p>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] text-gray-500 block mb-0.5">Category</label>
          <select
            value={category}
            onChange={(e) => onCategoryChange(e.target.value as InventoryCategory)}
            className="w-full h-7 text-xs border border-gray-200 rounded-md px-1.5 bg-white"
            disabled={creating}
          >
            {selectableCategories.map((cat) => (
              <option key={cat.slug} value={cat.slug}>{cat.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block mb-0.5">Unit Cost</label>
          <input
            type="number"
            value={cost}
            onChange={(e) => onCostChange(e.target.value)}
            placeholder="0"
            className="w-full h-7 text-xs border border-gray-200 rounded-md px-1.5"
            disabled={creating}
          />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block mb-0.5">Unit</label>
          <input
            type="text"
            value={unit}
            onChange={(e) => onUnitChange(e.target.value)}
            className="w-full h-7 text-xs border border-gray-200 rounded-md px-1.5"
            disabled={creating}
          />
        </div>
      </div>
      <div className="flex justify-end gap-1.5">
        <button
          type="button"
          onClick={onCancel}
          disabled={creating}
          className="px-2 py-1 text-[10px] text-gray-600 hover:bg-gray-100 rounded transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onSubmit}
          disabled={creating}
          className="px-2.5 py-1 text-[10px] font-medium text-white bg-primary hover:bg-primary/90 rounded transition-colors flex items-center gap-1"
        >
          {creating && <Loader2 className="h-3 w-3 animate-spin" />}
          Create Item
        </button>
      </div>
    </div>
  );
}

function ResultGroup({
  label,
  icon,
  color,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  color: 'blue' | 'amber' | 'green';
  children: React.ReactNode;
}) {
  const bgMap = { blue: 'bg-blue-50', amber: 'bg-amber-50', green: 'bg-green-50' };
  const textMap = { blue: 'text-blue-700', amber: 'text-amber-700', green: 'text-green-700' };

  return (
    <div>
      <div className={`px-3 py-1.5 flex items-center gap-1.5 ${bgMap[color]} ${textMap[color]} text-xs font-medium sticky top-0`}>
        {icon}
        {label}
      </div>
      {children}
    </div>
  );
}

function ResultRow({
  onClick,
  primary,
  secondary,
  meta,
}: {
  onClick: () => void;
  primary: string;
  secondary?: string;
  meta?: React.ReactNode;
}) {
  return (
    <div
      onClick={onClick}
      className="px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{primary}</p>
          {secondary && (
            <p className="text-xs text-gray-500 truncate">{secondary}</p>
          )}
        </div>
        <div className="ml-2 flex-shrink-0">{meta}</div>
      </div>
    </div>
  );
}
