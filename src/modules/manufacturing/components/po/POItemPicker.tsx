/**
 * POItemPicker
 * Unified autocomplete picker for searching inventory items, materials, and products.
 * Follows the SupplierPicker pattern with grouped results by source.
 */

import { useEffect, useState, useRef } from 'react';
import { Search, ChevronDown, X, Package, Layers, ShoppingBag, Link2 } from 'lucide-react';
import { usePOItemSearch } from '../../hooks/usePOItemSearch';
import type { UnifiedSearchResult } from '../../hooks/usePOItemSearch';

interface POItemPickerProps {
  /** Display value (item description) */
  value: string;
  /** Called when user types (for manual entry fallback) */
  onInputChange: (value: string) => void;
  /** Called when user selects an item from the dropdown */
  onSelect: (result: UnifiedSearchResult) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function POItemPicker({
  value,
  onInputChange,
  onSelect,
  placeholder = 'Search inventory, materials, products...',
  disabled = false,
  className = '',
}: POItemPickerProps) {
  const { results, loading, search, clear } = usePOItemSearch();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
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
    clear();
  };

  const handleClear = () => {
    onInputChange('');
    clear();
    inputRef.current?.focus();
  };

  const handleFocus = () => {
    if (value.trim().length >= 2) {
      search(value);
    }
    setIsOpen(true);
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
            <div className="p-3 text-center text-gray-500 text-sm">
              No items found. Type to use as description.
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
