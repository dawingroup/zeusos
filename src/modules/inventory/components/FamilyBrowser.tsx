/**
 * FamilyBrowser
 * Two-level tree view for browsing inventory items organized by family/SKU hierarchy.
 * Family rows are expandable non-transactable headers; SKU rows are fully actionable.
 * Flat SKUs (no family) appear at the top level.
 */

import { useState, useMemo } from 'react';
import {
  Search,
  ChevronRight,
  ChevronDown,
  Package,
  Layers,
  Plus,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { useFamilyBrowser } from '../hooks/useFamilyBrowser';
import type {
  InventoryItem,
  InventoryClassification,
  InventoryCategory,
  FamilyStockRollup,
} from '../types';
import { useCategories } from '../hooks/useCategories';

interface FamilyBrowserProps {
  classification?: InventoryClassification;
  onSelectSku?: (item: InventoryItem) => void;
  onViewDetail?: (item: InventoryItem) => void;
  onAddVariant?: (familyId: string) => void;
  onCreateFamily?: () => void;
  onCreateItem?: () => void;
}

export function FamilyBrowser({
  classification,
  onSelectSku,
  onViewDetail,
  onAddVariant,
  onCreateFamily,
  onCreateItem,
}: FamilyBrowserProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<InventoryCategory | 'all'>('all');
  const { selectableCategories } = useCategories();

  const {
    families,
    flatSkus,
    expandedFamilySkus,
    familyRollups,
    expandedFamilyIds,
    toggleFamily,
    loading,
    loadingSkus,
    error,
  } = useFamilyBrowser({ classification });

  // Filter families and flat SKUs by search term and category
  const filteredFamilies = useMemo(() => {
    let result = families;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (f) =>
          f.name.toLowerCase().includes(term) ||
          f.sku.toLowerCase().includes(term) ||
          f.subcategory?.toLowerCase().includes(term),
      );
    }
    if (categoryFilter !== 'all') {
      result = result.filter((f) => f.category === categoryFilter);
    }
    return result;
  }, [families, searchTerm, categoryFilter]);

  const filteredFlatSkus = useMemo(() => {
    let result = flatSkus;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(term) ||
          s.sku.toLowerCase().includes(term) ||
          s.displayName?.toLowerCase().includes(term),
      );
    }
    if (categoryFilter !== 'all') {
      result = result.filter((s) => s.category === categoryFilter);
    }
    return result;
  }, [flatSkus, searchTerm, categoryFilter]);

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 text-red-600 bg-red-50 rounded-lg">
        <AlertCircle className="h-4 w-4" />
        <span className="text-sm">{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search families and items..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as InventoryCategory | 'all')}
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
        >
          <option value="all">All Categories</option>
          {selectableCategories.map((cat) => (
            <option key={cat.slug} value={cat.slug}>
              {cat.name}
            </option>
          ))}
        </select>
        {onCreateFamily && (
          <button
            onClick={onCreateFamily}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90"
          >
            <Layers className="h-4 w-4" />
            New Family
          </button>
        )}
        {onCreateItem && (
          <button
            onClick={onCreateItem}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-200 rounded-lg text-sm hover:bg-gray-50"
          >
            <Plus className="h-4 w-4" />
            New Item
          </button>
        )}
      </div>

      {/* Loading state */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      )}

      {/* Tree list */}
      {!loading && (
        <div className="border border-gray-200 rounded-lg divide-y divide-gray-100">
          {/* Family rows */}
          {filteredFamilies.map((family) => (
            <FamilyRow
              key={family.id}
              family={family}
              rollup={familyRollups[family.id]}
              isExpanded={expandedFamilyIds.has(family.id)}
              loadingSkus={loadingSkus[family.id] || false}
              skus={expandedFamilySkus[family.id] || []}
              onToggle={() => toggleFamily(family.id)}
              onViewDetail={onViewDetail}
              onSelectSku={onSelectSku}
              onAddVariant={onAddVariant}
            />
          ))}

          {/* Flat SKU rows */}
          {filteredFlatSkus.map((item) => (
            <SkuRow
              key={item.id}
              item={item}
              indented={false}
              onSelect={onSelectSku}
              onViewDetail={onViewDetail}
            />
          ))}

          {/* Empty state */}
          {filteredFamilies.length === 0 && filteredFlatSkus.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Package className="h-8 w-8 mb-2" />
              <p className="text-sm">No inventory items found</p>
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

function FamilyRow({
  family,
  rollup,
  isExpanded,
  loadingSkus,
  skus,
  onToggle,
  onViewDetail,
  onSelectSku,
  onAddVariant,
}: {
  family: InventoryItem;
  rollup?: FamilyStockRollup;
  isExpanded: boolean;
  loadingSkus: boolean;
  skus: InventoryItem[];
  onToggle: () => void;
  onViewDetail?: (item: InventoryItem) => void;
  onSelectSku?: (item: InventoryItem) => void;
  onAddVariant?: (familyId: string) => void;
}) {
  return (
    <div>
      {/* Family header row */}
      <div
        className="flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 cursor-pointer"
        onClick={onToggle}
      >
        {/* Expand/collapse */}
        <button className="text-gray-400 hover:text-gray-600">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </button>

        {/* Family icon */}
        <Layers className="h-4 w-4 text-blue-500" />

        {/* Name and info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 truncate">
              {family.name}
            </span>
            <span className="inline-flex items-center px-1.5 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 rounded">
              Family
            </span>
            {rollup && (
              <span className="text-xs text-gray-500">
                {rollup.variantCount} variant{rollup.variantCount !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs text-gray-500">{family.sku}</span>
            {family.subcategory && (
              <span className="text-xs text-gray-400">{family.subcategory}</span>
            )}
            {rollup && rollup.totalStockQty > 0 && (
              <span className="text-xs text-gray-500">
                Combined stock: {rollup.totalStockQty.toLocaleString()}
              </span>
            )}
            {rollup && rollup.costFrom > 0 && (
              <span className="text-xs text-gray-400">
                {rollup.costFrom === rollup.costTo
                  ? `UGX ${rollup.costFrom.toLocaleString()}`
                  : `UGX ${rollup.costFrom.toLocaleString()} – ${rollup.costTo.toLocaleString()}`}
              </span>
            )}
          </div>
        </div>

        {/* Actions — NO transaction actions on family rows */}
        <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {onAddVariant && (
            <button
              onClick={() => onAddVariant(family.id)}
              className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 rounded"
            >
              <Plus className="h-3 w-3" />
              Add Variant
            </button>
          )}
          {onViewDetail && (
            <button
              onClick={() => onViewDetail(family)}
              className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-200 rounded"
            >
              Details
            </button>
          )}
        </div>
      </div>

      {/* Expanded SKUs */}
      {isExpanded && (
        <div>
          {loadingSkus && (
            <div className="flex items-center gap-2 pl-12 py-3">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              <span className="text-xs text-gray-400">Loading variants...</span>
            </div>
          )}
          {!loadingSkus && skus.length === 0 && (
            <div className="pl-12 py-3 text-xs text-gray-400">
              No variants yet.{' '}
              {onAddVariant && (
                <button
                  onClick={() => onAddVariant(family.id)}
                  className="text-blue-500 hover:underline"
                >
                  Add the first variant
                </button>
              )}
            </div>
          )}
          {!loadingSkus &&
            skus.map((sku) => (
              <SkuRow
                key={sku.id}
                item={sku}
                indented
                onSelect={onSelectSku}
                onViewDetail={onViewDetail}
              />
            ))}
        </div>
      )}
    </div>
  );
}

function SkuRow({
  item,
  indented,
  onSelect,
  onViewDetail,
}: {
  item: InventoryItem;
  indented: boolean;
  onSelect?: (item: InventoryItem) => void;
  onViewDetail?: (item: InventoryItem) => void;
}) {
  const stockQty = item.inventory?.inStock ?? 0;
  const isLowStock =
    stockQty > 0 &&
    item.inventory?.reorderLevel !== undefined &&
    stockQty <= item.inventory.reorderLevel;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 ${
        indented ? 'pl-12' : ''
      }`}
    >
      {/* SKU icon */}
      <Package className="h-4 w-4 text-gray-400" />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-900 truncate">
            {item.displayName || item.name}
          </span>
          {/* Variant attribute badges */}
          {item.variantAttributes?.map((attr) => (
            <span
              key={attr.key}
              className="inline-flex items-center px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded"
            >
              {attr.value}
            </span>
          ))}
          {/* Status badge */}
          {item.status === 'discontinued' && (
            <span className="inline-flex items-center px-1.5 py-0.5 text-xs bg-red-100 text-red-600 rounded">
              Discontinued
            </span>
          )}
        </div>
        <div className="flex items-center gap-3 mt-0.5">
          <span className="text-xs text-gray-500 font-mono">{item.sku}</span>
          <span
            className={`text-xs font-medium ${
              isLowStock
                ? 'text-amber-600'
                : stockQty > 0
                  ? 'text-green-600'
                  : 'text-gray-400'
            }`}
          >
            {stockQty.toLocaleString()} in stock
          </span>
          {item.pricing?.costPerUnit ? (
            <span className="text-xs text-gray-400">
              {item.pricing.currency || 'UGX'}{' '}
              {item.pricing.costPerUnit.toLocaleString()} / {item.pricing.unit}
            </span>
          ) : null}
        </div>
      </div>

      {/* Transaction actions — only on SKU rows */}
      <div className="flex items-center gap-1">
        {onSelect && (
          <button
            onClick={() => onSelect(item)}
            className="px-2.5 py-1 text-xs font-medium text-primary border border-primary/30 rounded hover:bg-primary/5"
          >
            Select
          </button>
        )}
        {onViewDetail && (
          <button
            onClick={() => onViewDetail(item)}
            className="px-2 py-1 text-xs text-gray-500 hover:bg-gray-100 rounded"
          >
            View
          </button>
        )}
      </div>
    </div>
  );
}
