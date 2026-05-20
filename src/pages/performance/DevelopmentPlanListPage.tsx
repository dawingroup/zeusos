/**
 * DevelopmentPlanListPage.tsx
 * Employee development plans with activity tracking and progress monitoring
 * DawinOS v2.0 - Phase 8.9
 * Updated to use Firebase via useDevelopment hook
 */

import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Plus,
  Download,
  GraduationCap,
  Target,
} from 'lucide-react';

import { Card, CardContent } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Progress } from '@/core/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/core/components/ui/tabs';
import { Skeleton } from '@/core/components/ui/skeleton';
import { useDevelopment } from '@/modules/hr-central/performance/hooks/useDevelopment';
import { useGlobalState } from '@/integration/store';

const PERFORMANCE_COLOR = '#FF5722';

export function DevelopmentPlanListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state } = useGlobalState();
  const { user } = state.auth;

  const {
    developmentPlans,
    developmentPlanStats,
    isLoading,
    error,
  } = useDevelopment({
    companyId: state.currentOrganizationId || '',
    employeeId: user?.userId,
    autoLoad: true,
  });

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [activeTab, setActiveTab] = useState('all');

  // Current year plans
  const currentYear = new Date().getFullYear();
  const currentYearPlans = useMemo(() => {
    return developmentPlans.filter(plan => plan.planYear === currentYear);
  }, [developmentPlans, currentYear]);

  // Filter plans
  const filteredPlans = useMemo(() => {
    let plans = currentYearPlans;

    // Tab filter
    if (activeTab === 'current') {
      plans = plans.filter(p => p.planYear === currentYear);
    }

    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      plans = plans.filter(plan =>
        plan.careerGoals?.toLowerCase().includes(searchLower) ||
        plan.desiredRole?.toLowerCase().includes(searchLower) ||
        plan.goals.some(g => g.title.toLowerCase().includes(searchLower))
      );
    }

    return plans;
  }, [currentYearPlans, search, activeTab, currentYear]);

  if (isLoading && developmentPlans.length === 0) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16" />)}
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-48" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <p className="text-red-600">{error}</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <GraduationCap className="h-6 w-6" style={{ color: PERFORMANCE_COLOR }} />
            Development Plans
          </h1>
          <p className="text-muted-foreground">Track employee growth and development activities</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => navigate('/hr/performance/development/new')} style={{ backgroundColor: PERFORMANCE_COLOR }}>
            <Plus className="h-4 w-4 mr-2" />
            New Plan
          </Button>
        </div>
      </div>

      {/* Stats */}
      {developmentPlanStats && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
          <Card className="text-center p-3">
            <p className="text-2xl font-bold">{developmentPlanStats.totalPlans}</p>
            <p className="text-xs text-muted-foreground">Total Plans</p>
          </Card>
          <Card className="text-center p-3">
            <p className="text-2xl font-bold text-blue-600">{developmentPlanStats.totalGoals}</p>
            <p className="text-xs text-muted-foreground">Total Goals</p>
          </Card>
          <Card className="text-center p-3">
            <p className="text-2xl font-bold text-green-600">{developmentPlanStats.completedGoals}</p>
            <p className="text-xs text-muted-foreground">Completed</p>
          </Card>
          <Card className="text-center p-3">
            <p className="text-2xl font-bold text-amber-600">{developmentPlanStats.highPriorityGaps}</p>
            <p className="text-xs text-muted-foreground">High Priority Gaps</p>
          </Card>
          <Card className="text-center p-3">
            <p className="text-2xl font-bold" style={{ color: PERFORMANCE_COLOR }}>
              {developmentPlanStats.overallProgress.toFixed(0)}%
            </p>
            <p className="text-xs text-muted-foreground">Avg Progress</p>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="all">All Years</TabsTrigger>
          <TabsTrigger value="current">Current Year</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Search */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search plans..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Plans Grid */}
      {developmentPlans.length === 0 ? (
        <Card className="p-12 text-center">
          <GraduationCap className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Development Plans Yet</h3>
          <p className="text-muted-foreground mb-4">
            Create a development plan to track your career growth and skill development.
          </p>
          <Button onClick={() => navigate('/hr/performance/development/new')} style={{ backgroundColor: PERFORMANCE_COLOR }}>
            <Plus className="h-4 w-4 mr-2" />
            Create Development Plan
          </Button>
        </Card>
      ) : filteredPlans.length === 0 ? (
        <Card className="p-12 text-center">
          <GraduationCap className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Plans Found</h3>
          <p className="text-muted-foreground mb-4">
            {search
              ? 'Try adjusting your search'
              : 'Create a development plan to track employee growth'}
          </p>
          <Button onClick={() => navigate('/performance/development/new')} style={{ backgroundColor: PERFORMANCE_COLOR }}>
            <Plus className="h-4 w-4 mr-2" />
            Create Plan
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlans.map(plan => {
            const completedGoals = plan.goals.filter(g => g.status === 'completed').length;
            const totalGoals = plan.goals.length;
            const progressPercent = plan.overallProgress;

            return (
              <Card
                key={plan.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/hr/performance/development/${plan.id}`)}
              >
                <CardContent className="p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">Development Plan {plan.planYear}</p>
                      {plan.desiredRole && (
                        <p className="text-sm text-muted-foreground mt-1">
                          <Target className="inline w-3 h-3 mr-1" />
                          {plan.desiredRole}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Career Goals */}
                  {plan.careerGoals && (
                    <div className="mt-3">
                      <p className="text-xs text-muted-foreground line-clamp-2">{plan.careerGoals}</p>
                    </div>
                  )}

                  {/* Progress */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{completedGoals}/{totalGoals} goals</span>
                    </div>
                    <Progress
                      value={progressPercent}
                      className="h-2"
                    />
                    <p className="text-xs text-muted-foreground mt-1">{progressPercent.toFixed(0)}% complete</p>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-2 gap-2 mt-3">
                    <div className="text-center p-2 bg-blue-50 rounded">
                      <p className="text-lg font-bold text-blue-700">{plan.skillGaps.length}</p>
                      <p className="text-xs text-blue-600">Skill Gaps</p>
                    </div>
                    <div className="text-center p-2 bg-purple-50 rounded">
                      <p className="text-lg font-bold text-purple-700">{plan.strengths.length}</p>
                      <p className="text-xs text-purple-600">Strengths</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default DevelopmentPlanListPage;
