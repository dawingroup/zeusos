/**
 * Recent Activity Feed - Latest activity log entries across all projects
 */

import { Link } from 'react-router-dom';
import {
  Activity,
  FileText,
  DollarSign,
  Users,
  CheckCircle,
  AlertTriangle,
  Clock,
  Loader2,
} from 'lucide-react';
import { BaseCard } from '@/shared/components/cards';
import type { ActivityEntry } from '../../hooks/activity-hooks';

interface RecentActivityFeedProps {
  activities: ActivityEntry[];
  loading: boolean;
}

function getActivityIcon(action: string) {
  if (action.includes('payment') || action.includes('budget')) return DollarSign;
  if (action.includes('document') || action.includes('report')) return FileText;
  if (action.includes('team') || action.includes('member')) return Users;
  if (action.includes('complete') || action.includes('approve')) return CheckCircle;
  if (action.includes('delay') || action.includes('alert')) return AlertTriangle;
  return Activity;
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function RecentActivityFeed({ activities, loading }: RecentActivityFeedProps) {
  return (
    <BaseCard padding="lg">
      <h2 className="text-lg font-medium text-gray-900 mb-4">Recent Activity</h2>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : activities.length === 0 ? (
        <div className="text-center py-6 text-gray-500">
          <Activity className="w-8 h-8 mx-auto mb-2 text-gray-300" />
          <p className="text-sm">No recent activity</p>
        </div>
      ) : (
        <div className="space-y-1">
          {activities.map(entry => {
            const Icon = getActivityIcon(entry.action);
            return (
              <div
                key={entry.id}
                className="flex items-start gap-3 py-2.5 border-b border-gray-50 last:border-0"
              >
                <div className="mt-0.5 p-1.5 rounded-full bg-gray-100 shrink-0">
                  <Icon className="w-3.5 h-3.5 text-gray-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm text-gray-900">{entry.action}</div>
                  {entry.projectName && (
                    <Link
                      to={`/advisory/delivery/projects/${entry.projectId}`}
                      className="text-xs text-primary hover:underline"
                    >
                      {entry.projectName}
                    </Link>
                  )}
                  {entry.userName && (
                    <span className="text-xs text-gray-400 ml-2">by {entry.userName}</span>
                  )}
                </div>
                <span className="text-xs text-gray-400 shrink-0 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {formatRelativeTime(new Date(entry.timestamp))}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </BaseCard>
  );
}
