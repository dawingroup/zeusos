/**
 * BOQ Item Selector Component
 * Allows selecting BOQ items from the Control BOQ for requisitions
 */

import { useState, useMemo } from 'react';
import {
  Search,
  ChevronDown,
  ChevronRight,
  Check,
  Plus,
  Minus,
  Package,
  Filter,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { ControlBOQItem, getAvailableQuantity, BOQ_ITEM_STATUS_CONFIG } from '../../types/control-boq';
import { SelectedBOQItem } from '../../hooks/boq-hooks';

interface BOQItemSelectorProps {
  items: ControlBOQItem[];
  selectedItems: SelectedBOQItem[];
  loading?: boolean;
  error?: Error | null;
  onSelectItem: (item: ControlBOQItem, quantity?: number) => void;
  onDeselectItem: (itemId: string) => void;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  isSelected: (itemId: string) => boolean;
  getSelectedQuantity: (itemId: string) => number;
}

type GroupBy = 'bill' | 'section' | 'none';

function formatCurrency(amount: number, currency: string = 'UGX'): string {
  if (amount >= 1000000) return `${currency} ${(amount / 1000000).toFixed(2)}M`;
  if (amount >= 1000) return `${currency} ${(amount / 1000).toFixed(1)}K`;
  return `${currency} ${amount.toLocaleString()}`;
}

interface BOQItemRowProps {
  item: ControlBOQItem;
  isSelected: boolean;
  selectedQuantity: number;
  onSelect: () => void;
  onDeselect: () => void;
  onUpdateQuantity: (qty: number) => void;
}

function BOQItemRow({
  item,
  isSelected,
  selectedQuantity,
  onSelect,
  onDeselect,
  onUpdateQuantity,
}: BOQItemRowProps) {
  const availableQty = getAvailableQuantity(item);
  const statusConfig = BOQ_ITEM_STATUS_CONFIG[item.status] || { label: item.status || 'Unknown', color: 'gray' };

  return (
    <div className={`border rounded-lg p-3 transition-colors ${
      isSelected ? 'bg-primary/5 border-primary' : 'bg-white hover:bg-gray-50'
    }`}>
      <div className="flex items-start gap-3">
        {/* Selection checkbox */}
        <button
          onClick={isSelected ? onDeselect : onSelect}
          className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 ${
            isSelected 
              ? 'bg-primary border-primary text-white' 
              : 'border-gray-300 hover:border-primary'
          }`}
        >
          {isSelected && <Check className="w-3 h-3" />}
        </button>

        {/* Item details */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-gray-500">{item.itemCode}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${
              statusConfig.color === 'gray' ? 'bg-gray-100 text-gray-600' :
              statusConfig.color === 'blue' ? 'bg-blue-100 text-blue-600' :
              statusConfig.color === 'purple' ? 'bg-purple-100 text-purple-600' :
              statusConfig.color === 'yellow' ? 'bg-yellow-100 text-yellow-600' :
              statusConfig.color === 'green' ? 'bg-green-100 text-green-600' :
              'bg-gray-100 text-gray-600'
            }`}>
              {statusConfig.label}
            </span>
          </div>
          <p className="text-sm text-gray-900 line-clamp-2">{item.description}</p>
          {item.specification && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-1">{item.specification}</p>
          )}
          
          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span>Available: <strong>{availableQty}</strong> {item.unit}</span>
            <span>Rate: {formatCurrency(item.rate)}/{item.unit}</span>
          </div>
        </div>

        {/* Quantity selector (when selected) */}
        {isSelected && (
          <div className="flex-shrink-0">
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => onUpdateQuantity(Math.max(1, selectedQuantity - 1))}
                className="p-1 hover:bg-gray-200 rounded"
                disabled={selectedQuantity <= 1}
              >
                <Minus className="w-4 h-4" />
              </button>
              <input
                type="number"
                value={selectedQuantity}
                onChange={(e) => onUpdateQuantity(parseInt(e.target.value) || 1)}
                className="w-16 text-center text-sm bg-white border rounded py-1"
                min={1}
                max={availableQty}
              />
              <button
                onClick={() => onUpdateQuantity(Math.min(availableQty, selectedQuantity + 1))}
                className="p-1 hover:bg-gray-200 rounded"
                disabled={selectedQuantity >= availableQty}
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-center mt-1 text-gray-500">
              {formatCurrency(selectedQuantity * item.rate)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

interface GroupHeaderProps {
  title: string;
  count: number;
  selectedCount: number;
  isExpanded: boolean;
  onToggle: () => void;
}

function GroupHeader({ title, count, selectedCount, isExpanded, onToggle }: GroupHeaderProps) {
  return (
    <button
      onClick={onToggle}
      className="w-full flex items-center gap-2 p-3 bg-gray-50 hover:bg-gray-100 rounded-lg"
    >
      {isExpanded ? (
        <ChevronDown className="w-4 h-4 text-gray-500" />
      ) : (
        <ChevronRight className="w-4 h-4 text-gray-500" />
      )}
      <span className="font-medium text-gray-900">{title}</span>
      <span className="text-xs text-gray-500">
        {count} items
        {selectedCount > 0 && (
          <span className="text-primary ml-1">({selectedCount} selected)</span>
        )}
      </span>
    </button>
  );
}

export function BOQItemSelector({
  items,
  selectedItems,
  loading,
  error,
  onSelectItem,
  onDeselectItem,
  onUpdateQuantity,
  isSelected,
  getSelectedQuantity,
}: BOQItemSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [groupBy, setGroupBy] = useState<GroupBy>('bill');
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [showOnlyAvailable, setShowOnlyAvailable] = useState(true);

  // Filter items
  const filteredItems = useMemo(() => {
    let result = [...items];

    if (showOnlyAvailable) {
      result = result.filter(item => getAvailableQuantity(item) > 0);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item =>
        item.description.toLowerCase().includes(query) ||
        item.itemCode.toLowerCase().includes(query) ||
        item.billName?.toLowerCase().includes(query) ||
        item.sectionName?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [items, searchQuery, showOnlyAvailable]);

  // Group items
  const groupedItems = useMemo(() => {
    if (groupBy === 'none') {
      return { 'All Items': filteredItems };
    }

    return filteredItems.reduce((groups, item) => {
      const key = groupBy === 'bill'
        ? item.billName || item.billNumber || 'Uncategorized'
        : item.sectionName || item.sectionCode || 'Uncategorized';
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
      return groups;
    }, {} as Record<string, ControlBOQItem[]>);
  }, [filteredItems, groupBy]);

  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(group)) {
        next.delete(group);
      } else {
        next.add(group);
      }
      return next;
    });
  };

  // Expand all groups initially
  useMemo(() => {
    setExpandedGroups(new Set(Object.keys(groupedItems)));
  }, [Object.keys(groupedItems).join(',')]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-gray-600">Loading BOQ items...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
        <AlertCircle className="w-5 h-5 text-red-500" />
        <span className="text-red-700">{error.message}</span>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No BOQ Items</h3>
        <p className="text-gray-600">
          This project doesn't have a Control BOQ yet. Import one from MatFlow or add items manually.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by description, code, or section..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-lg bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as GroupBy)}
            className="px-3 py-2 border rounded-lg bg-white text-sm"
          >
            <option value="bill">Group by Bill</option>
            <option value="section">Group by Section</option>
            <option value="none">No Grouping</option>
          </select>

          <label className="flex items-center gap-2 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={showOnlyAvailable}
              onChange={(e) => setShowOnlyAvailable(e.target.checked)}
              className="rounded border-gray-300"
            />
            Available only
          </label>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-500">
        {filteredItems.length} items
        {selectedItems.length > 0 && (
          <span className="text-primary ml-2">
            ({selectedItems.length} selected, {formatCurrency(
              selectedItems.reduce((sum, s) => sum + s.quantityRequested * s.item.rate, 0)
            )} total)
          </span>
        )}
      </div>

      {/* Grouped Items */}
      <div className="space-y-3">
        {Object.entries(groupedItems).map(([groupName, groupItems]) => {
          const isExpanded = expandedGroups.has(groupName);
          const selectedCount = groupItems.filter(item => isSelected(item.id)).length;

          return (
            <div key={groupName} className="border rounded-lg overflow-hidden">
              <GroupHeader
                title={groupName}
                count={groupItems.length}
                selectedCount={selectedCount}
                isExpanded={isExpanded}
                onToggle={() => toggleGroup(groupName)}
              />

              {isExpanded && (
                <div className="p-3 space-y-2 bg-white">
                  {groupItems.map(item => (
                    <BOQItemRow
                      key={item.id}
                      item={item}
                      isSelected={isSelected(item.id)}
                      selectedQuantity={getSelectedQuantity(item.id)}
                      onSelect={() => onSelectItem(item)}
                      onDeselect={() => onDeselectItem(item.id)}
                      onUpdateQuantity={(qty) => onUpdateQuantity(item.id, qty)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {filteredItems.length === 0 && searchQuery && (
        <div className="text-center py-8 text-gray-500">
          No items match your search. Try different keywords.
        </div>
      )}
    </div>
  );
}

export default BOQItemSelector;
