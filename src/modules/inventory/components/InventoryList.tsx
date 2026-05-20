/**
 * InventoryList Component
 * Display and manage unified inventory items with expandable parent-child hierarchy
 */

import { useState, useMemo, useRef, useEffect, Fragment } from 'react';
import {
  Plus,
  Search,
  Package,
  Filter,
  Database,
  CheckCircle,
  Clock,
  AlertCircle,
  ChevronRight,
  ChevronDown,
  GitBranch,
  Loader2,
} from 'lucide-react';
import { useInventory } from '../hooks/useInventory';
import { useExpandableChildren } from '../hooks/useExpandableChildren';
import { useCategories } from '../hooks/useCategories';
import { RagBadge, Banner, KPIGrid, KPICard } from '@/shared/components/data-display';
import {
  INVENTORY_SOURCE_LABELS,
  type InventoryCategory,
  type InventorySource,
  type InventoryTier,
  type InventoryStatus,
  type InventoryListItem,
} from '../types';

interface InventoryListProps {
  onSelectItem?: (item: InventoryListItem) => void;
  onItemClick?: (item: InventoryListItem) => void;
  onAddItem?: () => void;
  showActions?: boolean;
  selectionEnabled?: boolean;
  selectedIds?: Set<string>;
  onToggleItem?: (id: string) => void;
  onToggleAll?: (visibleIds: string[]) => void;
}

export function InventoryList({
  onSelectItem,
  onItemClick,
  onAddItem,
  showActions = true,
  selectionEnabled = false,
  selectedIds,
  onToggleItem,
  onToggleAll,
}: InventoryListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<InventoryCategory | 'all'>('all');
  const [sourceFilter, setSourceFilter] = useState<InventorySource | 'all'>('all');
  const [tierFilter, setTierFilter] = useState<'all' | InventoryTier>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | InventoryStatus>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

  const { items, loading, error, stats } = useInventory();
  const { selectableCategories, bySlug: categoryBySlug } = useCategories();
  const {
    expandedIds,
    childrenMap,
    loadingIds,
    toggleExpand,
    getStockRollup,
    getCostRange,
  } = useExpandableChildren();

  // Precompute stock rollups for all parent items from loaded children
  const parentStockRollup = useMemo(() => {
    const rollup = new Map<string, number>();
    for (const item of items) {
      const parentId = item.familyId || item.parentItemId;
      if (parentId) {
        rollup.set(parentId, (rollup.get(parentId) || 0) + (item.inStock || 0));
      }
    }
    return rollup;
  }, [items]);

  // Filter items — hide children (they render inline when parent is expanded)
  const filteredItems = useMemo(() => {
    let result = items;

    // Hide items that are children of a parent
    result = result.filter(item => !item.parentItemId && !item.familyId);

    // Search filter — spans products and materials across SKU, name, brand,
    // tags, classification, subcategory, and category label.
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter((item) => {
        const it = item as InventoryListItem & {
          brand?: string;
          tags?: string[];
          classification?: string;
          subcategory?: string;
          description?: string;
        };
        const categoryLabel = categoryBySlug.get(it.category)?.name?.toLowerCase() ?? '';
        return (
          it.sku.toLowerCase().includes(term) ||
          it.name.toLowerCase().includes(term) ||
          (it.displayName?.toLowerCase().includes(term) ?? false) ||
          (it.brand?.toLowerCase().includes(term) ?? false) ||
          (it.subcategory?.toLowerCase().includes(term) ?? false) ||
          (it.classification?.toLowerCase().includes(term) ?? false) ||
          (it.description?.toLowerCase().includes(term) ?? false) ||
          categoryLabel.includes(term) ||
          (it.tags?.some((t) => t.toLowerCase().includes(term)) ?? false)
        );
      });
    }

    // Category filter
    if (categoryFilter !== 'all') {
      result = result.filter((item) => item.category === categoryFilter);
    }

    // Source filter
    if (sourceFilter !== 'all') {
      result = result.filter((item) => item.source === sourceFilter);
    }

    // Tier filter
    if (tierFilter !== 'all') {
      result = result.filter((item) => item.tier === tierFilter);
    }

    // Status filter
    if (statusFilter !== 'all') {
      result = result.filter((item) => item.status === statusFilter);
    }

    return result;
  }, [items, searchTerm, categoryFilter, sourceFilter, tierFilter, statusFilter, categoryBySlug]);

  // Pagination
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage);
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredItems.slice(start, start + itemsPerPage);
  }, [filteredItems, currentPage, itemsPerPage]);

  // Reset to page 1 when filters change
  const resetPage = () => setCurrentPage(1);

  // Checkbox header indeterminate state (include expanded children)
  const paginatedVisibleIds = useMemo(() => {
    const ids: string[] = [];
    for (const item of paginatedItems) {
      ids.push(item.id);
      if (expandedIds.has(item.id)) {
        const children = childrenMap[item.id] || [];
        for (const child of children) {
          ids.push(child.id);
        }
      }
    }
    return ids;
  }, [paginatedItems, expandedIds, childrenMap]);
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
            <Database className="w-5 h-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Inventory</h2>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Unified material library - single source of truth for pricing and stock
          </p>
        </div>

        {showActions && (
          <div className="flex items-center gap-2">
            {onAddItem && (
              <button
                onClick={onAddItem}
                className="flex items-center gap-2 px-3 py-2 bg-primary text-white rounded-lg text-sm hover:bg-primary/90"
              >
                <Plus className="w-4 h-4" />
                Add Item
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      <KPIGrid cols={3}>
        <KPICard label="Total Items" value={stats.total} />
        <KPICard label="Manual" value={stats.bySource.manual} />
        <KPICard label="From Parts" value={stats.bySource['parts-promotion']} />
      </KPIGrid>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); resetPage(); }}
            placeholder="Search products and materials by SKU, name, brand, tag, category…"
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
                {cat.icon ? `${cat.icon} ` : ''}{cat.name}
              </option>
            ))}
          </select>

          <select
            value={sourceFilter}
            onChange={(e) => { setSourceFilter(e.target.value as InventorySource | 'all'); resetPage(); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Sources</option>
            {Object.entries(INVENTORY_SOURCE_LABELS).map(([key, { label }]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={tierFilter}
            onChange={(e) => { setTierFilter(e.target.value as 'all' | InventoryTier); resetPage(); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Tiers</option>
            <option value="catalogue">Catalogue</option>
            <option value="project">Project</option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value as 'all' | InventoryStatus); resetPage(); }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-1 focus:ring-primary"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="discontinued">Discontinued</option>
            <option value="out-of-stock">Out of Stock</option>
            <option value="archived">Archived</option>
          </select>

        </div>
      </div>

      {/* Error */}
      {error && (
        <Banner tone="danger" title="Couldn't load inventory" message={error.message} />
      )}

      {/* Loading */}
      {loading ? (
        <div className="text-center py-10" style={{ color: 'var(--fg-tertiary)' }}>
          Loading inventory…
        </div>
      ) : filteredItems.length === 0 ? (
        <div
          className="rounded-[10px] border p-12 text-center"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <Package
            className="w-9 h-9 mx-auto mb-2 opacity-40"
            style={{ color: 'var(--fg-tertiary)' }}
          />
          <h3 className="text-[14px] font-semibold" style={{ color: 'var(--fg-primary)' }}>
            No items found
          </h3>
          <p
            className="text-[12.5px] mt-1"
            style={{ color: 'var(--fg-secondary)' }}
          >
            {searchTerm ||
            categoryFilter !== 'all' ||
            sourceFilter !== 'all' ||
            tierFilter !== 'all' ||
            statusFilter !== 'all'
              ? 'Try adjusting your filters'
              : 'Add your first inventory item'}
          </p>
        </div>
      ) : (
        <div
          className="rounded-[10px] border overflow-x-auto shadow-[var(--shadow-sm)]"
          style={{
            backgroundColor: 'var(--bg-surface)',
            borderColor: 'var(--border-subtle)',
          }}
        >
          <table className="w-full border-collapse">
            <thead>
              <tr
                className="border-b"
                style={{
                  backgroundColor: 'var(--bg-sunken)',
                  borderColor: 'var(--border-default)',
                }}
              >
                <th className="px-2 py-2.5 w-8"></th>
                {selectionEnabled && (
                  <th className="px-3 py-2.5 w-10">
                    <input
                      ref={headerCheckRef}
                      type="checkbox"
                      checked={allPageSelected}
                      onChange={() => onToggleAll?.(paginatedVisibleIds)}
                      style={{ accentColor: 'var(--accent)' }}
                      className="h-4 w-4 rounded"
                    />
                  </th>
                )}
                {(
                  [
                    ['SKU', 'left'],
                    ['Name', 'left'],
                    ['Category', 'left'],
                    ['Source', 'left'],
                    ['In Stock', 'right'],
                    ['Unit Cost', 'right'],
                    ['Status', 'center'],
                  ] as const
                ).map(([label, align]) => (
                  <th
                    key={label}
                    className={`px-4 py-2.5 text-[10.5px] font-medium uppercase tracking-wider ${
                      align === 'right' ? 'text-right' : align === 'center' ? 'text-center' : 'text-left'
                    }`}
                    style={{ color: 'var(--fg-tertiary)' }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedItems.map((item) => {
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
                      onClick={() => (onItemClick || onSelectItem)?.(item)}
                      className={`hover:bg-gray-50 ${(onItemClick || onSelectItem) ? 'cursor-pointer' : ''} ${selectedIds?.has(item.id) ? 'bg-primary/5' : ''}`}
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
                        <div className="flex items-center gap-2">
                          <div className="font-medium text-gray-900">
                            {item.displayName || item.name}
                          </div>
                          {itemIsParent && childCount > 0 && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">
                              <GitBranch className="w-3 h-3" />
                              {childCount}
                            </span>
                          )}
                          {(item.vendorSourceCount ?? 0) > 0 && (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-teal-50 text-teal-700 rounded text-xs font-medium">
                              {item.vendorSourceCount} vendor{item.vendorSourceCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                        {item.thickness && (
                          <div className="text-xs text-gray-500">{item.thickness}mm</div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center gap-1 text-sm text-gray-600">
                          {categoryBySlug.get(item.category)?.icon ?? ''}
                          {categoryBySlug.get(item.category)?.name ?? item.category}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                            INVENTORY_SOURCE_LABELS[item.source as InventorySource]?.color
                          }`}
                        >
                          {INVENTORY_SOURCE_LABELS[item.source as InventorySource]?.label}
                        </span>
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
                      <td className="px-4 py-3 text-center">
                        <RagBadge
                          tone={
                            item.status === 'active'
                              ? 'green'
                              : item.status === 'discontinued'
                              ? 'na'
                              : 'amber'
                          }
                        >
                          {item.status === 'active' ? (
                            <CheckCircle className="w-3 h-3" />
                          ) : item.status === 'out-of-stock' ? (
                            <Clock className="w-3 h-3" />
                          ) : (
                            <AlertCircle className="w-3 h-3" />
                          )}
                          {item.status}
                        </RagBadge>
                      </td>
                    </tr>

                    {/* Expanded child rows */}
                    {isExpanded && children.map((child) => (
                      <tr
                        key={child.id}
                        onClick={() => (onItemClick || onSelectItem)?.({
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
                          parentItemId: child.parentItemId,
                          variantAttributes: child.variantAttributes,
                        } as InventoryListItem)}
                        className={`bg-indigo-50/30 hover:bg-indigo-50/60 cursor-pointer border-l-2 border-indigo-200 ${
                          selectedIds?.has(child.id) ? 'bg-primary/5' : ''
                        }`}
                      >
                        {/* Expand column — empty for children */}
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
                        <td className="px-4 py-2">
                          <span className="text-xs text-gray-500">
                            {categoryBySlug.get(child.category)?.name ?? child.category}
                          </span>
                        </td>
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
                        <td className="px-4 py-2 text-center">
                          <RagBadge
                            tone={
                              child.status === 'active'
                                ? 'green'
                                : child.status === 'discontinued'
                                ? 'red'
                                : 'na'
                            }
                          >
                            {child.status}
                          </RagBadge>
                        </td>
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
      {!loading && filteredItems.length > 0 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Showing {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredItems.length)} of {filteredItems.length} items
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

export default InventoryList;
