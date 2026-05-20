/**
 * GoalListPage.tsx
 * Goal management with filtering, views, and progress tracking
 * DawinOS v2.0 - Phase 8.9
 */

import { useState, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Search,
  Plus,
  X,
  MoreVertical,
  Edit,
  Trash2,
  Archive,
  Download,
  Flag,
  LayoutGrid,
  List,
  CheckCircle,
} from 'lucide-react';
import { differenceInDays, isPast } from 'date-fns';

import { Card, CardContent } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Badge } from '@/core/components/ui/badge';
import { Progress } from '@/core/components/ui/progress';
import { Tabs, TabsList, TabsTrigger } from '@/core/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/core/components/ui/dropdown-menu';
import { Skeleton } from '@/core/components/ui/skeleton';
import { cn } from '@/shared/lib/utils';

import { usePerformance } from '@/modules/hr-central/performance/hooks/usePerformance';
import { useGlobalState } from '@/integration/store';
import type { PerformanceGoal } from '@/modules/hr-central/performance/types/performance.types';

const PERFORMANCE_COLOR = '#FF5722';

// Status options
const GOAL_STATUSES = [
  { value: 'not_started', label: 'Not Started', color: 'bg-gray-100 text-gray-800' },
  { value: 'on_track', label: 'On Track', color: 'bg-blue-100 text-blue-800' },
  { value: 'at_risk', label: 'At Risk', color: 'bg-amber-100 text-amber-800' },
  { value: 'behind', label: 'Behind', color: 'bg-red-100 text-red-800' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-800' },
];

// Category options
const GOAL_CATEGORIES = [
  { value: 'performance', label: 'Performance' },
  { value: 'development', label: 'Development' },
  { value: 'project', label: 'Project' },
  { value: 'team', label: 'Team' },
  { value: 'personal', label: 'Personal' },
];

// Type options
const GOAL_TYPES = [
  { value: 'individual', label: 'Individual' },
  { value: 'team', label: 'Team' },
  { value: 'department', label: 'Department' },
  { value: 'company', label: 'Company' },
];

// Map Firebase goal status to display status
function mapGoalStatus(status: string): string {
  const statusMap: Record<string, string> = {
    'not_started': 'not_started',
    'in_progress': 'on_track',
    'on_track': 'on_track',
    'at_risk': 'at_risk',
    'behind': 'behind',
    'completed': 'completed',
    'exceeded': 'completed',
  };
  return statusMap[status] || 'not_started';
}

function getStatusColor(status: string): string {
  return GOAL_STATUSES.find(s => s.value === status)?.color || 'bg-gray-100 text-gray-800';
}

function getStatusLabel(status: string): string {
  return GOAL_STATUSES.find(s => s.value === status)?.label || status;
}

function getDaysText(dueDate: Date, status: string): string {
  if (status === 'completed') return 'Completed';
  const days = differenceInDays(dueDate, new Date());
  if (days < 0) return `${Math.abs(days)}d overdue`;
  if (days === 0) return 'Due today';
  return `${days}d remaining`;
}

export function GoalListPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { state } = useGlobalState();
  const { user } = state.auth;

  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || 'all');
  const [categoryFilter, setCategoryFilter] = useState(searchParams.get('category') || 'all');
  const [typeFilter, setTypeFilter] = useState(searchParams.get('type') || 'all');
  const [activeTab, setActiveTab] = useState('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Use real Firebase data via usePerformance hook
  const {
    goals: firebaseGoals,
    isLoading: loading,
    deleteGoal,
  } = usePerformance({
    companyId: state.currentOrganizationId || '',
    autoLoad: true,
  });

  // Filter goals
  const filteredGoals = useMemo(() => {
    return firebaseGoals.filter((goal: PerformanceGoal) => {
      const mappedStatus = mapGoalStatus(goal.status);

      // Tab filter
      if (activeTab === 'my' && goal.employeeId !== user?.userId) return false;
      if (activeTab === 'attention' && !['at_risk', 'behind'].includes(mappedStatus)) return false;
      if (activeTab === 'completed' && mappedStatus !== 'completed') return false;

      // Search filter
      if (search && !goal.title.toLowerCase().includes(search.toLowerCase()) &&
          !goal.description?.toLowerCase().includes(search.toLowerCase())) return false;

      // Status filter
      if (statusFilter !== 'all' && mappedStatus !== statusFilter) return false;

      // Category filter
      if (categoryFilter !== 'all' && goal.category !== categoryFilter) return false;

      // Type filter
      if (typeFilter !== 'all' && goal.type !== typeFilter) return false;

      return true;
    });
  }, [firebaseGoals, search, statusFilter, categoryFilter, typeFilter, activeTab, user]);

  // Stats
  const stats = useMemo(() => {
    const mappedGoals = firebaseGoals.map((g: PerformanceGoal) => ({
      ...g,
      mappedStatus: mapGoalStatus(g.status),
    }));

    return {
      total: firebaseGoals.length,
      completed: mappedGoals.filter(g => g.mappedStatus === 'completed').length,
      onTrack: mappedGoals.filter(g => g.mappedStatus === 'on_track').length,
      atRisk: mappedGoals.filter(g => g.mappedStatus === 'at_risk').length,
      behind: mappedGoals.filter(g => g.mappedStatus === 'behind').length,
    };
  }, [firebaseGoals]);

  const hasActiveFilters = search || statusFilter !== 'all' || categoryFilter !== 'all' || typeFilter !== 'all';

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setCategoryFilter('all');
    setTypeFilter('all');
  };

  if (loading) {
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Flag className="h-6 w-6" style={{ color: PERFORMANCE_COLOR }} />
            Goals
          </h1>
          <p className="text-muted-foreground">Manage and track team and individual goals</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Button onClick={() => navigate('/hr/performance/goals/new')} style={{ backgroundColor: PERFORMANCE_COLOR }}>
            <Plus className="h-4 w-4 mr-2" />
            New Goal
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        <Card className="text-center p-3">
          <p className="text-2xl font-bold">{stats.total}</p>
          <p className="text-xs text-muted-foreground">Total Goals</p>
        </Card>
        <Card className="text-center p-3">
          <p className="text-2xl font-bold text-green-600">{stats.completed}</p>
          <p className="text-xs text-muted-foreground">Completed</p>
        </Card>
        <Card className="text-center p-3">
          <p className="text-2xl font-bold text-blue-600">{stats.onTrack}</p>
          <p className="text-xs text-muted-foreground">On Track</p>
        </Card>
        <Card className="text-center p-3">
          <p className="text-2xl font-bold text-amber-600">{stats.atRisk}</p>
          <p className="text-xs text-muted-foreground">At Risk</p>
        </Card>
        <Card className="text-center p-3">
          <p className="text-2xl font-bold text-red-600">{stats.behind}</p>
          <p className="text-xs text-muted-foreground">Behind</p>
        </Card>
      </div>

      {/* Tabs & View Toggle */}
      <div className="flex items-center justify-between">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="all">All Goals</TabsTrigger>
            <TabsTrigger value="my">My Goals</TabsTrigger>
            <TabsTrigger value="attention">Needs Attention</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex gap-1 border rounded-md p-1">
          <Button
            variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search goals..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {GOAL_STATUSES.map(s => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {GOAL_CATEGORIES.map(c => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {GOAL_TYPES.map(t => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasActiveFilters && (
          <Button variant="ghost" onClick={clearFilters}>
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>

      {/* Goals Grid/List */}
      {filteredGoals.length === 0 ? (
        <Card className="p-12 text-center">
          <Flag className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Goals Found</h3>
          <p className="text-muted-foreground mb-4">
            {hasActiveFilters ? 'Try adjusting your filters' : 'Create your first goal to get started'}
          </p>
          {!hasActiveFilters && (
            <Button onClick={() => navigate('/hr/performance/goals/new')} style={{ backgroundColor: PERFORMANCE_COLOR }}>
              <Plus className="h-4 w-4 mr-2" />
              Create Goal
            </Button>
          )}
        </Card>
      ) : (
        <div className={cn(
          "grid gap-4",
          viewMode === 'grid' ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
        )}>
          {filteredGoals.map((goal: PerformanceGoal) => {
            const mappedStatus = mapGoalStatus(goal.status);
            const dueDate = goal.dueDate instanceof Date ? goal.dueDate : new Date(goal.dueDate);

            return (
              <Card
                key={goal.id}
                className="hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => navigate(`/hr/performance/goals/${goal.id}`)}
              >
                <CardContent className="p-4">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{goal.title}</p>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">{goal.description}</p>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); navigate(`/hr/performance/goals/${goal.id}/edit`); }}>
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        {mappedStatus !== 'completed' && (
                          <DropdownMenuItem>
                            <CheckCircle className="h-4 w-4 mr-2" />
                            Mark Complete
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem>
                          <Archive className="h-4 w-4 mr-2" />
                          Archive
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="text-destructive"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (confirm('Are you sure you want to delete this goal?')) {
                              await deleteGoal(goal.id);
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Tags */}
                  <div className="flex gap-1 mt-2">
                    <Badge className={cn("text-xs", getStatusColor(mappedStatus))}>
                      {getStatusLabel(mappedStatus)}
                    </Badge>
                    <Badge variant="outline" className="text-xs capitalize">{goal.category}</Badge>
                  </div>

                  {/* Progress */}
                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="font-medium">{goal.progress}%</span>
                    </div>
                    <Progress
                      value={goal.progress}
                      className={cn(
                        "h-1.5",
                        mappedStatus === 'completed' ? "[&>div]:bg-green-500" :
                        mappedStatus === 'behind' ? "[&>div]:bg-red-500" :
                        mappedStatus === 'at_risk' ? "[&>div]:bg-amber-500" : ""
                      )}
                    />
                  </div>

                  {/* Footer */}
                  <div className="flex items-center justify-between mt-3">
                    <div className="flex items-center gap-2">
                      <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-medium">
                        E
                      </div>
                      <span className="text-xs text-muted-foreground">Employee</span>
                    </div>
                    <span className={cn(
                      "text-xs",
                      isPast(dueDate) && mappedStatus !== 'completed' ? "text-red-600 font-medium" : "text-muted-foreground"
                    )}>
                      {getDaysText(dueDate, mappedStatus)}
                    </span>
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

export default GoalListPage;
