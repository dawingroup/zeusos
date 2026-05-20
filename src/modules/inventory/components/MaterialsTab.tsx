/**
 * MaterialsTab Component
 * Display raw materials with Material Library links, supplier pricing,
 * and expandable parent-child hierarchy
 */

import { useState, useMemo, useRef, useEffect, Fragment } from 'react';
import {
  Search,
  Package,
  Filter,
  Layers,
  Building2,
  Link,
  DollarSign,
  Globe,
  Plus,
  GitBranch,
  ChevronRight,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { useMaterialsInventory } from '../hooks/useMaterialsInventory';
import { useExpandableChildren } from '../hooks/useExpandableChildren';
import { useCategories } from '../hooks/useCategories';
import { type InventoryCategory, type InventoryListItem } from '../types';
import { KPIGrid, KPICard } from '@/shared/components/data-display';

interface MaterialsTabProps {
  onItemClick?: (item: InventoryListItem) => void;
  onLinkToMaterial?: (item: InventoryListItem) => void;
  onManageSupplierPricing?: (item: InventoryListItem) => void;
  onOpenStorefront?: (item: InventoryListItem) => void;
  onAddItem?: () => void;
  selectionEnabled?: boolean;
  selectedIds?: Set<string>;
  onToggleItem?: (id: string) => void;
  onToggleAll?: (visibleIds: string[]) => void;
}

export function MaterialsTab({
  onItemClick,
  onLinkToMaterial,
  onManageSupplierPricing,
  onOpenStorefront,
  onAddItem,
  selectionEnabled = false,
  selectedIds,
  onToggleItem,
  onToggleAll,
}: MaterialsTabProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<InventoryCategory | 'all'>('all');
  const [linkFilter, setLinkFilter] = useState<'all' | 'linked' | 'not-linked'>('all');
  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const { materials, loading, error, stats } = useMaterialsInventory();
  const { selectableCategories, bySlug: categoryBySlug } = useCategories();
  const {
    expandedIds,
    childrenMap,
    loadingIds,
    toggleExpand,
    getStockRollup,
    getCostRange,
  } = useExpandableChildren();

  // Precompute stock rollups for parent items
  const parentStockRollup = useMemo(() => {
    const rollup = new Map<string, number>();
    for (const item of materials) {
      const parentId = item.familyId || item.parentItemId;
      if (parentId) {
        rollup.set(parentId, (rollup.get(parentId) || 0) + (item.inStock || 0));
      }
    }
    return rollup;
  }, [materials]);

  // Filter items — hide children
  const filteredMaterials = useMemo(() => {
    let result = materials;

    // Hide items that are children of a parent
    result = result.filter(item => !item.parentItemId && !item.familyId);

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (item) =>
          item.sku.toLowerCase().includes(term) ||
          item.name.toLowerCase().includes(term) ||
          item.displayName?.toLowerCase().includes(term) ||
          item.brand?.toLowerCase().includes(term)
      );
    }

    // Category filter
    if (categoryFilter !== 'all') {
      result = result.filter((item) => item.category === categoryFilter);
    }

    // Material library link filter
    if (linkFilter !== 'all') {
      result = result.filter((item) => {
        const isLinked = ((item as any).linkedMaterialIds?.length ?? 0) > 0;
        return linkFilter === 'linked' ? isLinked : !isLinked;
      });
    }

    // Brand filter
    if (brandFilter !== 'all') {
      result = result.filter((item) => item.brand === brandFilter);
    }

    return result;
  }, [materials, searchTerm, categoryFilter, linkFilter, brandFilter]);

  // Unique brands for filter dropdown
  const availableBrands = useMemo(() => {
    const brands = new Set<string>();
    materials.forEach((item) => {
      if (item.brand) brands.add(item.brand);
    });
    return Array.from(brands).sort();
  }, [materials]);

  // Pagination
  const totalPages = Math.ceil(filteredMaterials.length / itemsPerPage);
  const paginatedMaterials = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredMaterials.slice(start, start + itemsPerPage);
  }, [filteredMaterials, currentPage, itemsPerPage]);

  const resetPage = () => setCurrentPage(1);

  // Checkbox header indeterminate state (include expanded children)
  const paginatedVisibleIds = useMemo(() => {
    const ids: string[] = [];
    for (const item of paginatedMaterials) {
      ids.push(item.id);
      if (expandedIds.has(item.id)) {
        const children = childrenMap[item.id] || [];
        for (const child of children) {
          ids.push(child.id);
        }
      }
    }
    return ids;
  }, [paginatedMaterials, expandedIds, childrenMap]);
  const allPageSelected = selectionEnabled && paginatedVisibleIds.length > 0 && paginatedVisibleIds.every(id => selectedIds?.has(id));
  const somePageSelected = selectionEnabled && paginatedVisibleIds.some(id => selectedIds?.has(id));
  const headerCheckRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (headerCheckRef.current) {
      headerCheckRef.current.indeterminate = somePageSelected && !allPageSelected;
    }
  }, [somePageSelected, allPageSelected]);

  const isParent = (item: InventoryListItem) =>
    item.isVariantParent || item.isFamily || (item.variantCount && item.variantCount > 0) || (item.skuCount && item.skuCount > 0);

  const getChildCount = (item: InventoryListItem) =>
    (item.isFamily ? item.skuCount : item.variantCount) || 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Materials</h2>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Raw materials for manufacturing - linked to Material Library and suppliers
          </p>
        </div>

        {onAddItem && (
          <button
            onClick={onAddItem}
            className="flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            Add Material
          </button>
        )}
      </div>

      {/* Stats */}
      <KPIGrid cols={4}>
        <KPICard label="Total Materials" value={stats.total} />
        <KPICard label="Linked to Library" value={stats.linkedToMaterialLibrary} />
        <KPICard label="With Suppliers" value={stats.withSupplierPricing} />
        <KPICard label="Not Linked" value={stats.total - stats.linkedToMaterialLibrary} />
      </KPIGrid>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); resetPage(); }}
            placeholder="Search materials..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary focus:border-primary"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value as InventoryCategory | 'all'); resetPage(); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Categories</option>
            {selectableCategories.map((cat) => (
              <option key={cat.slug} value={cat.slug}>
                {cat.icon ? cat.icon + ' ' : ''}{cat.name}
              </option>
            ))}
          </select>

          <select
            value={linkFilter}
            onChange={(e) => { setLinkFilter(e.target.value as 'all' | 'linked' | 'not-linked'); resetPage(); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Link Status</option>
            <option value="linked">Linked to Library</option>
            <option value="not-linked">Not Linked</option>
          </select>

          {availableBrands.length > 0 && (
            <select
              value={brandFilter}
              onChange={(e) => { setBrandFilter(e.target.value); resetPage(); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
            >
              <option value="all">All Brands</option>
              {availableBrands.map((brand) => (
                <option key={brand} value={brand}>{brand}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
          {error.message}
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="text-center py-10 text-gray-500">Loading materials...</div>
      ) : filteredMaterials.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No materials found</h3>
          <p className="text-gray-500 mt-1">
            {searchTerm || categoryFilter !== 'all' || linkFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Add your first material'}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {/* Expand column */}
                <th className="px-2 py-3 w-8"></th>
                {selectionEnabled && (
                  <th className="px-3 py-3 w-10">
                    <input
                      ref={headerCheckRef}
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={() => onToggleAll?.(paginatedVisibleIds)}
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                    />
                  </th>
                )}
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  SKU
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Brand
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Category
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Material Link
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Suppliers
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  In Stock
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                  Unit Cost
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedMaterials.map((item) => {
                const itemIsParent = isParent(item);
                const isExpanded = expandedIds.has(item.id);
                const isLoadingChildren = loadingIds.has(item.id);
                const children = childrenMap[item.id] || [];
                const childCount = getChildCount(item);
                const costRange = itemIsParent ? getCostRange(item.id) : null;

                return (
                  <Fragment key={item.id}>
                    {/* Parent / standalone row */}
                    <tr
                      onClick={() => onItemClick?.(item)}
                      className={`hover:bg-gray-50 ${onItemClick ? 'cursor-pointer' : ''} ${selectedIds?.has(item.id) ? 'bg-primary/5' : ''}`}
                    >
                      {/* Expand toggle */}
                      <td className="px-2 py-3 w-8">
                        {itemIsParent ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleExpand(item.id, !!item.isFamily);
                            }}
                            className="p-0.5 text-gray-400 hover:text-gray-700 rounded hover:bg-gray-100"
                          >
                            {isLoadingChildren ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : isExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                          </button>
                        ) : null}
                      </td>
                      {selectionEnabled && (
                        <td className="px-3 py-3 w-10" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds?.has(item.id) ?? false}
                            onChange={() => onToggleItem?.(item.id)}
                            className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                          />
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <span className="font-mono text-sm text-gray-600">{item.sku}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-gray-900">
                            {item.displayName || item.name}
                          </span>
                          {itemIsParent && childCount > 0 && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-xs font-medium bg-indigo-50 text-indigo-700">
                              <GitBranch className="w-3 h-3" />
                              {childCount}
                            </span>
                          )}
                        </div>
                        {item.thickness && (
                          <div className="text-xs text-gray-500">{item.thickness}mm</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {item.brand || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                          {categoryBySlug.get(item.category)?.icon ?? ''}
                          {categoryBySlug.get(item.category)?.name ?? item.category}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(item as any).linkedMaterialIds?.length > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-700">
                            <Link className="w-3 h-3" />
                            Linked
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
                            Not linked
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(item as any).supplierPricing?.length > 0 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                            <Building2 className="w-3 h-3" />
                            {(item as any).supplierPricing.length}
                          </span>
                        ) : (item as any).preferredSupplierName ? (
                          <span className="text-xs text-gray-600" title={(item as any).preferredSupplierName}>
                            {(item as any).preferredSupplierName?.slice(0, 15)}...
                          </span>
                        ) : (
                          <span className="text-xs text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600">
                        {itemIsParent
                          ? (isExpanded && children.length > 0
                              ? getStockRollup(item.id)
                              : parentStockRollup.get(item.id) ?? item.inStock ?? '-')
                          : item.inStock ?? '-'}
                      </td>
                      <td className="px-4 py-3 text-right text-sm text-gray-600">
                        {itemIsParent && isExpanded && costRange
                          ? `${item.currency || 'UGX'} ${costRange.min.toLocaleString()} - ${costRange.max.toLocaleString()}`
                          : item.costPerUnit
                            ? `${item.currency || 'UGX'} ${item.costPerUnit.toLocaleString()}`
                            : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()}>
                          {onLinkToMaterial && (
                            <button
                              onClick={() => onLinkToMaterial(item)}
                              className="p-1.5 text-purple-600 hover:bg-purple-50 rounded"
                              title="Link to Material Library"
                            >
                              <Link className="w-4 h-4" />
                            </button>
                          )}
                          {onManageSupplierPricing && (
                            <button
                              onClick={() => onManageSupplierPricing(item)}
                              className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                              title="Manage Supplier Pricing"
                            >
                              <DollarSign className="w-4 h-4" />
                            </button>
                          )}
                          {onOpenStorefront && (
                            <button
                              onClick={() => onOpenStorefront(item)}
                              className="p-1.5 text-pink-600 hover:bg-pink-50 rounded"
                              title="Storefront publishing (dawinfinishes.com)"
                            >
                              <Globe className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded child rows */}
                    {isExpanded && children.map((child) => (
                      <tr
                        key={child.id}
                        onClick={() => onItemClick?.({
                          id: child.id,
                          sku: child.sku,
                          name: child.name,
                          displayName: child.displayName,
                          category: child.category,
                          tier: child.tier,
                          source: child.source,
                          status: child.status,
                          costPerUnit: child.pricing?.costPerUnit,
                          currency: child.pricing?.currency,
                          inStock: child.inventory?.inStock,
                          brand: child.brand,
                          parentItemId: child.parentItemId,
                          variantAttributes: child.variantAttributes,
                        } as InventoryListItem)}
                        className={`bg-indigo-50/30 hover:bg-indigo-50/60 cursor-pointer border-l-2 border-indigo-200 ${
                          selectedIds?.has(child.id) ? 'bg-primary/5' : ''
                        }`}
                      >
                        <td className="px-2 py-2 w-8"></td>
                        {selectionEnabled && (
                          <td className="px-3 py-2 w-10" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={selectedIds?.has(child.id) ?? false}
                              onChange={() => onToggleItem?.(child.id)}
                              className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                            />
                          </td>
                        )}
                        <td className="px-4 py-2">
                          <span className="font-mono text-xs text-gray-500">{child.sku}</span>
                        </td>
                        <td className="px-4 py-2 pl-8">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Package className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" />
                            <span className="text-sm text-gray-800">
                              {child.displayName || child.name}
                            </span>
                            {child.variantAttributes?.map((attr, i) => (
                              <span key={i} className="inline-flex items-center px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs">
                                {attr.key}: {attr.value}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td className="px-4 py-2 text-xs text-gray-500">{child.brand || '-'}</td>
                        <td className="px-4 py-2 text-xs text-gray-500">
                          {categoryBySlug.get(child.category)?.name ?? child.category}
                        </td>
                        <td className="px-4 py-2"></td>
                        <td className="px-4 py-2"></td>
                        <td className="px-4 py-2 text-right text-sm">
                          <span className={child.inventory?.inStock ? 'text-green-700' : 'text-gray-400'}>
                            {child.inventory?.inStock ?? 0}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-right text-sm text-gray-600">
                          {child.pricing?.costPerUnit
                            ? `${child.pricing.currency || 'UGX'} ${child.pricing.costPerUnit.toLocaleString()}`
                            : '-'}
                        </td>
                        <td className="px-4 py-2"></td>
                      </tr>
                    ))}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {!loading && filteredMaterials.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredMaterials.length)} of {filteredMaterials.length} materials
          </div>
          {totalPages > 1 && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <span className="text-sm text-gray-600">
                Page {currentPage} of {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default MaterialsTab;
