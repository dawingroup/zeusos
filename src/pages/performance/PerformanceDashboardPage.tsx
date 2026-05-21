/**
 * PerformanceDashboardPage.tsx
 * Team performance overview with metrics, goals, reviews, and development tracking
 * ZeusOS v2.0 - Phase 8.9
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp,
  Star,
  Flag,
  FileText,
  GraduationCap,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Plus,
} from 'lucide-react';
import { format, differenceInDays, isPast } from 'date-fns';

import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Progress } from '@/core/components/ui/progress';
import { Skeleton } from '@/core/components/ui/skeleton';
import { cn } from '@/shared/lib/utils';
import { RagBadge, Banner } from '@/shared/components/data-display';

const PERFORMANCE_COLOR = '#FF5722';

// Rating labels
const RATING_LABELS: Record<number, string> = {
  1: 'Needs Improvement',
  2: 'Below Expectations',
  3: 'Meets Expectations',
  4: 'Exceeds Expectations',
  5: 'Outstanding',
};

// Helper to render rating stars
function RatingStars({ rating, size = 'md' }: { rating: number; size?: 'sm' | 'md' }) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  const iconSize = size === 'sm' ? 'h-3 w-3' : 'h-4 w-4';

  return (
    <div className="flex">
      {[1, 2, 3, 4, 5].map(i => (
        <Star
          key={i}
          className={cn(
            iconSize,
            i <= fullStars ? 'fill-amber-400 text-amber-400' :
            i === fullStars + 1 && hasHalfStar ? 'fill-amber-400/50 text-amber-400' :
            'text-amber-400'
          )}
        />
      ))}
    </div>
  );
}

// Mock data
const mockMetrics = {
  averageRating: 3.8,
  goalsCompleted: 47,
  totalGoals: 62,
  pendingReviews: 8,
  overdueReviews: 2,
  developmentPlansProgress: 68,
};

const mockGoals = [
  { id: '1', title: 'Complete Q1 Sales Targets', status: 'on_track', progress: 75, dueDate: new Date(2026, 2, 31), ownerName: 'Sarah Nakamya' },
  { id: '2', title: 'Implement New CRM System', status: 'at_risk', progress: 45, dueDate: new Date(2026, 1, 28), ownerName: 'John Okiror' },
  { id: '3', title: 'Staff Training Program', status: 'behind', progress: 30, dueDate: new Date(2026, 0, 31), ownerName: 'Grace Auma' },
  { id: '4', title: 'Customer Satisfaction Survey', status: 'completed', progress: 100, dueDate: new Date(2026, 0, 15), ownerName: 'Peter Mwesigwa' },
  { id: '5', title: 'Budget Review Process', status: 'not_started', progress: 0, dueDate: new Date(2026, 3, 15), ownerName: 'Mary Kirabo' },
];

const mockReviews = [
  { id: '1', employeeName: 'David Ssempala', reviewType: 'Annual', scheduledDate: new Date(2026, 0, 10), status: 'scheduled' },
  { id: '2', employeeName: 'Rebecca Nambi', reviewType: 'Mid-Year', scheduledDate: new Date(2026, 0, 12), status: 'scheduled' },
  { id: '3', employeeName: 'Samuel Okello', reviewType: 'Probation', scheduledDate: new Date(2026, 0, 5), status: 'overdue' },
  { id: '4', employeeName: 'Agnes Akoth', reviewType: 'Quarterly', scheduledDate: new Date(2026, 0, 15), status: 'scheduled' },
];

const mockCompetencyGaps = [
  { id: '1', competencyName: 'Project Management', currentLevel: 2.5, requiredLevel: 4, employeeCount: 12 },
  { id: '2', competencyName: 'Data Analysis', currentLevel: 2.0, requiredLevel: 3.5, employeeCount: 8 },
  { id: '3', competencyName: 'Leadership', currentLevel: 3.0, requiredLevel: 4, employeeCount: 6 },
  { id: '4', competencyName: 'Technical Writing', currentLevel: 2.2, requiredLevel: 3, employeeCount: 15 },
];

const mockDevelopmentPlans = [
  { id: '1', employeeName: 'Alice Namutebi', planTitle: 'Leadership Development', progress: 65, activitiesCompleted: 8, totalActivities: 12 },
  { id: '2', employeeName: 'Brian Musoke', planTitle: 'Technical Skills Enhancement', progress: 40, activitiesCompleted: 4, totalActivities: 10 },
  { id: '3', employeeName: 'Catherine Nyeko', planTitle: 'Management Track', progress: 85, activitiesCompleted: 17, totalActivities: 20 },
  { id: '4', employeeName: 'Daniel Ouma', planTitle: 'Sales Excellence', progress: 50, activitiesCompleted: 5, totalActivities: 10 },
];

const STATUS_TONE: Record<string, 'green' | 'amber' | 'red' | 'blue' | 'na'> = {
  on_track: 'blue',
  at_risk: 'amber',
  behind: 'red',
  completed: 'green',
  not_started: 'na',
};

const statusLabels: Record<string, string> = {
  on_track: 'On Track',
  at_risk: 'At Risk',
  behind: 'Behind',
  completed: 'Completed',
  not_started: 'Not Started',
};

function getDaysRemaining(dueDate: Date, status: string) {
  if (status === 'completed') return 'Completed';
  const days = differenceInDays(dueDate, new Date());
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  return `${days}d remaining`;
}

export function PerformanceDashboardPage() {
  const navigate = useNavigate();
  const [loading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 1000);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-4 sm:px-6 sm:py-6 space-y-5 max-w-[1640px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="inline-flex items-center gap-2">
            <TrendingUp className="h-5 w-5" style={{ color: 'var(--accent)' }} />
            Performance Dashboard
          </h1>
          <p className="mt-1 text-[12.5px]" style={{ color: 'var(--fg-secondary)' }}>
            Team performance overview and metrics
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            Refresh
          </Button>
          <Button variant="primary" size="sm" onClick={() => navigate('/performance/goals/new')}>
            <Plus className="h-3.5 w-3.5" /> New Goal
          </Button>
        </div>
      </div>

      {/* Pending Reviews Alert */}
      {mockMetrics.pendingReviews > 0 && (
        <Banner
          tone={mockMetrics.overdueReviews > 0 ? 'warning' : 'info'}
          title={mockMetrics.overdueReviews > 0 ? `${mockMetrics.overdueReviews} Overdue Reviews` : 'Pending Reviews'}
          message={`You have ${mockMetrics.pendingReviews} performance reviews pending completion.`}
          icon={<AlertTriangle className="h-4 w-4" />}
          actions={
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/performance/reviews?tab=pending')}
            >
              Review Now
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          }
        />
      )}

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Average Rating */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Team Average Rating</p>
              <Star className="h-5 w-5 fill-amber-400 text-amber-400" />
            </div>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-bold">{mockMetrics.averageRating.toFixed(1)}</span>
              <span className="text-muted-foreground">/ 5.0</span>
            </div>
            <RatingStars rating={mockMetrics.averageRating} />
            <p className="text-xs text-muted-foreground mt-1">
              {RATING_LABELS[Math.round(mockMetrics.averageRating)]}
            </p>
          </CardContent>
        </Card>

        {/* Goals Completed */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Goals Completed</p>
              <Flag className="h-5 w-5" style={{ color: PERFORMANCE_COLOR }} />
            </div>
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-3xl font-bold">{mockMetrics.goalsCompleted}</span>
              <span className="text-muted-foreground">/ {mockMetrics.totalGoals}</span>
            </div>
            <Progress 
              value={(mockMetrics.goalsCompleted / mockMetrics.totalGoals) * 100} 
              className="h-2 mt-2"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {Math.round((mockMetrics.goalsCompleted / mockMetrics.totalGoals) * 100)}% completion rate
            </p>
          </CardContent>
        </Card>

        {/* Pending Reviews */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Pending Reviews</p>
              <FileText className={cn("h-5 w-5", mockMetrics.overdueReviews > 0 ? "text-amber-500" : "text-muted-foreground")} />
            </div>
            <p className="text-3xl font-bold mt-2">{mockMetrics.pendingReviews}</p>
            {mockMetrics.overdueReviews > 0 ? (
              <Badge className="bg-amber-100 text-amber-800 mt-2">{mockMetrics.overdueReviews} overdue</Badge>
            ) : (
              <p className="text-xs text-muted-foreground mt-2">All on schedule</p>
            )}
          </CardContent>
        </Card>

        {/* Development Progress */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-muted-foreground">Development Progress</p>
              <GraduationCap className="h-5 w-5 text-green-500" />
            </div>
            <p className="text-3xl font-bold mt-2">{mockMetrics.developmentPlansProgress}%</p>
            <Progress value={mockMetrics.developmentPlansProgress} className="h-2 mt-2 [&>div]:bg-green-500" />
            <p className="text-xs text-muted-foreground mt-1">Average across all plans</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Goals */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-semibold">Active Goals</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => navigate('/performance/goals')}>
              View All
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockGoals.map(goal => (
                <div
                  key={goal.id}
                  className="p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => navigate(`/performance/goals/${goal.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-sm">{goal.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <RagBadge tone={STATUS_TONE[goal.status] ?? 'na'}>
                          {statusLabels[goal.status]}
                        </RagBadge>
                        <span className="text-xs text-muted-foreground">
                          Due: {format(goal.dueDate, 'MMM d, yyyy')}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">{goal.progress}%</p>
                      <p className={cn(
                        "text-xs",
                        isPast(goal.dueDate) && goal.status !== 'completed' ? "text-red-600" : "text-muted-foreground"
                      )}>
                        {getDaysRemaining(goal.dueDate, goal.status)}
                      </p>
                    </div>
                  </div>
                  <Progress 
                    value={goal.progress} 
                    className={cn(
                      "h-1.5 mt-2",
                      goal.status === 'completed' ? "[&>div]:bg-green-500" :
                      goal.status === 'behind' ? "[&>div]:bg-red-500" :
                      goal.status === 'at_risk' ? "[&>div]:bg-amber-500" : ""
                    )}
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-medium">
                      {goal.ownerName[0]}
                    </div>
                    <span className="text-xs text-muted-foreground">{goal.ownerName}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Upcoming Reviews */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold">Upcoming Reviews</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/performance/reviews')}>
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {mockReviews.map(review => (
                  <div
                    key={review.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/performance/reviews/${review.id}`)}
                  >
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                      {review.employeeName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{review.employeeName}</p>
                      <p className="text-xs text-muted-foreground">{review.reviewType} Review</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">{format(review.scheduledDate, 'MMM d')}</p>
                      {review.status === 'overdue' && (
                        <AlertTriangle className="h-3 w-3 text-amber-500" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Competency Gaps */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold">Competency Gaps</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/performance/competencies')}>
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {mockCompetencyGaps.map(gap => {
                  const ratio = gap.currentLevel / gap.requiredLevel;
                  return (
                    <div key={gap.id}>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">{gap.competencyName}</span>
                        <span className="text-xs text-muted-foreground">{gap.employeeCount} employees</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <Progress 
                          value={ratio * 100} 
                          className={cn(
                            "h-1.5 flex-1",
                            ratio >= 0.8 ? "[&>div]:bg-green-500" :
                            ratio >= 0.6 ? "[&>div]:bg-amber-500" : "[&>div]:bg-red-500"
                          )}
                        />
                        <span className="text-xs text-muted-foreground min-w-[50px] text-right">
                          {gap.currentLevel.toFixed(1)}/{gap.requiredLevel.toFixed(1)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Development Plans */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-lg font-semibold">Development Plans</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => navigate('/performance/development')}>
                View All
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {mockDevelopmentPlans.map(plan => (
                  <div
                    key={plan.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => navigate(`/performance/development/${plan.id}`)}
                  >
                    <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium">
                      {plan.employeeName[0]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{plan.employeeName}</p>
                      <p className="text-xs text-muted-foreground">{plan.planTitle}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm" style={{ color: PERFORMANCE_COLOR }}>{plan.progress}%</p>
                      <p className="text-xs text-muted-foreground">{plan.activitiesCompleted}/{plan.totalActivities}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default PerformanceDashboardPage;
