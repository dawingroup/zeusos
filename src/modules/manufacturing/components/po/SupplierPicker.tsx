/**
 * SupplierPicker
 * Autocomplete component for searching and selecting suppliers
 * Supports subsidiary-specific supplier databases
 */

import { useEffect, useState, useRef } from 'react';
import { Search, ChevronDown, X, Star } from 'lucide-react';
import type { Supplier } from '@/subsidiaries/advisory/matflow/types/supplier';
import { useSupplierPicker } from '../../hooks/useSupplierPicker';

interface SupplierPickerProps {
  value: { supplierId: string; supplierName: string } | null;
  onChange: (value: { supplierId: string; supplierName: string } | null) => void;
  subsidiaryId?: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
}

export function SupplierPicker({
  value,
  onChange,
  subsidiaryId,
  label = 'Supplier',
  placeholder = 'Search suppliers...',
  disabled = false,
  error,
}: SupplierPickerProps) {
  const { suppliers, loading, search, loadAll } = useSupplierPicker({ subsidiaryId });
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load suppliers on mount
  useEffect(() => {
    loadAll();
  }, [loadAll]);

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

  // Sync input value when the selected value changes externally
  // (NOT when suppliers list changes — that would erase user typing)
  useEffect(() => {
    if (value) {
      setInputValue(value.supplierName || '');
    } else {
      setInputValue('');
    }
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    search(newValue);
    setIsOpen(true);
  };

  const handleSelect = (supplier: Supplier) => {
    onChange({ supplierId: supplier.id, supplierName: supplier.name });
    setInputValue(supplier.name);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setInputValue('');
    search('');
    inputRef.current?.focus();
  };

  const selectedSupplier = value ? suppliers.find((s) => s.id === value.supplierId) : null;

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      )}
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <Search className="h-4 w-4 text-gray-400" />
        </div>
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          placeholder={placeholder}
          disabled={disabled}
          className={`w-full pl-9 pr-16 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-gray-100 disabled:cursor-not-allowed ${
            error ? 'border-red-300' : 'border-gray-200'
          }`}
        />
        <div className="absolute inset-y-0 right-0 flex items-center pr-2 gap-1">
          {value && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              <X className="h-4 w-4 text-gray-400" />
            </button>
          )}
          <button
            type="button"
            onClick={() => !disabled && setIsOpen(!isOpen)}
            disabled={disabled}
            className="p-1 hover:bg-gray-100 rounded transition-colors disabled:cursor-not-allowed"
          >
            <ChevronDown
              className={`h-4 w-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            />
          </button>
        </div>
      </div>

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}

      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 mt-1 w-full bg-white rounded-lg shadow-lg border border-gray-200 max-h-60 overflow-auto">
          {loading ? (
            <div className="p-3 text-center text-gray-500 text-sm">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary mx-auto"></div>
            </div>
          ) : suppliers.length === 0 ? (
            <div className="p-3 text-center text-gray-500 text-sm">
              {inputValue ? 'No suppliers found' : 'No suppliers available'}
            </div>
          ) : (
            <ul className="py-1">
              {suppliers.map((supplier) => {
                const isSelected = selectedSupplier?.id === supplier.id;
                return (
                  <li
                    key={supplier.id}
                    onClick={() => handleSelect(supplier)}
                    className={`px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors ${
                      isSelected ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {supplier.name || supplier.code}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {supplier.contactPerson && `${supplier.contactPerson} — `}
                          {supplier.phone}
                          {supplier.address?.city && ` — ${supplier.address.city}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                        {supplier.rating != null && supplier.rating > 0 && (
                          <span
                            className={`flex items-center gap-0.5 px-1.5 py-0.5 text-xs rounded-full ${
                              supplier.rating >= 4
                                ? 'bg-green-100 text-green-700'
                                : supplier.rating >= 3
                                  ? 'bg-yellow-100 text-yellow-700'
                                  : 'bg-red-100 text-red-700'
                            }`}
                          >
                            <Star className="h-3 w-3" />
                            {supplier.rating.toFixed(1)}
                          </span>
                        )}
                        <span
                          className={`px-1.5 py-0.5 text-xs rounded-full ${
                            supplier.status === 'active'
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {supplier.status}
                        </span>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
