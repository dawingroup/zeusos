// ============================================================================
// RECENT ACTIVITY FEED
// DawinOS v2.0 - Intelligence Layer
// Feed showing recent AI intelligence activity
// ============================================================================

import React from 'react';
import {
  Lightbulb,
  AlertTriangle,
  TrendingUp,
  MessageCircle,
  FileText,
  ArrowRight,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';

import { SOURCE_MODULES } from '../../constants';
import type { ActivityItem } from '../../types';

interface RecentActivityFeedProps {
  activities: ActivityItem[];
  onViewAll?: () => void;
  maxItems?: number;
}

const activityIcons: Record<string, React.ReactNode> = {
  suggestion: <Lightbulb className="h-4 w-4" />,
  anomaly: <AlertTriangle className="h-4 w-4" />,
  prediction: <TrendingUp className="h-4 w-4" />,
  query: <MessageCircle className="h-4 w-4" />,
  analysis: <FileText className="h-4 w-4" />,
};

const activityColors: Record<string, string> = {
  suggestion: '#FF9800',
  anomaly: '#F44336',
  prediction: '#4CAF50',
  query: '#9C27B0',
  analysis: '#2196F3',
};

export const RecentActivityFeed: React.FC<RecentActivityFeedProps> = ({
  activities,
  onViewAll,
  maxItems = 5,
}) => {
  const displayActivities = activities.slice(0, maxItems);

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diff = now.getTime() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold">Recent Intelligence Activity</CardTitle>
        {onViewAll && (
          <Button variant="ghost" size="sm" onClick={onViewAll}>
            View All
            <ArrowRight className="h-4 w-4 ml-1" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="p-0">
        <div className="divide-y">
          {displayActivities.map((activity) => {
            const moduleConfig = SOURCE_MODULES.find(m => m.id === activity.sourceModule);
            const color = activityColors[activity.type] || '#9e9e9e';
            return (
              <div key={activity.id} className="px-6 py-3 flex items-start gap-3">
                <div
                  className="h-8 w-8 rounded-full flex items-center justify-center shrink-0"
                  style={{ backgroundColor: color, color: 'white' }}
                >
                  {activityIcons[activity.type] || <Lightbulb className="h-4 w-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">{activity.title}</p>
                    <Badge
                      className="text-xs h-5"
                      style={{
                        backgroundColor: moduleConfig?.color || '#9e9e9e',
                        color: 'white',
                      }}
                    >
                      {moduleConfig?.label || activity.sourceModule}
                    </Badge>
                  </div>
                  <div className="flex justify-between mt-1">
                    <p className="text-xs text-muted-foreground truncate max-w-[70%]">
                      {activity.description}
                    </p>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatTimeAgo(activity.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {activities.length === 0 && (
          <div className="p-8 text-center">
            <p className="text-muted-foreground">No recent activity</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentActivityFeed;
