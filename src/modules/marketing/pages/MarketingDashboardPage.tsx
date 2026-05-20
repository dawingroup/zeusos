/**
 * MarketingDashboardPage
 * Overview dashboard with KPIs and recent campaigns
 */

import { Link } from 'react-router-dom';
import { Megaphone, Users, TrendingUp, MessageSquare, Plus, ArrowRight, BarChart3 } from 'lucide-react';
import { useCampaigns } from '../hooks';
import { useAuth } from '@/contexts/AuthContext';
import { CAMPAIGN_STATUS_LABELS } from '../constants';

export default function MarketingDashboardPage() {
  const { user } = useAuth();
  const { campaigns, loading, error } = useCampaigns(user?.companyId);

  // Calculate KPIs from campaigns
  const kpis = campaigns.reduce(
    (acc, campaign) => {
      acc.totalCampaigns++;
      if (campaign.status === 'active') acc.activeCampaigns++;
      acc.totalReach += campaign.metrics.totalReached;
      acc.totalEngagements += campaign.metrics.totalEngagements;
      acc.totalSent += campaign.metrics.totalSent;
      return acc;
    },
    {
      totalCampaigns: 0,
      activeCampaigns: 0,
      totalReach: 0,
      totalEngagements: 0,
      totalSent: 0,
    }
  );

  const avgEngagementRate = kpis.totalSent > 0
    ? ((kpis.totalEngagements / kpis.totalSent) * 100).toFixed(1)
    : 0;

  // Get recent campaigns (last 5)
  const recentCampaigns = campaigns
    .sort((a, b) => {
      const dateA = a.createdAt?.toDate?.() || new Date(0);
      const dateB = b.createdAt?.toDate?.() || new Date(0);
      return dateB.getTime() - dateA.getTime();
    })
    .slice(0, 5);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          Error loading dashboard: {error.message}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-5 max-w-[1640px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1>Marketing Hub</h1>
          <p className="mt-1 text-[12.5px]" style={{ color: 'var(--fg-secondary)' }}>
            Manage campaigns and track performance
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/marketing/analytics"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-medium border transition-colors"
            style={{
              borderColor: 'var(--border-default)',
              backgroundColor: 'var(--bg-surface)',
              color: 'var(--fg-primary)',
            }}
          >
            <BarChart3 className="h-3.5 w-3.5" /> View Analytics
          </Link>
          <Link
            to="/marketing/campaigns/new"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-[13px] font-medium transition-colors"
            style={{
              backgroundColor: 'var(--fg-primary)',
              color: '#fff',
            }}
          >
            <Plus className="h-3.5 w-3.5" /> New Campaign
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={Megaphone}
          label="Total Campaigns"
          value={kpis.totalCampaigns.toString()}
          subtitle={`${kpis.activeCampaigns} active`}
          iconColor="text-blue-600"
          bgColor="bg-blue-50"
        />

        <KPICard
          icon={Users}
          label="Total Reach"
          value={kpis.totalReach.toLocaleString()}
          subtitle={`${kpis.totalSent.toLocaleString()} sent`}
          iconColor="text-green-600"
          bgColor="bg-green-50"
        />

        <KPICard
          icon={MessageSquare}
          label="Engagements"
          value={kpis.totalEngagements.toLocaleString()}
          subtitle={`${avgEngagementRate}% rate`}
          iconColor="text-purple-600"
          bgColor="bg-purple-50"
        />

        <KPICard
          icon={TrendingUp}
          label="Avg. Engagement"
          value={`${avgEngagementRate}%`}
          subtitle="Across all campaigns"
          iconColor="text-orange-600"
          bgColor="bg-orange-50"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Link
            to="/marketing/campaigns/new"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="p-2 bg-blue-50 rounded-lg">
              <Megaphone className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">Create Campaign</div>
              <div className="text-xs text-gray-500">Launch a new marketing campaign</div>
            </div>
          </Link>

          <Link
            to="/marketing/templates"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="p-2 bg-purple-50 rounded-lg">
              <MessageSquare className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">Browse Templates</div>
              <div className="text-xs text-gray-500">View content templates</div>
            </div>
          </Link>

          <Link
            to="/marketing/calendar"
            className="flex items-center gap-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className="p-2 bg-green-50 rounded-lg">
              <TrendingUp className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">Content Calendar</div>
              <div className="text-xs text-gray-500">Plan social media posts</div>
            </div>
          </Link>
        </div>
      </div>

      {/* Recent Campaigns */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Recent Campaigns</h2>
            <Link
              to="/marketing/campaigns"
              className="flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View All
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="p-6">
          {recentCampaigns.length === 0 ? (
            <div className="text-center py-8">
              <Megaphone className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <h3 className="text-sm font-medium text-gray-900">No campaigns yet</h3>
              <p className="text-xs text-gray-500 mt-1">Create your first campaign to get started</p>
              <Link
                to="/marketing/campaigns/new"
                className="mt-4 inline-flex items-center gap-2 text-sm text-primary hover:underline"
              >
                <Plus className="h-4 w-4" />
                Create Campaign
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentCampaigns.map((campaign) => {
                const createdDate = campaign.createdAt?.toDate();
                return (
                  <Link
                    key={campaign.id}
                    to={`/marketing/campaigns/${campaign.id}`}
                    className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900 truncate">{campaign.name}</h3>
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                          {CAMPAIGN_STATUS_LABELS[campaign.status]?.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {createdDate?.toLocaleDateString()} · {campaign.metrics.totalReached.toLocaleString()} reached
                      </p>
                    </div>
                    <div className="text-right ml-4">
                      <div className="text-sm font-semibold text-gray-900">
                        {(campaign.metrics.engagementRate * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-500">engagement</div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface KPICardProps {
  icon: any;
  label: string;
  value: string;
  subtitle?: string;
  iconColor: string;
  bgColor: string;
  /** Optional design-system accent for the sparkline / trend hue. */
  tone?: string;
}

/**
 * Local KPI card — kept as a wrapper for back-compat with this page's existing
 * call sites. Rendered with the portal redesign tokens so it matches the
 * dashboard's <KPICard> visually.
 */
function KPICard({ icon: Icon, label, value, subtitle, iconColor, bgColor, tone }: KPICardProps) {
  return (
    <div
      className="flex flex-col gap-1 rounded-[10px] border bg-[var(--bg-surface)] overflow-hidden"
      style={{
        padding: 'var(--pad-card)',
        borderColor: 'var(--border-default)',
        borderLeftWidth: tone ? 3 : 1,
        borderLeftColor: tone,
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="text-[11px] font-medium uppercase tracking-[0.08em]"
          style={{ color: 'var(--fg-tertiary)' }}
        >
          {label}
        </span>
        <span className={`p-1.5 rounded-md ${bgColor}`}>
          <Icon className={`h-3.5 w-3.5 ${iconColor}`} />
        </span>
      </div>
      <div
        className="text-[26px] font-semibold tabular-nums mt-1"
        style={{ color: 'var(--fg-primary)', letterSpacing: '-0.02em', lineHeight: 1.15 }}
      >
        {value}
      </div>
      {subtitle && (
        <div className="text-[12px] mt-1" style={{ color: 'var(--fg-secondary)' }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}
