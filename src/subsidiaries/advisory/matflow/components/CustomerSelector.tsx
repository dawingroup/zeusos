/**
 * Customer Selector Component
 * Searchable dropdown for selecting customers
 */

import React, { useState, useRef, useEffect } from 'react';
import { Search, Building2, User, ChevronDown, X, Loader2 } from 'lucide-react';
import { useCustomerSearch } from '../hooks/useCustomers';
import type { MatFlowCustomerSummary } from '../types/customer';

interface CustomerSelectorProps {
  value: MatFlowCustomerSummary | null;
  onChange: (customer: MatFlowCustomerSummary | null) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: string;
}

export const CustomerSelector: React.FC<CustomerSelectorProps> = ({
  value,
  onChange,
  placeholder = 'Search customers...',
  disabled = false,
  error,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { results, isSearching, search, clear } = useCustomerSearch();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      search(searchTerm);
    }, 300);
    
    return () => clearTimeout(timer);
  }, [searchTerm, search]);
  
  const handleSelect = (customer: MatFlowCustomerSummary) => {
    onChange(customer);
    setIsOpen(false);
    setSearchTerm('');
    clear();
  };
  
  const handleClear = () => {
    onChange(null);
    setSearchTerm('');
    clear();
  };
  
  const getCustomerIcon = (type: string) => {
    switch (type) {
      case 'company':
      case 'government':
      case 'ngo':
        return <Building2 className="w-4 h-4" />;
      default:
        return <User className="w-4 h-4" />;
    }
  };
  
  return (
    <div ref={containerRef} className="relative">
      {/* Selected Value or Search Input */}
      <div
        className={`
          flex items-center border rounded-lg px-3 py-2 bg-white
          ${disabled ? 'bg-gray-50 cursor-not-allowed' : 'cursor-pointer'}
          ${error ? 'border-red-300' : 'border-gray-300'}
          ${isOpen ? 'ring-2 ring-blue-500 border-blue-500' : ''}
        `}
        onClick={() => !disabled && setIsOpen(true)}
      >
        {value ? (
          <>
            <div className="flex items-center gap-2 flex-1">
              {getCustomerIcon(value.type)}
              <div className="flex-1 truncate">
                <span className="font-medium">{value.name}</span>
                <span className="text-gray-500 text-sm ml-2">({value.code})</span>
              </div>
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleClear();
              }}
              className="p-1 hover:bg-gray-100 rounded"
              disabled={disabled}
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </>
        ) : (
          <>
            <Search className="w-4 h-4 text-gray-400 mr-2" />
            <input
              ref={inputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={placeholder}
              className="flex-1 outline-none bg-transparent"
              disabled={disabled}
              onFocus={() => setIsOpen(true)}
            />
            <ChevronDown className="w-4 h-4 text-gray-400" />
          </>
        )}
      </div>
      
      {/* Error Message */}
      {error && (
        <p className="text-red-500 text-sm mt-1">{error}</p>
      )}
      
      {/* Dropdown */}
      {isOpen && !disabled && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {isSearching ? (
            <div className="flex items-center justify-center p-4 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Searching...
            </div>
          ) : results.length > 0 ? (
            <ul>
              {results.map((customer) => (
                <li
                  key={customer.id}
                  onClick={() => handleSelect(customer)}
                  className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
                >
                  {getCustomerIcon(customer.type)}
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{customer.name}</div>
                    <div className="text-sm text-gray-500 truncate">
                      {customer.code}
                      {customer.district && ` • ${customer.district}`}
                    </div>
                  </div>
                  {customer.advisoryStats && (
                    <span className="text-xs text-gray-400">
                      {customer.advisoryStats.totalProjects} projects
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : searchTerm.length >= 2 ? (
            <div className="p-4 text-center text-gray-500">
              No customers found
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500">
              Type at least 2 characters to search
            </div>
          )}
        </div>
      )}
    </div>
  );
};
