/**
 * TaskCard Component
 * Displays an individual task in the Employee Task Inbox
 */

import { useNavigate } from 'react-router-dom';
import {
  Clock,
  Play,
  CheckCircle,
  AlertCircle,
  Calendar,
  CheckSquare,
  XCircle,
  Folder,
  ExternalLink,
} from 'lucide-react';

import { Card } from '@/core/components/ui/card';
import { Badge } from '@/core/components/ui/badge';
import { Button } from '@/core/components/ui/button';
import { Progress } from '@/core/components/ui/progress';

import type { EmployeeTask } from '../../hooks/useEmployeeTaskInbox';
import { getDueDateStatus, formatDueDate } from '../../hooks/useEmployeeTaskInbox';
import { getProjectRoute } from '../../utils/getEntityRoute';

// ============================================
// Types
// ============================================

interface TaskCardProps {
  task: EmployeeTask;
  onStart?: (taskId: string) => void;
  onComplete?: (taskId: string) => void;
  onViewDetails?: (task: EmployeeTask) => void;
}

// ============================================
// Priority Badge Component
// ============================================

function PriorityBadge({ priority }: { priority: string }) {
  switch (priority) {
    case 'P0':
      return <Badge className="bg-red-500 hover:bg-red-500 text-white">Critical</Badge>;
    case 'P1':
      return <Badge className="bg-orange-500 hover:bg-orange-500 text-white">High</Badge>;
    case 'P2':
      return <Badge className="bg-blue-500 hover:bg-blue-500 text-white">Medium</Badge>;
    case 'P3':
      return <Badge className="bg-gray-500 hover:bg-gray-500 text-white">Low</Badge>;
    default:
      return <Badge variant="outline">{priority}</Badge>;
  }
}

// ============================================
// Status Badge Component
// ============================================

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'completed':
      return (
        <Badge className="bg-green-100 text-green-700 hover:bg-green-100">
          <CheckCircle className="h-3 w-3 mr-1" />
          Completed
        </Badge>
      );
    case 'in_progress':
      return (
        <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">
          <Play className="h-3 w-3 mr-1" />
          In Progress
        </Badge>
      );
    case 'pending':
      return (
        <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    case 'blocked':
      return (
        <Badge className="bg-red-100 text-red-700 hover:bg-red-100">
          <AlertCircle className="h-3 w-3 mr-1" />
          Blocked
        </Badge>
      );
    case 'cancelled':
      return (
        <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100">
          <XCircle className="h-3 w-3 mr-1" />
          Cancelled
        </Badge>
      );
    default:
      return <Badge variant="outline">{status}</Badge>;
  }
}

// ============================================
// TaskCard Component
// ============================================

export function TaskCard({ task, onStart, onComplete, onViewDetails }: TaskCardProps) {
  const navigate = useNavigate();
  const dueDateStatus = getDueDateStatus(task.dueDate);
  const projectRoute = getProjectRoute({ projectId: task.projectId, sourceModule: task.sourceModule });
  const hasChecklist = task.checklistItems && task.checklistItems.length > 0;
  const completedItems = task.checklistItems?.filter((i) => i.completed).length || 0;
  const totalItems = task.checklistItems?.length || 0;

  const handleCardClick = () => {
    onViewDetails?.(task);
  };

  const handleStartClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onStart?.(task.id);
  };

  const handleCompleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onComplete?.(task.id);
  };

  // Urgency tier for visual indicator
  const urgencyTier =
    task.urgencyScore >= 150
      ? 'bg-red-500'
      : task.urgencyScore >= 100
      ? 'bg-orange-500'
      : task.urgencyScore >= 50
      ? 'bg-blue-500'
      : 'bg-gray-300';

  return (
    <Card
      className="p-0 hover:bg-muted/50 transition-colors cursor-pointer overflow-hidden"
      onClick={handleCardClick}
    >
      <div className="flex items-stretch">
        {/* Urgency indicator bar */}
        <div className={`w-1 flex-shrink-0 ${urgencyTier}`} />
        <div className="flex items-start gap-4 p-4 flex-1 min-w-0">
        {/* Priority & Status Column */}
        <div className="flex flex-col gap-1.5 flex-shrink-0">
          <PriorityBadge priority={task.priority} />
          <StatusBadge status={task.status} />
        </div>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Title */}
          <h3 className="font-medium text-sm line-clamp-1">{task.title}</h3>

          {/* Description - prefer AI description */}
          {(task.aiDescription || task.description) && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
              {task.aiDescription || task.description}
            </p>
          )}

          {/* Meta Row */}
          <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground flex-wrap">
            {/* Due Date */}
            {task.dueDate && (
              <span
                className={`flex items-center gap-1 ${
                  dueDateStatus === 'overdue'
                    ? 'text-red-600 font-medium'
                    : dueDateStatus === 'today'
                    ? 'text-orange-600 font-medium'
                    : dueDateStatus === 'soon'
                    ? 'text-blue-600'
                    : ''
                }`}
              >
                <Calendar className="h-3 w-3" />
                {dueDateStatus === 'overdue' && 'Overdue: '}
                {dueDateStatus === 'today' && 'Due Today'}
                {dueDateStatus !== 'overdue' && dueDateStatus !== 'today' && formatDueDate(task.dueDate)}
              </span>
            )}

            {/* Source Module */}
            <span className="flex items-center gap-1">
              <Folder className="h-3 w-3" />
              {task.sourceModule.replace(/_/g, ' ')}
            </span>

            {/* Project Name */}
            {task.projectName && (
              projectRoute ? (
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(projectRoute); }}
                  className="truncate max-w-[120px] text-blue-600 hover:underline flex items-center gap-1"
                >
                  {task.projectName}
                  <ExternalLink className="h-2.5 w-2.5 flex-shrink-0" />
                </button>
              ) : (
                <span className="truncate max-w-[120px]">{task.projectName}</span>
              )
            )}
          </div>
        </div>

        {/* Checklist Progress */}
        {hasChecklist && (
          <div className="flex-shrink-0 text-right">
            <div className="text-xs text-muted-foreground mb-1">
              {completedItems}/{totalItems} items
            </div>
            <Progress value={task.checklistProgress} className="h-1.5 w-20" />
          </div>
        )}

        {/* Quick Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          {task.status === 'pending' && onStart && (
            <Button variant="ghost" size="sm" onClick={handleStartClick} title="Start Task">
              <Play className="h-4 w-4 text-blue-600" />
            </Button>
          )}
          {task.status === 'in_progress' && onComplete && (
            <Button variant="ghost" size="sm" onClick={handleCompleteClick} title="Complete Task">
              <CheckSquare className="h-4 w-4 text-green-600" />
            </Button>
          )}
        </div>
        </div>
      </div>
    </Card>
  );
}

export default TaskCard;
