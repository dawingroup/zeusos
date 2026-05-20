/**
 * TaskDetailDrawer Component
 * Right-side drawer showing full task details with checklist management
 */

import { useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  Clock,
  Play,
  CheckCircle,
  AlertCircle,
  Calendar,
  User,
  Folder,
  CheckSquare,
  XCircle,
  Building2,
  ExternalLink,
  Sparkles,
  FileText,
  BookOpen,
  Zap,
} from 'lucide-react';

import { Badge } from '@/core/components/ui/badge';
import { Button } from '@/core/components/ui/button';
import { Progress } from '@/core/components/ui/progress';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/core/components/ui/sheet';

import type { EmployeeTask } from '../../hooks/useEmployeeTaskInbox';
import { getDueDateStatus, formatDueDate } from '../../hooks/useEmployeeTaskInbox';
import { getEntityRoute, getProjectRoute } from '../../utils/getEntityRoute';

// ============================================
// Types
// ============================================

interface TaskDetailDialogProps {
  task: EmployeeTask | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStart?: (taskId: string) => void;
  onComplete?: (taskId: string) => void;
  onBlock?: (taskId: string) => void;
  onChecklistItemChange?: (taskId: string, itemId: string, completed: boolean) => void;
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
// TaskDetailDialog Component
// ============================================

export function TaskDetailDialog({
  task,
  open,
  onOpenChange,
  onStart,
  onComplete,
  onBlock,
  onChecklistItemChange,
}: TaskDetailDialogProps) {
  const navigate = useNavigate();

  if (!task) return null;

  const dueDateStatus = getDueDateStatus(task.dueDate);
  const entityRoute = getEntityRoute({
    entityType: task.entityType,
    entityId: task.entityId,
    projectId: task.projectId,
    sourceModule: task.sourceModule,
  });
  const projectRoute = getProjectRoute({
    projectId: task.projectId,
    sourceModule: task.sourceModule,
  });
  const hasChecklist = task.checklistItems && task.checklistItems.length > 0;
  const completedItems = task.checklistItems?.filter((i) => i.completed).length || 0;
  const totalItems = task.checklistItems?.length || 0;

  const handleStart = () => {
    onStart?.(task.id);
    onOpenChange(false);
  };

  const handleComplete = () => {
    onComplete?.(task.id);
    onOpenChange(false);
  };

  const handleBlock = () => {
    onBlock?.(task.id);
    onOpenChange(false);
  };

  const handleChecklistChange = (itemId: string, completed: boolean) => {
    onChecklistItemChange?.(task.id, itemId, completed);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-blue-500" />
            Task Details
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-6 mt-6">
          {/* Header Section */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <PriorityBadge priority={task.priority} />
              <StatusBadge status={task.status} />
            </div>
            <h3 className="text-lg font-semibold">{task.title}</h3>
            {task.aiUrgencyReason && (
              <div className="flex items-start gap-1.5 mt-1.5 text-xs text-muted-foreground/80">
                <Zap className="h-3 w-3 mt-0.5 text-amber-500 flex-shrink-0" />
                <span>{task.aiUrgencyReason}</span>
              </div>
            )}
            {(task.aiDescription || task.description) && (
              <div className="mt-2">
                {task.aiDescription ? (
                  <>
                    <p className="text-muted-foreground">{task.aiDescription}</p>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/60 mt-1">
                      <Sparkles className="h-3 w-3" />
                      AI-generated context
                    </span>
                  </>
                ) : (
                  <p className="text-muted-foreground">{task.description}</p>
                )}
              </div>
            )}
          </div>

          {/* Meta Info Grid */}
          <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
            {/* Due Date */}
            <div>
              <label className="text-xs text-muted-foreground">Due Date</label>
              <p
                className={`font-medium flex items-center gap-1.5 ${
                  dueDateStatus === 'overdue'
                    ? 'text-red-600'
                    : dueDateStatus === 'today'
                    ? 'text-orange-600'
                    : ''
                }`}
              >
                <Calendar className="h-4 w-4" />
                {task.dueDate ? formatDueDate(task.dueDate) : 'No due date'}
                {dueDateStatus === 'overdue' && ' (Overdue)'}
                {dueDateStatus === 'today' && ' (Today)'}
              </p>
            </div>

            {/* Source Module */}
            <div>
              <label className="text-xs text-muted-foreground">Source Module</label>
              <p className="font-medium flex items-center gap-1.5 capitalize">
                <Folder className="h-4 w-4" />
                {task.sourceModule.replace(/_/g, ' ')}
              </p>
            </div>

            {/* Subsidiary */}
            <div>
              <label className="text-xs text-muted-foreground">Subsidiary</label>
              <p className="font-medium flex items-center gap-1.5 capitalize">
                <Building2 className="h-4 w-4" />
                {task.subsidiary || '-'}
              </p>
            </div>

            {/* Project */}
            {task.projectName && (
              <div>
                <label className="text-xs text-muted-foreground">Project</label>
                {projectRoute ? (
                  <button
                    onClick={() => { navigate(projectRoute); onOpenChange(false); }}
                    className="font-medium text-blue-600 hover:underline flex items-center gap-1.5 cursor-pointer text-left"
                  >
                    {task.projectName}
                    <ExternalLink className="h-3 w-3 flex-shrink-0" />
                  </button>
                ) : (
                  <p className="font-medium">{task.projectName}</p>
                )}
              </div>
            )}

            {/* Source Entity */}
            {entityRoute && task.entityType !== 'project' && (
              <div>
                <label className="text-xs text-muted-foreground">Source Item</label>
                <button
                  onClick={() => { navigate(entityRoute); onOpenChange(false); }}
                  className="font-medium text-blue-600 hover:underline flex items-center gap-1.5 cursor-pointer text-left"
                >
                  {task.entityName || task.entityType?.replace(/-/g, ' ')}
                  <ExternalLink className="h-3 w-3 flex-shrink-0" />
                </button>
              </div>
            )}

            {/* Assigned To */}
            <div>
              <label className="text-xs text-muted-foreground">Assigned To</label>
              <p className="font-medium flex items-center gap-1.5">
                <User className="h-4 w-4" />
                {task.assignedToName || 'You'}
              </p>
            </div>

            {/* Created */}
            <div>
              <label className="text-xs text-muted-foreground">Created</label>
              <p className="font-medium">
                {task.createdAt?.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                }) || '-'}
              </p>
            </div>
          </div>

          {/* Checklist Section */}
          {hasChecklist && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium flex items-center gap-2">
                  <CheckSquare className="h-4 w-4" />
                  Checklist ({completedItems}/{totalItems})
                </h4>
                <Progress value={task.checklistProgress} className="h-2 w-24" />
              </div>
              <div className="space-y-2">
                {task.checklistItems.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={item.completed}
                      onChange={(e) => handleChecklistChange(item.id, e.target.checked)}
                      className="h-4 w-4 mt-0.5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                      disabled={task.status === 'completed' || task.status === 'cancelled'}
                    />
                    <div className="flex-1 min-w-0">
                      <p
                        className={`text-sm ${
                          item.completed ? 'line-through text-muted-foreground' : ''
                        }`}
                      >
                        {item.title}
                        {item.isRequired && <span className="text-red-500 ml-1">*</span>}
                      </p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.description}
                        </p>
                      )}
                      {item.completed && item.completedAt && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Completed{' '}
                          {new Date(item.completedAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                          })}
                          {item.completedBy && ` by ${item.completedBy}`}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI-Generated Checklist */}
          {task.aiChecklist && task.aiChecklist.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Suggested Steps
                </h4>
                <span className="text-xs text-muted-foreground/60">AI-generated</span>
              </div>
              <div className="space-y-2">
                {task.aiChecklist.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 p-3 border border-amber-200/50 bg-amber-50/30 dark:bg-amber-950/10 dark:border-amber-800/30 rounded-lg"
                  >
                    <span className="text-xs font-medium text-amber-600 mt-0.5 min-w-[18px]">
                      {item.order}.
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        {item.title}
                        {item.isRequired && <span className="text-red-500 ml-1">*</span>}
                      </p>
                      {item.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Relevant Documents */}
          {task.aiRelevantDocuments && task.aiRelevantDocuments.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <h4 className="font-medium flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-blue-500" />
                  Relevant References
                </h4>
                <span className="text-xs text-muted-foreground/60">AI-identified</span>
              </div>
              <div className="space-y-2">
                {task.aiRelevantDocuments.map((doc, idx) => (
                  <div
                    key={idx}
                    className="flex items-start gap-3 p-3 border border-blue-200/50 bg-blue-50/30 dark:bg-blue-950/10 dark:border-blue-800/30 rounded-lg"
                  >
                    <FileText className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{doc.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{doc.reason}</p>
                      <Badge variant="outline" className="mt-1 text-[10px] px-1.5 py-0">
                        {doc.type.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes Section */}
          {task.notes && (
            <div>
              <h4 className="font-medium mb-2">Notes</h4>
              <p className="text-sm text-muted-foreground p-3 bg-muted/50 rounded-lg">
                {task.notes}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex flex-wrap gap-2 pt-4 border-t">
              {task.status === 'pending' && (
                <Button variant="outline" onClick={handleStart}>
                  <Play className="h-4 w-4 mr-2" />
                  Start Task
                </Button>
              )}
              {task.status === 'in_progress' && (
                <>
                  <Button variant="outline" onClick={handleComplete}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Complete
                  </Button>
                  <Button variant="outline" onClick={handleBlock}>
                    <AlertCircle className="h-4 w-4 mr-2" />
                    Mark Blocked
                  </Button>
                </>
              )}
              {task.status === 'blocked' && (
                <Button variant="outline" onClick={handleStart}>
                  <Play className="h-4 w-4 mr-2" />
                  Resume Task
                </Button>
              )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export default TaskDetailDialog;
