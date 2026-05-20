/**
 * Mobile Dashboard Component
 * Overview dashboard optimized for mobile field use
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Progress } from '@/core/components/ui/progress';
import { ScrollArea } from '@/core/components/ui/scroll-area';
import {
  Package,
  TrendingUp,
  AlertTriangle,
  Clock,
  ChevronRight,
  Truck,
  BarChart3,
} from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import { Link } from 'react-router-dom';
import { Skeleton } from '@/core/components/ui/skeleton';

// Types for dashboard data
interface StageOverview {
  id: string;
  stageName: string;
  overallProgress: number;
}

interface ProjectOverview {
  totalStages: number;
  completedStages: number;
  overallProgress: number;
  budgetVariancePercent: number;
  stages: StageOverview[];
}

interface BOQItem {
  id: string;
  description: string;
  quantity: number;
  procuredQuantity: number;
}

interface MobileDashboardProps {
  projectId?: string;
  projectName?: string;
  overview?: ProjectOverview | null;
  items?: BOQItem[];
  isLoading?: boolean;
}

export function MobileDashboard({
  projectId,
  projectName = 'Project',
  overview,
  items = [],
  isLoading = false,
}: MobileDashboardProps) {
  if (isLoading) {
    return <MobileDashboardSkeleton />;
  }

  // Calculate quick stats
  const pendingItems = items.filter(
    (item) => item.procuredQuantity < item.quantity
  );
  const criticalItems = items.filter(
    (item) => item.procuredQuantity / item.quantity < 0.2
  );

  return (
    <ScrollArea className="flex-1">
      <div className="p-4 pb-24 space-y-4">
        {/* Welcome Card */}
        <Card className="bg-primary text-primary-foreground">
          <CardContent className="pt-4">
            <h2 className="text-lg font-semibold">{projectName}</h2>
            <p className="text-sm opacity-80 mt-1">
              {overview?.completedStages || 0} of {overview?.totalStages || 0}{' '}
              stages completed
            </p>
            <Progress
              value={overview?.overallProgress || 0}
              className="mt-3 bg-primary-foreground/20"
            />
            <p className="text-right text-sm mt-1">
              {Math.round(overview?.overallProgress || 0)}% complete
            </p>
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3">
          <QuickStatCard
            title="Pending"
            value={pendingItems.length}
            icon={Clock}
            color="text-yellow-500"
            bgColor="bg-yellow-50"
          />
          <QuickStatCard
            title="Critical"
            value={criticalItems.length}
            icon={AlertTriangle}
            color="text-red-500"
            bgColor="bg-red-50"
          />
          <QuickStatCard
            title="Budget"
            value={`${Math.abs(overview?.budgetVariancePercent || 0).toFixed(0)}%`}
            subtitle={
              (overview?.budgetVariancePercent || 0) > 0
                ? 'Over budget'
                : 'Under budget'
            }
            icon={TrendingUp}
            color={
              (overview?.budgetVariancePercent || 0) > 5
                ? 'text-red-500'
                : 'text-green-500'
            }
            bgColor={
              (overview?.budgetVariancePercent || 0) > 5
                ? 'bg-red-50'
                : 'bg-green-50'
            }
          />
          <QuickStatCard
            title="Deliveries"
            value={overview?.totalStages || 0}
            subtitle="This week"
            icon={Truck}
            color="text-blue-500"
            bgColor="bg-blue-50"
          />
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2">
              <Link to={`/advisory/matflow/projects/${projectId}/delivery`}>
                <Button
                  variant="outline"
                  className="w-full h-auto flex-col py-3"
                >
                  <Truck className="h-5 w-5 mb-1" />
                  <span className="text-xs">Log Delivery</span>
                </Button>
              </Link>
              <Link to={`/advisory/matflow/projects/${projectId}/boq`}>
                <Button
                  variant="outline"
                  className="w-full h-auto flex-col py-3"
                >
                  <Package className="h-5 w-5 mb-1" />
                  <span className="text-xs">View BOQ</span>
                </Button>
              </Link>
              <Link to={`/advisory/matflow/projects/${projectId}/progress`}>
                <Button
                  variant="outline"
                  className="w-full h-auto flex-col py-3"
                >
                  <BarChart3 className="h-5 w-5 mb-1" />
                  <span className="text-xs">Progress</span>
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Critical Items */}
        {criticalItems.length > 0 && (
          <Card className="border-red-200">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base text-red-600 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Critical Items
                </CardTitle>
                <Badge variant="destructive">{criticalItems.length}</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {criticalItems.slice(0, 3).map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-red-50"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {item.description}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {Math.round((item.procuredQuantity / item.quantity) * 100)}%
                      procured
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              ))}
              {criticalItems.length > 3 && (
                <Link
                  to={`/advisory/matflow/projects/${projectId}/boq?filter=critical`}
                >
                  <Button variant="ghost" size="sm" className="w-full">
                    View all {criticalItems.length} items
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        )}

        {/* Stage Progress */}
        {overview?.stages && overview.stages.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Stage Progress</CardTitle>
                <Link to={`/advisory/matflow/projects/${projectId}/progress`}>
                  <Button variant="ghost" size="sm">
                    View All
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {overview.stages.slice(0, 4).map((stage) => (
                <div key={stage.id} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="truncate flex-1">{stage.stageName}</span>
                    <span className="text-muted-foreground ml-2">
                      {Math.round(stage.overallProgress)}%
                    </span>
                  </div>
                  <Progress value={stage.overallProgress} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </ScrollArea>
  );
}

interface QuickStatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

function QuickStatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  bgColor,
}: QuickStatCardProps) {
  return (
    <Card className={bgColor}>
      <CardContent className="pt-3 pb-3">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-5 w-5', color)} />
          <span className="text-sm text-muted-foreground">{title}</span>
        </div>
        <p className="text-2xl font-bold mt-1">{value}</p>
        {subtitle && (
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  );
}

function MobileDashboardSkeleton() {
  return (
    <div className="p-4 space-y-4">
      <Skeleton className="h-32 w-full" />
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <Skeleton className="h-40 w-full" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

export default MobileDashboard;
