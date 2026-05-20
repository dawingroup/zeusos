/**
 * EngagementListPage
 * List all engagements with real Firestore data
 */

import { useState, useEffect } from 'react';
import { Helmet } from 'react-helmet-async';
import { Plus, Briefcase, Search, Filter, Calendar, Users, MapPin, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { EmptyState } from '@/shared/components/feedback/EmptyState';
import { EngagementService } from '@/subsidiaries/advisory/core/services/engagement/engagement-service';
import type { Engagement, EngagementStatus } from '@/subsidiaries/advisory/core/types';

const engagementService = EngagementService.getInstance();

const STATUS_COLORS: Record<EngagementStatus, string> = {
  prospect: 'bg-gray-100 text-gray-800',
  onboarding: 'bg-blue-100 text-blue-800',
  active: 'bg-green-100 text-green-800',
  on_hold: 'bg-orange-100 text-orange-800',
  closing: 'bg-yellow-100 text-yellow-800',
  completed: 'bg-emerald-100 text-emerald-800',
  terminated: 'bg-red-100 text-red-800',
};

export default function EngagementListPage() {
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadEngagements();
  }, []);

  const loadEngagements = async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await engagementService.listEngagements(
        {},
        { pageSize: 50, sortField: 'updatedAt', sortDirection: 'desc' }
      );
      setEngagements(result.data);
    } catch (err) {
      console.error('Failed to load engagements:', err);
      setError('Failed to load engagements. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const filteredEngagements = engagements.filter(e => 
    !searchTerm || 
    e.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.clientName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatDate = (timestamp: any) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  return (
    <>
      <Helmet>
        <title>Engagements | Dawin Advisory Platform</title>
      </Helmet>

      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Engagements</h1>
            <p className="text-muted-foreground">
              Manage all your programs, deals, and advisory mandates
            </p>
          </div>
          <Button asChild>
            <Link to="/engagements/new">
              <Plus className="mr-2 h-4 w-4" />
              New Engagement
            </Link>
          </Button>
        </div>

        {/* Search and Filters */}
        <div className="flex gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search engagements..."
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
            <Button variant="outline" size="sm" onClick={loadEngagements} className="mt-2">
              Retry
            </Button>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && filteredEngagements.length === 0 && (
          <EmptyState
            icon={Briefcase}
            title="No engagements yet"
            description="Get started by creating your first engagement"
            action={{
              label: 'Create Engagement',
              onClick: () => window.location.href = '/engagements/new',
            }}
          />
        )}

        {/* Engagements List */}
        {!loading && !error && filteredEngagements.length > 0 && (
          <div className="bg-white border rounded-lg divide-y">
            {filteredEngagements.map((engagement) => (
              <Link
                key={engagement.id}
                to={`/engagements/${engagement.id}`}
                className="block p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold text-gray-900">{engagement.name}</h3>
                      <span className="text-sm text-muted-foreground font-mono">{engagement.code}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[engagement.status]}`}>
                        {engagement.status.replace('_', ' ')}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground mb-2">{engagement.description || 'No description'}</p>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Users className="h-4 w-4" />
                        {engagement.clientName}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {engagement.country}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="h-4 w-4" />
                        {formatDate(engagement.createdAt)}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="inline-block px-2 py-1 bg-gray-100 rounded text-xs font-medium text-gray-700">
                      {engagement.domain}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}

        {/* Stats */}
        {!loading && engagements.length > 0 && (
          <div className="mt-4 text-sm text-muted-foreground">
            Showing {filteredEngagements.length} of {engagements.length} engagements
          </div>
        )}
      </div>
    </>
  );
}
