/**
 * Recent Activity - Activity feed for recent deal updates
 */

import { Clock, Building2, ArrowRight } from 'lucide-react';

interface Deal {
  id: string;
  name: string;
  stage: string;
  sector: string;
  updatedAt: Date;
}

interface RecentActivityProps {
  deals: Deal[];
  limit: number;
  onDealClick: (dealId: string) => void;
}

function formatStageName(stage: string): string {
  return stage.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function getStageColor(stage: string): string {
  const colors: Record<string, string> = {
    screening: 'bg-gray-100 text-gray-700',
    initial_review: 'bg-blue-100 text-blue-700',
    preliminary_dd: 'bg-indigo-100 text-indigo-700',
    detailed_dd: 'bg-violet-100 text-violet-700',
    ic_memo: 'bg-purple-100 text-purple-700',
    ic_approval: 'bg-fuchsia-100 text-fuchsia-700',
    negotiation: 'bg-pink-100 text-pink-700',
    documentation: 'bg-rose-100 text-rose-700',
    closing: 'bg-emerald-100 text-emerald-700',
    post_closing: 'bg-green-100 text-green-700',
  };
  return colors[stage] || 'bg-gray-100 text-gray-700';
}

function getSectorIcon(sector: string): string {
  const icons: Record<string, string> = {
    healthcare: '🏥',
    energy: '⚡',
    transport: '🚢',
    water: '💧',
    digital: '💻',
    social: '🏫',
    financial: '🏦',
  };
  return icons[sector] || '🏢';
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function RecentActivity({ deals, limit, onDealClick }: RecentActivityProps) {
  const recentDeals = deals.slice(0, limit);

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Recent Activity</h3>
        <button className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1">
          View All
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
      
      <div className="space-y-3">
        {recentDeals.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Building2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No recent activity</p>
          </div>
        ) : (
          recentDeals.map((deal) => (
            <button
              key={deal.id}
              onClick={() => onDealClick(deal.id)}
              className="w-full flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 transition-colors text-left"
            >
              {/* Sector Icon */}
              <div className="text-2xl">
                {getSectorIcon(deal.sector)}
              </div>
              
              {/* Deal Info */}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{deal.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${getStageColor(deal.stage)}`}>
                    {formatStageName(deal.stage)}
                  </span>
                  <span className="text-xs text-gray-400 capitalize">{deal.sector}</span>
                </div>
              </div>
              
              {/* Time */}
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <Clock className="w-3 h-3" />
                {formatTimeAgo(deal.updatedAt)}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default RecentActivity;
