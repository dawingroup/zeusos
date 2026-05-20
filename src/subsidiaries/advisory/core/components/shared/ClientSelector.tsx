/**
 * CLIENT SELECTOR
 * 
 * Searchable dropdown for selecting clients with type filtering.
 */

import React, { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { 
  Search, 
  Building2, 
  User, 
  Globe, 
  Landmark,
  ChevronDown,
  X,
  Plus,
  Check,
  TrendingUp,
} from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

type ClientType = 
  | 'government' 
  | 'ngo' 
  | 'corporate' 
  | 'individual'
  | 'faith_based'
  | 'healthcare'
  | 'educational'
  | 'dfi'
  | 'multilateral'
  | 'bilateral'
  | 'foundation'
  | 'private_equity'
  | 'family_office'
  | 'sovereign_wealth'
  | 'pension_fund'
  | 'insurance';

interface Client {
  id: string;
  name: string;
  shortName?: string;
  type: ClientType;
  logo?: string;
  country?: string;
  registrationNumber?: string;
}

interface ClientSelectorProps {
  value?: Client | null;
  onChange: (client: Client | null) => void;
  clients: Client[];
  loading?: boolean;
  error?: string;
  placeholder?: string;
  disabled?: boolean;
  allowCreate?: boolean;
  onCreateNew?: () => void;
  filterTypes?: ClientType[];
  className?: string;
}

interface ClientOptionProps {
  client: Client;
  selected: boolean;
  onSelect: (client: Client) => void;
}

// ============================================================================
// Configuration
// ============================================================================

const CLIENT_TYPE_CONFIG: Record<ClientType, { icon: React.ElementType; label: string; color: string }> = {
  government: { icon: Landmark, label: 'Government', color: 'text-blue-600' },
  ngo: { icon: Globe, label: 'NGO', color: 'text-green-600' },
  corporate: { icon: Building2, label: 'Corporate', color: 'text-purple-600' },
  individual: { icon: User, label: 'Individual', color: 'text-gray-600' },
  faith_based: { icon: Building2, label: 'Faith-based', color: 'text-amber-600' },
  healthcare: { icon: Building2, label: 'Healthcare', color: 'text-red-600' },
  educational: { icon: Building2, label: 'Educational', color: 'text-indigo-600' },
  dfi: { icon: Landmark, label: 'DFI', color: 'text-cyan-600' },
  multilateral: { icon: Globe, label: 'Multilateral', color: 'text-teal-600' },
  bilateral: { icon: Landmark, label: 'Bilateral', color: 'text-sky-600' },
  foundation: { icon: Building2, label: 'Foundation', color: 'text-pink-600' },
  private_equity: { icon: TrendingUp, label: 'Private Equity', color: 'text-emerald-600' },
  family_office: { icon: User, label: 'Family Office', color: 'text-violet-600' },
  sovereign_wealth: { icon: Landmark, label: 'Sovereign Wealth', color: 'text-orange-600' },
  pension_fund: { icon: Building2, label: 'Pension Fund', color: 'text-rose-600' },
  insurance: { icon: Building2, label: 'Insurance', color: 'text-lime-600' },
};

// ============================================================================
// Sub-components
// ============================================================================

const ClientTypeBadge: React.FC<{ type: ClientType; size?: 'sm' | 'md' }> = ({ 
  type, 
  size = 'sm' 
}) => {
  const config = CLIENT_TYPE_CONFIG[type] || CLIENT_TYPE_CONFIG.corporate;
  const Icon = config.icon;
  
  return (
    <span className={`
      inline-flex items-center gap-1 
      ${size === 'sm' ? 'text-xs' : 'text-sm'} 
      ${config.color}
    `}>
      <Icon className={size === 'sm' ? 'w-3 h-3' : 'w-4 h-4'} />
      <span>{config.label}</span>
    </span>
  );
};

const ClientOption: React.FC<ClientOptionProps> = ({ client, selected, onSelect }) => {
  return (
    <button
      type="button"
      onClick={() => onSelect(client)}
      className={`
        w-full px-3 py-2 flex items-center gap-3 text-left hover:bg-gray-50
        ${selected ? 'bg-blue-50' : ''}
      `}
    >
      <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
        {client.logo ? (
          <img src={client.logo} alt="" className="w-full h-full rounded-full object-cover" />
        ) : (
          <Building2 className="w-5 h-5 text-gray-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-900 truncate">{client.name}</div>
        <div className="flex items-center gap-2">
          <ClientTypeBadge type={client.type} />
          {client.country && (
            <span className="text-xs text-gray-500">{client.country}</span>
          )}
        </div>
      </div>
      {selected && (
        <Check className="w-5 h-5 text-blue-600 flex-shrink-0" />
      )}
    </button>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const ClientSelector: React.FC<ClientSelectorProps> = ({
  value,
  onChange,
  clients,
  loading = false,
  error,
  placeholder = 'Select a client...',
  disabled = false,
  allowCreate = false,
  onCreateNew,
  filterTypes,
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Filter clients
  const filteredClients = useMemo(() => {
    let result = clients;
    
    // Filter by type
    if (filterTypes && filterTypes.length > 0) {
      result = result.filter(c => filterTypes.includes(c.type));
    }
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c => 
        c.name.toLowerCase().includes(term) ||
        c.shortName?.toLowerCase().includes(term) ||
        c.registrationNumber?.toLowerCase().includes(term)
      );
    }
    
    return result;
  }, [clients, filterTypes, searchTerm]);
  
  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  // Focus input when opening
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);
  
  // Handle select
  const handleSelect = useCallback((client: Client) => {
    onChange(client);
    setIsOpen(false);
    setSearchTerm('');
  }, [onChange]);
  
  // Handle clear
  const handleClear = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null);
  }, [onChange]);
  
  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        className={`
          w-full px-3 py-2 border rounded-lg text-left flex items-center gap-2
          ${disabled ? 'bg-gray-50 cursor-not-allowed' : 'bg-white hover:border-gray-400'}
          ${isOpen ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-300'}
          ${error ? 'border-red-500' : ''}
        `}
      >
        {value ? (
          <>
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center">
              {value.logo ? (
                <img src={value.logo} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <Building2 className="w-4 h-4 text-gray-400" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-medium text-gray-900 truncate">{value.name}</div>
              <ClientTypeBadge type={value.type} />
            </div>
            <button
              type="button"
              onClick={handleClear}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </>
        ) : (
          <>
            <Search className="w-4 h-4 text-gray-400" />
            <span className="flex-1 text-gray-500">{placeholder}</span>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </>
        )}
      </button>
      
      {/* Error message */}
      {error && (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      )}
      
      {/* Dropdown */}
      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {/* Search input */}
          <div className="p-2 border-b border-gray-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search clients..."
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
          
          {/* Options */}
          <div className="max-h-64 overflow-y-auto">
            {loading ? (
              <div className="p-4 text-center text-gray-500">
                Loading clients...
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="p-4 text-center text-gray-500">
                No clients found
              </div>
            ) : (
              filteredClients.map((client) => (
                <ClientOption
                  key={client.id}
                  client={client}
                  selected={value?.id === client.id}
                  onSelect={handleSelect}
                />
              ))
            )}
          </div>
          
          {/* Create new option */}
          {allowCreate && onCreateNew && (
            <div className="p-2 border-t border-gray-100">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(false);
                  onCreateNew();
                }}
                className="w-full px-3 py-2 flex items-center gap-2 text-blue-600 hover:bg-blue-50 rounded-md"
              >
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">Create new client</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ClientSelector;
