/**
 * ClientListPage
 * List all clients - shared across all subsidiaries
 * Clients are filtered based on recent engagements/projects with the current subsidiary
 */

import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Plus, Building2, Search, Filter, MapPin, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { getClients } from '@/subsidiaries/advisory/advisory/services/client-service';
import { useSubsidiary } from '@/contexts/SubsidiaryContext';
import type { ClientSummary, ClientStatus } from '@/subsidiaries/advisory/advisory/types';

const STATUS_COLORS: Record<ClientStatus, string> = {
  prospect: 'bg-gray-100 text-gray-800',
  onboarding: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  dormant: 'bg-yellow-100 text-yellow-800',
  suspended: 'bg-orange-100 text-orange-800',
  terminated: 'bg-red-100 text-red-800',
};

export default function ClientListPage() {
  const { currentSubsidiary } = useSubsidiary();
  const [clients, setClients] = useState<ClientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadClients();
  }, []);

  const loadClients = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getClients({ limit: 100 });
      setClients(data);
    } catch (err) {
      console.error('Failed to load clients:', err);
      setError('Failed to load clients. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredClients = clients.filter(c => 
    !searchTerm || 
    c.legalName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.tradingName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.clientCode.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <>
      <Helmet>
        <title>Clients | DawinOS</title>
      </Helmet>

      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Clients</h1>
            <p className="text-muted-foreground">
              Shared client database across all subsidiaries
              {currentSubsidiary && ` • Viewing from ${currentSubsidiary.name}`}
            </p>
          </div>
          <Button asChild>
            <Link to="/clients/new">
              <Plus className="mr-2 h-4 w-4" />
              New Client
            </Link>
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search clients..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button variant="outline">
            <Filter className="mr-2 h-4 w-4" />
            Filters
          </Button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
            <p className="text-red-800">{error}</p>
            <Button variant="outline" size="sm" onClick={loadClients} className="mt-2">
              Retry
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredClients.length === 0 && (
          <EmptyState
            icon={Building2}
            title="No clients yet"
            description="Get started by adding your first client"
            action={{ label: 'Add Client', onClick: () => window.location.href = '/clients/new' }}
          />
        )}

        {/* Clients Grid */}
        {!loading && !error && filteredClients.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClients.map((client) => (
              <Link
                key={client.id}
                to={`/clients/${client.id}`}
                className="block bg-white border rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-gray-900 truncate">{client.legalName}</h3>
                    {client.tradingName && (
                      <p className="text-sm text-muted-foreground truncate">{client.tradingName}</p>
                    )}
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[client.status]}`}>
                    {client.status}
                  </span>
                </div>

                <div className="space-y-1 text-sm text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5" />
                    <span>{client.jurisdiction}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5" />
                    <span className="capitalize">{client.clientType.replace('_', ' ')}</span>
                  </div>
                </div>

                <div className="mt-3 pt-3 border-t flex items-center justify-between text-xs">
                  <span className="text-muted-foreground font-mono">{client.clientCode}</span>
                  <span className="px-2 py-0.5 bg-gray-100 rounded text-gray-700 capitalize">
                    {client.tier}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Stats */}
        {!loading && clients.length > 0 && (
          <div className="mt-4 text-sm text-muted-foreground">
            Showing {filteredClients.length} of {clients.length} clients
          </div>
        )}
      </div>
    </>
  );
}
