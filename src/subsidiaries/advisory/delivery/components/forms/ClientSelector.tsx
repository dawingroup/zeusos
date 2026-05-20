/**
 * Client Selector - Search and select/add clients
 */

import { useState, useMemo } from 'react';
import { Search, Plus, X, Building2, User, Check } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  type: 'organization' | 'government' | 'ngo' | 'individual';
  country?: string;
  contactPerson?: string;
}

interface ClientSelectorProps {
  selectedClientId: string | null;
  onSelect: (clientId: string | null, client: Client | null) => void;
  onCreateNew?: () => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
}

// Mock clients for demonstration
const MOCK_CLIENTS: Client[] = [
  { id: 'cli-1', name: 'Ministry of Health Uganda', type: 'government', country: 'UG', contactPerson: 'Dr. Jane Aceng' },
  { id: 'cli-2', name: 'World Bank', type: 'organization', country: 'US', contactPerson: 'Regional Director' },
  { id: 'cli-3', name: 'USAID', type: 'government', country: 'US', contactPerson: 'Mission Director' },
  { id: 'cli-4', name: 'Ministry of Education Uganda', type: 'government', country: 'UG', contactPerson: 'PS Education' },
  { id: 'cli-5', name: 'UNDP Uganda', type: 'organization', country: 'UG', contactPerson: 'Country Director' },
  { id: 'cli-6', name: 'European Union Delegation', type: 'organization', country: 'EU', contactPerson: 'Head of Cooperation' },
];

const TYPE_ICONS = {
  organization: Building2,
  government: Building2,
  ngo: Building2,
  individual: User,
};

export function ClientSelector({
  selectedClientId,
  onSelect,
  onCreateNew,
  label = 'Client',
  placeholder = 'Search clients...',
  required = false,
}: ClientSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [clients] = useState<Client[]>(MOCK_CLIENTS);

  const selectedClient = useMemo(() => {
    return clients.find(c => c.id === selectedClientId) || null;
  }, [clients, selectedClientId]);

  const filteredClients = useMemo(() => {
    if (!searchQuery) return clients;
    const query = searchQuery.toLowerCase();
    return clients.filter(c =>
      c.name.toLowerCase().includes(query) ||
      c.contactPerson?.toLowerCase().includes(query)
    );
  }, [clients, searchQuery]);

  const handleSelect = (client: Client) => {
    onSelect(client.id, client);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = () => {
    onSelect(null, null);
  };

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>

      {/* Selected client display */}
      {selectedClient ? (
        <div className="flex items-center justify-between p-3 bg-gray-50 border rounded-lg">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Building2 className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <div className="font-medium text-gray-900">{selectedClient.name}</div>
              <div className="text-sm text-gray-500">
                {selectedClient.type} • {selectedClient.contactPerson}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="p-1 text-gray-400 hover:text-gray-600"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="w-full p-3 border border-dashed rounded-lg text-left text-gray-500 hover:border-gray-400 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4" />
            <span>{placeholder}</span>
          </div>
        </button>
      )}

      {/* Dropdown */}
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setIsOpen(false)} 
          />
          <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-lg border z-50 max-h-80 overflow-hidden">
            {/* Search input */}
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search clients..."
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  autoFocus
                />
              </div>
            </div>

            {/* Client list */}
            <div className="max-h-60 overflow-y-auto">
              {filteredClients.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No clients found
                </div>
              ) : (
                filteredClients.map(client => {
                  const Icon = TYPE_ICONS[client.type];
                  const isSelected = client.id === selectedClientId;
                  
                  return (
                    <button
                      key={client.id}
                      type="button"
                      onClick={() => handleSelect(client)}
                      className={`w-full flex items-center gap-3 p-3 hover:bg-gray-50 transition-colors ${
                        isSelected ? 'bg-blue-50' : ''
                      }`}
                    >
                      <div className={`p-2 rounded-lg ${isSelected ? 'bg-blue-100' : 'bg-gray-100'}`}>
                        <Icon className={`w-4 h-4 ${isSelected ? 'text-blue-600' : 'text-gray-500'}`} />
                      </div>
                      <div className="flex-1 text-left">
                        <div className="font-medium text-gray-900">{client.name}</div>
                        <div className="text-sm text-gray-500">
                          {client.type} • {client.contactPerson}
                        </div>
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-blue-600" />
                      )}
                    </button>
                  );
                })
              )}
            </div>

            {/* Create new button */}
            {onCreateNew && (
              <div className="p-2 border-t">
                <button
                  type="button"
                  onClick={() => {
                    setIsOpen(false);
                    onCreateNew();
                  }}
                  className="w-full flex items-center justify-center gap-2 p-2 text-primary hover:bg-primary/5 rounded-lg transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add New Client</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
