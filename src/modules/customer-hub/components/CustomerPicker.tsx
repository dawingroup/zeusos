/**
 * CustomerPicker
 * Autocomplete component for searching and selecting customers
 * Mirrors the SupplierPicker pattern from manufacturing module
 */

import { useEffect, useState, useRef } from 'react';
import { Search, ChevronDown, X } from 'lucide-react';
import { useCustomerPicker } from '../hooks/useCustomerPicker';
import type { CustomerListItem } from '../types';

export interface CustomerPickerValue {
  customerId: string;
  customerName: string;
}

interface CustomerPickerProps {
  value: CustomerPickerValue | null;
  onChange: (value: CustomerPickerValue | null) => void;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
}

const typeColors: Record<string, string> = {
  residential: 'bg-blue-100 text-blue-700',
  commercial: 'bg-purple-100 text-purple-700',
  contractor: 'bg-amber-100 text-amber-700',
  designer: 'bg-pink-100 text-pink-700',
};

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-600',
  prospect: 'bg-yellow-100 text-yellow-700',
};

export function CustomerPicker({
  value,
  onChange,
  label = 'Customer',
  placeholder = 'Search customers...',
  disabled = false,
  error,
}: CustomerPickerProps) {
  const { customers, loading, search, loadAll } = useCustomerPicker();
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load customers on mount. `loadAll` now returns the Firestore
  // unsubscribe — keep the subscription live for the lifetime of the
  // picker so late server snapshots (which can arrive after cached
  // snapshots) populate the full list rather than leaving us stuck on
  // whatever was in the local cache.
  useEffect(() => {
    const unsubscribe = loadAll();
    return () => unsubscribe?.();
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

  // Sync input value from selected customer
  useEffect(() => {
    if (value) {
      const customer = customers.find((c) => c.id === value.customerId);
      setInputValue(customer?.name || value.customerName || '');
    } else {
      setInputValue('');
    }
  }, [value, customers]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setInputValue(newValue);
    search(newValue);
    setIsOpen(true);
  };

  const handleSelect = (customer: CustomerListItem) => {
    onChange({ customerId: customer.id, customerName: customer.name });
    setInputValue(customer.name);
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setInputValue('');
    search('');
    inputRef.current?.focus();
  };

  const selectedCustomer = value ? customers.find((c) => c.id === value.customerId) : null;

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
          ) : customers.length === 0 ? (
            <div className="p-3 text-center text-gray-500 text-sm">
              {inputValue ? 'No customers found' : 'No customers available'}
            </div>
          ) : (
            <ul className="py-1">
              {customers.map((customer) => {
                const isSelected = selectedCustomer?.id === customer.id;
                return (
                  <li
                    key={customer.id}
                    onClick={() => handleSelect(customer)}
                    className={`px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors ${
                      isSelected ? 'bg-primary/5' : ''
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-900 truncate">
                          {customer.name}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {customer.code}
                          {customer.email && ` — ${customer.email}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                        <span
                          className={`px-1.5 py-0.5 text-xs rounded-full ${
                            typeColors[customer.type] || 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {customer.type}
                        </span>
                        <span
                          className={`px-1.5 py-0.5 text-xs rounded-full ${
                            statusColors[customer.status] || 'bg-gray-100 text-gray-600'
                          }`}
                        >
                          {customer.status}
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
