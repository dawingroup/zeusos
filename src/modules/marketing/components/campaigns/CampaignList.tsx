/**
 * CampaignList Component
 * Displays filterable list of marketing campaigns with search and filters
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Megaphone, Calendar, Pause, Play, Check, X } from 'lucide-react';
import { useCampaigns } from '../../hooks';
import { useAuth } from '@/contexts/AuthContext';
import type { CampaignStatus, CampaignType } from '../../types';
import { CAMPAIGN_STATUS_LABELS, CAMPAIGN_TYPE_LABELS } from '../../constants';

const STATUS_CONFIG: Record<CampaignStatus, { bg: string; text: string; icon: any }> = {
  draft: { bg: 'bg-gray-100', text: 'text-gray-800', icon: null },
  scheduled: { bg: 'bg-blue-100', text: 'text-blue-800', icon: Calendar },
  active: { bg: 'bg-green-100', text: 'text-green-800', icon: Play },
  paused: { bg: 'bg-yellow-100', text: 'text-yellow-800', icon: Pause },
  completed: { bg: 'bg-purple-100', text: 'text-purple-800', icon: Check },
  cancelled: { bg: 'bg-red-100', text: 'text-red-800', icon: X },
};

interface CampaignListProps {
  onNewCampaign?: () => void;
}

export function CampaignList({ onNewCampaign }: CampaignListProps) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<CampaignType | ''>('');

  const { campaigns, loading, error } = useCampaigns(
    user?.companyId,
    {
      status: statusFilter || undefined,
      campaignType: typeFilter || undefined,
    }
  );

  // Client-side search filtering
  const filteredCampaigns = campaigns.filter((campaign) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      campaign.name.toLowerCase().includes(query) ||
      campaign.description?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        Error loading campaigns: {error.message}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Marketing Campaigns</h1>
          <p className="text-muted-foreground">Manage your marketing campaigns across channels</p>
        </div>
        <button
          onClick={onNewCampaign}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          New Campaign
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search campaigns..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CampaignStatus | '')}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">All Statuses</option>
            {Object.entries(CAMPAIGN_STATUS_LABELS).map(([value, config]) => (
              <option key={value} value={value}>
                {config.label}
              </option>
            ))}
          </select>

          {/* Type Filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as CampaignType | '')}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          >
            <option value="">All Types</option>
            {Object.entries(CAMPAIGN_TYPE_LABELS).map(([value, config]) => (
              <option key={value} value={value}>
                {config.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-gray-500">
        {filteredCampaigns.length} campaign{filteredCampaigns.length !== 1 ? 's' : ''}
      </div>

      {/* Campaign Grid */}
      {filteredCampaigns.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">No campaigns found</h3>
          <p className="text-gray-500 mt-1">
            {searchQuery || statusFilter || typeFilter
              ? 'Try adjusting your filters'
              : 'Create your first campaign to get started'}
          </p>
          {!searchQuery && !statusFilter && !typeFilter && (
            <button
              onClick={onNewCampaign}
              className="mt-4 text-primary hover:underline"
            >
              Create Campaign
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCampaigns.map((campaign) => {
            const statusConfig = STATUS_CONFIG[campaign.status];
            const StatusIcon = statusConfig.icon;
            const startDate = campaign.scheduledStartDate?.toDate();
            const endDate = campaign.scheduledEndDate?.toDate();

            return (
              <Link
                key={campaign.id}
                to={`/marketing/campaigns/${campaign.id}`}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{campaign.name}</h3>
                    <p className="text-sm text-gray-500">{CAMPAIGN_TYPE_LABELS[campaign.campaignType]?.label}</p>
                  </div>
                  <span
                    className={`flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full whitespace-nowrap ${statusConfig.bg} ${statusConfig.text}`}
                  >
                    {StatusIcon && <StatusIcon className="h-3 w-3" />}
                    {CAMPAIGN_STATUS_LABELS[campaign.status]?.label}
                  </span>
                </div>

                {/* Description */}
                {campaign.description && (
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                    {campaign.description}
                  </p>
                )}

                {/* Metrics */}
                <div className="grid grid-cols-2 gap-2 mb-3 text-sm">
                  <div className="bg-gray-50 rounded-lg p-2">
                    <div className="text-xs text-gray-500">Reach</div>
                    <div className="font-semibold text-gray-900">
                      {campaign.metrics.totalReached.toLocaleString()}
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-2">
                    <div className="text-xs text-gray-500">Engagement</div>
                    <div className="font-semibold text-gray-900">
                      {(campaign.metrics.engagementRate * 100).toFixed(1)}%
                    </div>
                  </div>
                </div>

                {/* Dates */}
                {startDate && (
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {startDate.toLocaleDateString()}
                      {endDate && ` - ${endDate.toLocaleDateString()}`}
                    </span>
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default CampaignList;
