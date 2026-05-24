/**
 * Intelligence Admin Dashboard
 * ZeusOS v2.0 - Management interface for monitoring and refining the Intelligence Layer
 *
 * This dashboard allows senior managers to:
 * - Monitor business events in real-time
 * - Track and manage generated tasks
 * - View employee workloads and task assignments
 * - Manage role profiles and skills
 * - Configure event rules and templates
 */

import { useState } from 'react';
import {
  Brain,
  Activity,
  Users,
  ClipboardList,
  Shield,
  Settings,
  RefreshCw,
  ChevronRight,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  BarChart3,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/core/components/ui/tabs';
import { Progress } from '@/core/components/ui/progress';

import { MODULE_COLOR } from '../constants';
import { EventMonitoringPanel } from '../components/admin/EventMonitoringPanel';
import { TaskManagementPanel } from '../components/admin/TaskManagementPanel';
import { EmployeeWorkloadPanel } from '../components/admin/EmployeeWorkloadPanel';
import { RoleProfilePanel } from '../components/admin/RoleProfilePanel';
import { AIMemoryPanel } from '../components/admin/AIMemoryPanel';
import { useIntelligenceAdminOverview } from '../hooks/useIntelligenceAdminOverview';

type AdminTab = 'overview' | 'events' | 'tasks' | 'workload' | 'roles' | 'memory';

export default function IntelligenceAdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const { overview, loading, refresh } = useIntelligenceAdminOverview();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div
            className="p-3 rounded-xl"
            style={{ backgroundColor: `${MODULE_COLOR}15` }}
          >
            <Brain className="h-8 w-8" style={{ color: MODULE_COLOR }} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: MODULE_COLOR }}>
              Intelligence Admin
            </h1>
            <p className="text-muted-foreground">
              Monitor and refine AI-powered task automation
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline">
            <Settings className="h-4 w-4 mr-2" />
            Configure
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as AdminTab)}>
        <TabsList className="grid grid-cols-6 w-full max-w-3xl">
          <TabsTrigger value="overview" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="events" className="gap-2">
            <Zap className="h-4 w-4" />
            Events
            {overview && overview.eventStats.pending > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {overview.eventStats.pending}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="tasks" className="gap-2">
            <ClipboardList className="h-4 w-4" />
            Tasks
            {overview && overview.taskStats.pendingTasks > 0 && (
              <Badge variant="secondary" className="ml-1 h-5 px-1.5">
                {overview.taskStats.pendingTasks}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="workload" className="gap-2">
            <Users className="h-4 w-4" />
            Workload
          </TabsTrigger>
          <TabsTrigger value="roles" className="gap-2">
            <Shield className="h-4 w-4" />
            Roles
          </TabsTrigger>
          <TabsTrigger value="memory" className="gap-2">
            <Brain className="h-4 w-4" />
            AI Memory
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <OverviewTab overview={overview} loading={loading} onNavigate={setActiveTab} />
        </TabsContent>
        <TabsContent value="events" className="mt-6">
          <EventMonitoringPanel />
        </TabsContent>
        <TabsContent value="tasks" className="mt-6">
          <TaskManagementPanel />
        </TabsContent>
        <TabsContent value="workload" className="mt-6">
          <EmployeeWorkloadPanel />
        </TabsContent>
        <TabsContent value="roles" className="mt-6">
          <RoleProfilePanel />
        </TabsContent>
        <TabsContent value="memory" className="mt-6">
          <AIMemoryPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================
// Overview Tab Component
// ============================================

interface OverviewTabProps {
  overview: ReturnType<typeof useIntelligenceAdminOverview>['overview'];
  loading: boolean;
  onNavigate: (tab: AdminTab) => void;
}

function OverviewTab({ overview, loading, onNavigate }: OverviewTabProps) {
  if (loading || !overview) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-16 bg-muted rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Key Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Events Today"
          value={overview.eventStats.today}
          subValue={`${overview.eventStats.processed} processed`}
          icon={<Zap className="h-5 w-5" />}
          color="#3B82F6"
          onClick={() => onNavigate('events')}
        />
        <MetricCard
          title="Active Tasks"
          value={overview.taskStats.activeTasks}
          subValue={`${overview.taskStats.completedToday} completed today`}
          icon={<ClipboardList className="h-5 w-5" />}
          color="#10B981"
          onClick={() => onNavigate('tasks')}
        />
        <MetricCard
          title="Team Members"
          value={overview.workloadStats.totalEmployees}
          subValue={`${overview.workloadStats.activeEmployees} active`}
          icon={<Users className="h-5 w-5" />}
          color="#8B5CF6"
          onClick={() => onNavigate('workload')}
        />
        <MetricCard
          title="Role Profiles"
          value={overview.roleStats.totalRoles}
          subValue={`${overview.roleStats.finishesRoles} Finishes roles`}
          icon={<Shield className="h-5 w-5" />}
          color="#F59E0B"
          onClick={() => onNavigate('roles')}
        />
      </div>

      {/* System Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Event Processing Health */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Activity className="h-4 w-4 text-[var(--rag-blue)]" />
              Event Processing
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Processing Rate</span>
              <span className="font-medium">
                {overview.eventStats.processed}/{overview.eventStats.today}
              </span>
            </div>
            <Progress
              value={overview.eventStats.today > 0
                ? (overview.eventStats.processed / overview.eventStats.today) * 100
                : 100
              }
              className="h-2"
            />
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[var(--rag-green)]" />
                <span>{overview.eventStats.processed} Processed</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[var(--rag-amber)]" />
                <span>{overview.eventStats.pending} Pending</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[var(--rag-red)]" />
                <span>{overview.eventStats.failed} Failed</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Task Generation Health */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-[var(--rag-green)]" />
              Task Generation
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Completion Rate</span>
              <span className="font-medium">
                {overview.taskStats.completionRate}%
              </span>
            </div>
            <Progress value={overview.taskStats.completionRate} className="h-2" />
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="text-center p-2 bg-muted/50 rounded">
                <div className="font-semibold text-[var(--rag-amber)]">{overview.taskStats.pendingTasks}</div>
                <div className="text-xs text-muted-foreground">Pending</div>
              </div>
              <div className="text-center p-2 bg-muted/50 rounded">
                <div className="font-semibold text-[var(--rag-blue)]">{overview.taskStats.activeTasks}</div>
                <div className="text-xs text-muted-foreground">Active</div>
              </div>
              <div className="text-center p-2 bg-muted/50 rounded">
                <div className="font-semibold text-[var(--rag-green)]">{overview.taskStats.completedToday}</div>
                <div className="text-xs text-muted-foreground">Done Today</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Workload Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-[var(--rag-blue)]" />
              Workload Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Avg. Utilization</span>
              <span className="font-medium">
                {overview.workloadStats.avgUtilization}%
              </span>
            </div>
            <Progress value={overview.workloadStats.avgUtilization} className="h-2" />
            <div className="grid grid-cols-3 gap-2 text-sm">
              <div className="text-center p-2 bg-muted/50 rounded">
                <div className="font-semibold text-[var(--rag-green)]">{overview.workloadStats.underCapacity}</div>
                <div className="text-xs text-muted-foreground">Available</div>
              </div>
              <div className="text-center p-2 bg-muted/50 rounded">
                <div className="font-semibold text-[var(--rag-blue)]">{overview.workloadStats.atCapacity}</div>
                <div className="text-xs text-muted-foreground">At Capacity</div>
              </div>
              <div className="text-center p-2 bg-muted/50 rounded">
                <div className="font-semibold text-[var(--rag-red)]">{overview.workloadStats.overCapacity}</div>
                <div className="text-xs text-muted-foreground">Overloaded</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity & Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Events */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Recent Events</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('events')}>
              View All <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {overview.recentEvents.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No recent events
                </p>
              ) : (
                overview.recentEvents.map((event) => (
                  <div
                    key={event.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                  >
                    <div className={`p-1.5 rounded ${
                      event.status === 'processed' ? 'bg-[var(--rag-green-soft)] text-[var(--rag-green)]' :
                      event.status === 'pending' ? 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]' :
                      'bg-[var(--rag-red-soft)] text-[var(--rag-red)]'
                    }`}>
                      {event.status === 'processed' ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : event.status === 'pending' ? (
                        <Clock className="h-4 w-4" />
                      ) : (
                        <AlertCircle className="h-4 w-4" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{event.name}</p>
                      <p className="text-xs text-muted-foreground">{event.module} • {event.time}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {event.tasksGenerated} tasks
                    </Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Top Employees by Workload */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-base">Employee Workloads</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onNavigate('workload')}>
              View All <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {overview.topEmployees.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No employee data available
                </p>
              ) : (
                overview.topEmployees.map((employee) => (
                  <div
                    key={employee.id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br $1-[var(--rag-blue)] $1-[var(--rag-blue)] flex items-center justify-center text-white text-sm font-medium">
                      {employee.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{employee.name}</p>
                      <p className="text-xs text-muted-foreground">{employee.role}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium">{employee.activeTasks} tasks</div>
                      <Progress
                        value={employee.utilization}
                        className="h-1.5 w-16"
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ============================================
// Metric Card Component
// ============================================

interface MetricCardProps {
  title: string;
  value: number;
  subValue: string;
  icon: React.ReactNode;
  color: string;
  onClick?: () => void;
}

function MetricCard({ title, value, subValue, icon, color, onClick }: MetricCardProps) {
  return (
    <Card
      className={`cursor-pointer hover:shadow-md transition-shadow ${onClick ? 'hover:border-primary/50' : ''}`}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-3xl font-bold mt-1" style={{ color }}>{value}</p>
            <p className="text-xs text-muted-foreground mt-1">{subValue}</p>
          </div>
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: `${color}15` }}
          >
            <div style={{ color }}>{icon}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
