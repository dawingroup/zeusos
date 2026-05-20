/**
 * Client List
 * 
 * Displays a searchable, filterable list of advisory clients.
 */

import { useState, useMemo } from 'react';
import { Search, Plus, Building2, User } from 'lucide-react';

interface Client {
  id: string;
  name: string;
  type: 'institutional' | 'family_office' | 'individual' | 'sovereign';
  aum: number;
  portfolioCount: number;
  status: 'active' | 'prospect' | 'dormant';
  relationshipManager?: string;
  lastActivity?: Date;
}

interface ClientListProps {
  clients?: Client[];
  loading?: boolean;
  onClientClick?: (clientId: string) => void;
  onAddClient?: () => void;
}

export function ClientList({
  clients = [],
  loading = false,
  onClientClick,
  onAddClient,
}: ClientListProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<Client['type'] | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<Client['status'] | 'all'>('all');
  
  const filteredClients = useMemo(() => {
    let result = [...clients];
    
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.relationshipManager?.toLowerCase().includes(query)
      );
    }
    
    if (typeFilter !== 'all') {
      result = result.filter((c) => c.type === typeFilter);
    }
    
    if (statusFilter !== 'all') {
      result = result.filter((c) => c.status === statusFilter);
    }
    
    return result;
  }, [clients, searchQuery, typeFilter, statusFilter]);
  
  if (loading) {
    return <ClientListSkeleton />;
  }
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Clients</h2>
          <p className="text-sm text-gray-500">{clients.length} total clients</p>
        </div>
        
        <button
          onClick={onAddClient}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Client
        </button>
      </div>
      
      {/* Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as Client['type'] | 'all')}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Types</option>
          <option value="institutional">Institutional</option>
          <option value="family_office">Family Office</option>
          <option value="individual">Individual</option>
          <option value="sovereign">Sovereign</option>
        </select>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as Client['status'] | 'all')}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active</option>
          <option value="prospect">Prospect</option>
          <option value="dormant">Dormant</option>
        </select>
      </div>
      
      {/* Client Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredClients.map((client) => (
          <ClientCard
            key={client.id}
            client={client}
            onClick={() => onClientClick?.(client.id)}
          />
        ))}
        
        {filteredClients.length === 0 && (
          <div className="col-span-full text-center py-12 text-gray-500">
            No clients found matching your criteria
          </div>
        )}
      </div>
    </div>
  );
}

interface ClientCardProps {
  client: Client;
  onClick?: () => void;
}

function ClientCard({ client, onClick }: ClientCardProps) {
  const typeIcons: Record<Client['type'], React.ReactNode> = {
    institutional: <Building2 className="h-5 w-5" />,
    family_office: <Building2 className="h-5 w-5" />,
    individual: <User className="h-5 w-5" />,
    sovereign: <Building2 className="h-5 w-5" />,
  };
  
  const statusColors: Record<Client['status'], string> = {
    active: 'bg-green-100 text-green-800',
    prospect: 'bg-blue-100 text-blue-800',
    dormant: 'bg-gray-100 text-gray-800',
  };
  
  return (
    <div
      className="bg-white rounded-lg border shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gray-100 rounded-lg">
            {typeIcons[client.type]}
          </div>
          <div>
            <h3 className="font-medium text-gray-900">{client.name}</h3>
            <p className="text-sm text-gray-500 capitalize">
              {client.type.replace('_', ' ')}
            </p>
          </div>
        </div>
        
        <span className={`px-2 py-0.5 text-xs rounded-full ${statusColors[client.status]}`}>
          {client.status}
        </span>
      </div>
      
      <div className="mt-4 pt-4 border-t grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-gray-500">AUM</p>
          <p className="font-medium">{formatCurrency(client.aum)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500">Portfolios</p>
          <p className="font-medium">{client.portfolioCount}</p>
        </div>
      </div>
      
      {client.relationshipManager && (
        <div className="mt-3 pt-3 border-t">
          <p className="text-xs text-gray-500">
            RM: {client.relationshipManager}
          </p>
        </div>
      )}
    </div>
  );
}

function ClientListSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-10 bg-gray-200 rounded w-1/4" />
      <div className="h-10 bg-gray-200 rounded w-1/2" />
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="h-40 bg-gray-200 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

export default ClientList;
