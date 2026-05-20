/**
 * TransactableItemSelector
 * Shared item picker that ensures only SKU-level (transactable) items can be selected.
 * Used in POs, BOMs, stock adjustments, and sales orders.
 *
 * - Searches SKU-level records only by default
 * - Groups results by family with non-selectable headers
 * - If a family name is typed, shows "Select a specific variant" and expands variants
 * - Never allows selecting a family record
 */

import { useState, useRef, useEffect } from 'react';
import { Search, ChevronDown, Package, Layers, Loader2, AlertTriangle } from 'lucide-react';
import {
  useTransactableItemSearch,
  type TransactableSearchMode,
  type GroupedSearchResult,
} from '../hooks/useTransactableItemSearch';
import type { InventoryListItem, InventoryClassification } from '../types';

interface TransactableItemSelectorProps {
  mode: TransactableSearchMode;
  onSelect: (item: InventoryListItem) => void;
  classification?: InventoryClassification;
  placeholder?: string;
  disabled?: boolean;
}

export function TransactableItemSelector({
  mode,
  onSelect,
  classification,
  placeholder,
  disabled,
}: TransactableItemSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { results, loading, search, clear, expandFamily } =
    useTransactableItemSearch({ mode, classification });

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function handleInputChange(value: string) {
    setInputValue(value);
    if (value.trim().length >= 2) {
      search(value);
      setIsOpen(true);
    } else {
      clear();
      setIsOpen(false);
    }
  }

  function handleSelectItem(item: InventoryListItem) {
    onSelect(item);
    setInputValue('');
    clear();
    setIsOpen(false);
  }

  function handleFamilyHeaderClick(result: GroupedSearchResult) {
    if (result.familyId) {
      expandFamily(result.familyId);
    }
  }

  const defaultPlaceholder =
    mode === 'bom'
      ? 'Search BOM-selectable materials...'
      : mode === 'po'
        ? 'Search items for purchase order...'
        : 'Search inventory items...';

  // Check if we have only family headers and no SKUs (suggest expanding)
  const hasOnlyFamilies =
    results.length > 0 && results.every((r) => r.type === 'family-header');

  return (
    <div ref={containerRef} className="relative">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder={placeholder || defaultPlaceholder}
          disabled={disabled}
          className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-gray-50 disabled:cursor-not-allowed"
        />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-gray-400" />
        )}
      </div>

      {/* Results dropdown */}
      {isOpen && (results.length > 0 || loading) && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto">
          {/* Warning when only families match */}
          {hasOnlyFamilies && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border-b border-amber-100">
              <AlertTriangle className="h-4 w-4 text-amber-500 flex-shrink-0" />
              <span className="text-xs text-amber-700">
                Only family records match. Click a family to see its variants.
              </span>
            </div>
          )}

          {results.map((result, idx) => {
            if (result.type === 'family-header') {
              return (
                <div
                  key={`family-${result.familyId}-${idx}`}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-50 cursor-pointer hover:bg-gray-100"
                  onClick={() => handleFamilyHeaderClick(result)}
                >
                  <Layers className="h-3.5 w-3.5 text-blue-500" />
                  <span className="text-xs font-medium text-gray-700 flex-1">
                    {result.familyName}
                  </span>
                  <span className="text-xs text-gray-400">
                    {result.variantCount} variant
                    {result.variantCount !== 1 ? 's' : ''}
                  </span>
                  <ChevronDown className="h-3 w-3 text-gray-400" />
                </div>
              );
            }

            if (result.type === 'sku' && result.item) {
              const item = result.item;
              return (
                <button
                  key={item.id}
                  className={`flex items-center gap-3 w-full px-3 py-2 text-left hover:bg-blue-50 ${
                    result.familyId ? 'pl-8' : ''
                  }`}
                  onClick={() => handleSelectItem(item)}
                >
                  <Package className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-900 truncate">
                      {item.displayName || item.name}
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span className="font-mono">{item.sku}</span>
                      <span>
                        {(item.inStock ?? 0).toLocaleString()} in stock
                      </span>
                      {item.costPerUnit ? (
                        <span>
                          {item.currency || 'UGX'}{' '}
                          {item.costPerUnit.toLocaleString()}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            }

            return null;
          })}

          {loading && results.length === 0 && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            </div>
          )}

          {!loading && results.length === 0 && inputValue.trim().length >= 2 && (
            <div className="px-3 py-4 text-center text-xs text-gray-400">
              No matching items found
            </div>
          )}
        </div>
      )}
    </div>
  );
}
