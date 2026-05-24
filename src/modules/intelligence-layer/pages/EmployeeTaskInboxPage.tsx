/**
 * Employee Task Inbox Page
 * ZeusOS v2.0 - Intelligence Layer
 *
 * Employee-facing page for viewing and managing assigned tasks
 */

import { useState } from 'react';
import {
  ClipboardList,
  Clock,
  Play,
  AlertCircle,
  Calendar,
  RefreshCw,
  Search,
  Filter,
  Inbox,
} from 'lucide-react';

import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Input } from '@/core/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';

import { MODULE_COLOR } from '../constants';
import { TaskCard } from '../components/employee-inbox/TaskCard';
import { TaskDetailDialog } from '../components/employee-inbox/TaskDetailDialog';
import { SnapshotStrip } from '../components/employee-inbox/SnapshotStrip';
import {
  useEmployeeTaskInbox,
  type EmployeeTask,
  type TaskStatusFilter,
  type TaskPriorityFilter,
  type TaskGroupBy,
} from '../hooks/useEmployeeTaskInbox';

// ============================================
// Stats Card Component
// ============================================

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

function StatCard({ label, value, icon, color, bgColor }: StatCardProps) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${bgColor}`}>
          <div className={color}>{icon}</div>
        </div>
        <div>
          <div className="text-2xl font-bold">{value}</div>
          <div className="text-xs text-muted-foreground">{label}</div>
        </div>
      </div>
    </Card>
  );
}

// ============================================
// Main Page Component
// ============================================

export default function EmployeeTaskInboxPage() {
  const {
    tasks,
    groupedTasks,
    stats,
    snapshotStats,
    snapshotFilter,
    setSnapshotFilter,
    loading,
    error,
    filters,
    updateFilters,
    startTask,
    completeTask,
    blockTask,
    updateChecklistItem,
    refresh,
    userName,
  } = useEmployeeTaskInbox();

  const [selectedTask, setSelectedTask] = useState<EmployeeTask | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  const handleViewDetails = (task: EmployeeTask) => {
    setSelectedTask(task);
    setIsDetailOpen(true);
  };

  const handleStartTask = async (taskId: string) => {
    try {
      await startTask(taskId);
    } catch (err) {
      console.error('Failed to start task:', err);
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    try {
      await completeTask(taskId);
    } catch (err) {
      console.error('Failed to complete task:', err);
    }
  };

  const handleBlockTask = async (taskId: string) => {
    try {
      await blockTask(taskId);
    } catch (err) {
      console.error('Failed to block task:', err);
    }
  };

  const handleChecklistChange = async (taskId: string, itemId: string, completed: boolean) => {
    try {
      await updateChecklistItem(taskId, itemId, completed);
      // Update selected task if it's the one being modified
      if (selectedTask?.id === taskId) {
        const updatedTask = tasks.find((t) => t.id === taskId);
        if (updatedTask) {
          setSelectedTask(updatedTask);
        }
      }
    } catch (err) {
      console.error('Failed to update checklist:', err);
    }
  };

  // Get group order for consistent display
  const getGroupOrder = (groupBy: TaskGroupBy): string[] => {
    switch (groupBy) {
      case 'status':
        return ['Pending', 'In progress', 'Blocked', 'Completed'];
      case 'priority':
        return ['Critical (P0)', 'High (P1)', 'Medium (P2)', 'Low (P3)'];
      case 'dueDate':
        return ['Overdue', 'Today', 'Tomorrow', 'This Week', 'This Month', 'Later', 'No Due Date'];
      default:
        return Object.keys(groupedTasks);
    }
  };

  const sortedGroupKeys = getGroupOrder(filters.groupBy).filter(
    (key) => groupedTasks[key] && groupedTasks[key].length > 0
  );

  // Add any groups that weren't in our predefined order
  Object.keys(groupedTasks).forEach((key) => {
    if (!sortedGroupKeys.includes(key) && groupedTasks[key].length > 0) {
      sortedGroupKeys.push(key);
    }
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div
            className="p-3 rounded-xl"
            style={{ backgroundColor: `${MODULE_COLOR}15` }}
          >
            <Inbox className="h-8 w-8" style={{ color: MODULE_COLOR }} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold" style={{ color: MODULE_COLOR }}>
              My Tasks
            </h1>
            <p className="text-muted-foreground">
              Welcome back, {userName}
            </p>
          </div>
        </div>

        <Button variant="outline" onClick={refresh} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Snapshot Strip */}
      <SnapshotStrip
        stats={snapshotStats}
        activeFilter={snapshotFilter}
        onFilterChange={setSnapshotFilter}
      />

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Pending"
          value={stats.pending}
          icon={<Clock className="h-5 w-5" />}
          color="text-[var(--rag-amber)]"
          bgColor="bg-[var(--rag-amber-soft)]"
        />
        <StatCard
          label="In Progress"
          value={stats.inProgress}
          icon={<Play className="h-5 w-5" />}
          color="text-[var(--rag-blue)]"
          bgColor="bg-[var(--rag-blue-soft)]"
        />
        <StatCard
          label="Overdue"
          value={stats.overdue}
          icon={<AlertCircle className="h-5 w-5" />}
          color="text-[var(--rag-red)]"
          bgColor="bg-[var(--rag-red-soft)]"
        />
        <StatCard
          label="Due Today"
          value={stats.dueToday}
          icon={<Calendar className="h-5 w-5" />}
          color="text-[var(--rag-amber)]"
          bgColor="bg-[var(--rag-amber-soft)]"
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={filters.searchQuery}
                  onChange={(e) => updateFilters({ searchQuery: e.target.value })}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Status Filter */}
            <Select
              value={filters.status}
              onValueChange={(v) => updateFilters({ status: v as TaskStatusFilter })}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="blocked">Blocked</SelectItem>
              </SelectContent>
            </Select>

            {/* Priority Filter */}
            <Select
              value={filters.priority}
              onValueChange={(v) => updateFilters({ priority: v as TaskPriorityFilter })}
            >
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Priority" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priority</SelectItem>
                <SelectItem value="P0">Critical (P0)</SelectItem>
                <SelectItem value="P1">High (P1)</SelectItem>
                <SelectItem value="P2">Medium (P2)</SelectItem>
                <SelectItem value="P3">Low (P3)</SelectItem>
              </SelectContent>
            </Select>

            {/* Group By */}
            <Select
              value={filters.groupBy}
              onValueChange={(v) => updateFilters({ groupBy: v as TaskGroupBy })}
            >
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Group by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">No Grouping</SelectItem>
                <SelectItem value="status">By Status</SelectItem>
                <SelectItem value="priority">By Priority</SelectItem>
                <SelectItem value="dueDate">By Due Date</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Error State */}
      {error && (
        <Card className="border-[var(--rag-red)] bg-[var(--rag-red-soft)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-[var(--rag-red)]">
              <AlertCircle className="h-5 w-5" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tasks List */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4" style={{ color: MODULE_COLOR }} />
              Tasks
            </CardTitle>
            <Badge variant="outline">{tasks.length} tasks</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-24 bg-muted rounded-lg animate-pulse" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Inbox className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No tasks found</p>
              <p className="text-sm mt-1">
                {filters.status !== 'all' || filters.priority !== 'all' || filters.searchQuery
                  ? 'Try adjusting your filters'
                  : "You're all caught up!"}
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {sortedGroupKeys.map((groupKey) => (
                <div key={groupKey}>
                  {/* Group Header (only show if grouping is enabled) */}
                  {filters.groupBy !== 'none' && (
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="font-medium text-sm text-muted-foreground">{groupKey}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {groupedTasks[groupKey].length}
                      </Badge>
                    </div>
                  )}

                  {/* Task Cards */}
                  <div className="space-y-2">
                    {groupedTasks[groupKey].map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        onStart={handleStartTask}
                        onComplete={handleCompleteTask}
                        onViewDetails={handleViewDetails}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Task Detail Dialog */}
      <TaskDetailDialog
        task={selectedTask}
        open={isDetailOpen}
        onOpenChange={setIsDetailOpen}
        onStart={handleStartTask}
        onComplete={handleCompleteTask}
        onBlock={handleBlockTask}
        onChecklistItemChange={handleChecklistChange}
      />
    </div>
  );
}
