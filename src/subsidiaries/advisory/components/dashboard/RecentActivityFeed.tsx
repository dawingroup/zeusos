/**
 * Recent Activity Feed Component
 * DawinOS v2.0 - Dawin Advisory
 * Shows recent activities across Advisory modules
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Badge } from '@/core/components/ui/badge';
import { 
  Briefcase, 
  HardHat, 
  Building2, 
  FileText,
  ArrowRight,
  Clock,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { MODULE_COLOR } from '../../constants';

interface Activity {
  id: string;
  type: 'investment' | 'matflow' | 'delivery' | 'document';
  title: string;
  subtitle: string;
  timestamp: Date;
  link: string;
  status?: string;
}

interface RecentActivityFeedProps {
  activities: Activity[];
  maxItems?: number;
}

const activityIcons = {
  investment: Briefcase,
  matflow: HardHat,
  delivery: Building2,
  document: FileText,
};

const activityColors = {
  investment: '#10b981',
  matflow: '#f59e0b',
  delivery: '#3b82f6',
  document: '#8b5cf6',
};

export const RecentActivityFeed: React.FC<RecentActivityFeedProps> = ({
  activities,
  maxItems = 5,
}) => {
  const navigate = useNavigate();
  const displayActivities = activities.slice(0, maxItems);

  return (
    <Card className="h-full">
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg font-semibold">Recent Activity</CardTitle>
          <Badge 
            variant="secondary"
            style={{ backgroundColor: `${MODULE_COLOR}20`, color: MODULE_COLOR }}
          >
            {activities.length} updates
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1">
          {displayActivities.map((activity) => {
            const Icon = activityIcons[activity.type];
            const iconColor = activityColors[activity.type];
            
            return (
              <div
                key={activity.id}
                className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted cursor-pointer transition-colors"
                onClick={() => navigate(activity.link)}
              >
                <div 
                  className="p-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: `${iconColor}20` }}
                >
                  <Icon className="h-4 w-4" style={{ color: iconColor }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{activity.title}</p>
                  <p className="text-xs text-muted-foreground truncate">{activity.subtitle}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-1" />
              </div>
            );
          })}
          
          {displayActivities.length === 0 && (
            <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
              No recent activity
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default RecentActivityFeed;
