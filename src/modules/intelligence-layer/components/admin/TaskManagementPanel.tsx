/**
 * Task Management Panel
 * Comprehensive task management interface for the Intelligence Admin Dashboard
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ClipboardList,
  CheckCircle,
  Clock,
  AlertCircle,
  Search,
  User,
  Calendar,
  Play,
  CheckSquare,
  XCircle,
  ExternalLink,
  Folder,
  Sparkles,
  BookOpen,
  FileText,
} from 'lucide-react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  doc,
  updateDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import { INTELLIGENCE_SOURCE_MODULES } from '@/modules/intelligence-layer/constants/shared';
import { getEntityRoute, getProjectRoute } from '../../utils/getEntityRoute';

import { Card, CardContent, CardHeader, CardTitle } from '@/core/components/ui/card';
import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import { Input } from '@/core/components/ui/input';
import { Progress } from '@/core/components/ui/progress';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/core/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/core/components/ui/sheet';

// ============================================
// Types
// ============================================

interface TaskChecklistItem {
  id: string;
  title: string;
  description?: string;
  isRequired: boolean;
  isCompleted: boolean;
  completedAt?: Timestamp;
  completedBy?: string;
}

interface GeneratedTask {
  id: string;
  eventId: string;
  templateId: string;
  title: string;
  description: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled' | 'blocked';
  assignedTo?: string;
  assignedToName?: string;
  dueDate?: Timestamp;
  checklistItems: TaskChecklistItem[];
  sourceModule: string;
  subsidiary: string;
  entityId?: string;
  entityType?: string;
  entityName?: string;
  projectId?: string;
  projectName?: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  completedAt?: Timestamp;
  notes?: string;
  aiDescription?: string;
  aiChecklist?: { id: string; title: string; description: string; isRequired: boolean; order: number; completed: boolean }[];
  aiRelevantDocuments?: { name: string; type: string; reason: string }[];
}

type StatusFilter = 'all' | 'pending' | 'in_progress' | 'completed' | 'blocked';
type PriorityFilter = 'all' | 'P0' | 'P1' | 'P2' | 'P3';

// ============================================
// Task Management Panel Component
// ============================================

export function TaskManagementPanel() {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<GeneratedTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [moduleFilter, setModuleFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTask, setSelectedTask] = useState<GeneratedTask | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Available modules for filtering (from shared constants)
  const modules = [
    { value: 'all', label: 'All Modules' },
    ...INTELLIGENCE_SOURCE_MODULES,
  ];

  // Fetch tasks based on filters
  useEffect(() => {
    setLoading(true);

    const tasksRef = collection(db, 'generatedTasks');
    let constraints: any[] = [orderBy('createdAt', 'desc'), limit(200)];

    // Status filter
    if (statusFilter !== 'all') {
      constraints = [where('status', '==', statusFilter), ...constraints];
    }

    // Priority filter
    if (priorityFilter !== 'all') {
      constraints = [where('priority', '==', priorityFilter), ...constraints];
    }

    // Module filter
    if (moduleFilter !== 'all') {
      constraints = [where('sourceModule', '==', moduleFilter), ...constraints];
    }

    const q = query(tasksRef, ...constraints);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const taskData = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          checklistItems: (data.checklistItems || []).map((item: any, idx: number) => ({
            id: item.id || String(idx + 1),
            title: item.title || item.text || '',
            description: item.description || '',
            isRequired: item.isRequired ?? false,
            isCompleted: item.isCompleted ?? item.completed ?? false,
            completedAt: item.completedAt,
            completedBy: item.completedBy,
          })),
        };
      }) as GeneratedTask[];

      // Client-side filters
      let filtered = taskData;

      // Search filter
      if (searchQuery) {
        filtered = filtered.filter(t =>
          t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.assignedToName?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      // Assignee filter
      if (assigneeFilter !== 'all') {
        if (assigneeFilter === 'unassigned') {
          filtered = filtered.filter(t => !t.assignedTo);
        } else {
          filtered = filtered.filter(t => t.assignedTo === assigneeFilter);
        }
      }

      setTasks(filtered);
      setLoading(false);
    }, (error) => {
      console.error('Error fetching tasks:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [statusFilter, priorityFilter, moduleFilter, searchQuery, assigneeFilter]);

  // Update task status
  const updateTaskStatus = async (taskId: string, newStatus: string) => {
    try {
      const taskRef = doc(db, 'generatedTasks', taskId);
      const updates: Record<string, any> = {
        status: newStatus,
        updatedAt: Timestamp.now(),
      };

      if (newStatus === 'completed') {
        updates.completedAt = Timestamp.now();
      }

      await updateDoc(taskRef, updates);
    } catch (error) {
      console.error('Error updating task:', error);
    }
  };

  // Update checklist item
  const updateChecklistItem = async (taskId: string, itemId: string, isCompleted: boolean) => {
    try {
      const task = tasks.find(t => t.id === taskId);
      if (!task) return;

      const updatedChecklist = task.checklistItems.map(item =>
        item.id === itemId
          ? {
              ...item,
              isCompleted,
              completedAt: isCompleted ? Timestamp.now() : undefined,
            }
          : item
      );

      const taskRef = doc(db, 'generatedTasks', taskId);
      await updateDoc(taskRef, {
        checklistItems: updatedChecklist,
        updatedAt: Timestamp.now(),
      });
    } catch (error) {
      console.error('Error updating checklist:', error);
    }
  };

  // Get priority badge
  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'P0':
        return <Badge className="bg-red-500 hover:bg-red-500">Critical</Badge>;
      case 'P1':
        return <Badge className="bg-orange-500 hover:bg-orange-500">High</Badge>;
      case 'P2':
        return <Badge className="bg-blue-500 hover:bg-blue-500">Medium</Badge>;
      case 'P3':
        return <Badge className="bg-gray-500 hover:bg-gray-500">Low</Badge>;
      default:
        return <Badge variant="outline">{priority}</Badge>;
    }
  };

  // Get status badge
  const getStatusBadge = (status: string) => {
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
  };

  // Format timestamp
  const formatDate = (timestamp: Timestamp | undefined) => {
    if (!timestamp) return '-';
    const date = timestamp.toDate();
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Calculate checklist progress
  const getChecklistProgress = (items: TaskChecklistItem[]) => {
    if (!items || items.length === 0) return 0;
    const completed = items.filter(i => i.isCompleted).length;
    return Math.round((completed / items.length) * 100);
  };

  // Get due date status
  const getDueDateStatus = (dueDate: Timestamp | undefined) => {
    if (!dueDate) return 'none';
    const now = new Date();
    const due = dueDate.toDate();
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return 'overdue';
    if (diffDays <= 1) return 'today';
    if (diffDays <= 3) return 'soon';
    return 'ok';
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            {/* Search */}
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Status Filter */}
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
              <SelectTrigger className="w-[150px]">
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
            <Select value={priorityFilter} onValueChange={(v) => setPriorityFilter(v as PriorityFilter)}>
              <SelectTrigger className="w-[150px]">
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

            {/* Module Filter */}
            <Select value={moduleFilter} onValueChange={setModuleFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Module" />
              </SelectTrigger>
              <SelectContent>
                {modules.map((module) => (
                  <SelectItem key={module.value} value={module.value}>
                    {module.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Assignee Filter */}
            <Select value={assigneeFilter} onValueChange={setAssigneeFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Assignee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Assignees</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Task Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Total</div>
          <div className="text-2xl font-bold">{tasks.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Pending</div>
          <div className="text-2xl font-bold text-amber-600">
            {tasks.filter(t => t.status === 'pending').length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">In Progress</div>
          <div className="text-2xl font-bold text-blue-600">
            {tasks.filter(t => t.status === 'in_progress').length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Completed</div>
          <div className="text-2xl font-bold text-green-600">
            {tasks.filter(t => t.status === 'completed').length}
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground">Blocked</div>
          <div className="text-2xl font-bold text-red-600">
            {tasks.filter(t => t.status === 'blocked').length}
          </div>
        </Card>
      </div>

      {/* Tasks List */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4 text-green-500" />
              Generated Tasks
            </CardTitle>
            <Badge variant="outline">{tasks.length} tasks</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-20 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : tasks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No tasks found matching your filters</p>
            </div>
          ) : (
            <div className="space-y-2">
              {tasks.map((task) => {
                const dueDateStatus = getDueDateStatus(task.dueDate);
                const checklistProgress = getChecklistProgress(task.checklistItems);

                return (
                  <div
                    key={task.id}
                    className="flex items-start gap-4 p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                    onClick={() => {
                      setSelectedTask(task);
                      setIsDetailOpen(true);
                    }}
                  >
                    {/* Priority & Status */}
                    <div className="flex flex-col gap-1">
                      {getPriorityBadge(task.priority)}
                      {getStatusBadge(task.status)}
                    </div>

                    {/* Task Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{task.title}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-1">
                        {task.aiDescription || task.description}
                      </p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        {task.assignedToName && (
                          <span className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {task.assignedToName}
                          </span>
                        )}
                        {task.dueDate && (
                          <span className={`flex items-center gap-1 ${
                            dueDateStatus === 'overdue' ? 'text-red-600' :
                            dueDateStatus === 'today' ? 'text-amber-600' :
                            dueDateStatus === 'soon' ? 'text-blue-600' : ''
                          }`}>
                            <Calendar className="h-3 w-3" />
                            Due: {formatDate(task.dueDate)}
                          </span>
                        )}
                        <span>{task.sourceModule.replace('_', ' ')}</span>
                      </div>
                    </div>

                    {/* Checklist Progress */}
                    {task.checklistItems && task.checklistItems.length > 0 && (
                      <div className="text-right">
                        <div className="text-xs text-muted-foreground mb-1">
                          {task.checklistItems.filter(i => i.isCompleted).length}/{task.checklistItems.length} items
                        </div>
                        <Progress value={checklistProgress} className="h-1.5 w-20" />
                      </div>
                    )}

                    {/* Quick Actions */}
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      {task.status === 'pending' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateTaskStatus(task.id, 'in_progress')}
                        >
                          <Play className="h-4 w-4" />
                        </Button>
                      )}
                      {task.status === 'in_progress' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => updateTaskStatus(task.id, 'completed')}
                        >
                          <CheckSquare className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Task Detail Drawer */}
      <Sheet open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-green-500" />
              Task Details
            </SheetTitle>
          </SheetHeader>
          {selectedTask && (
            <div className="space-y-6 mt-6">
              {/* Header */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  {getPriorityBadge(selectedTask.priority)}
                  {getStatusBadge(selectedTask.status)}
                </div>
                <h3 className="text-lg font-semibold">{selectedTask.title}</h3>
                <p className="text-muted-foreground mt-1">{selectedTask.aiDescription || selectedTask.description}</p>
                {selectedTask.aiDescription && (
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground/60 mt-1">
                    <Sparkles className="h-3 w-3" />
                    AI-generated context
                  </span>
                )}
              </div>

              {/* Meta Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <label className="text-xs text-muted-foreground">Assigned To</label>
                  <p className="font-medium flex items-center gap-1.5">
                    <User className="h-4 w-4" />
                    {selectedTask.assignedToName || 'Unassigned'}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Due Date</label>
                  <p className="font-medium flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" />
                    {formatDate(selectedTask.dueDate)}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Source Module</label>
                  <p className="font-medium capitalize flex items-center gap-1.5">
                    <Folder className="h-4 w-4" />
                    {selectedTask.sourceModule.replace('_', ' ')}
                  </p>
                </div>
                <div>
                  <label className="text-xs text-muted-foreground">Created</label>
                  <p className="font-medium">{formatDate(selectedTask.createdAt)}</p>
                </div>

                {/* Project Link */}
                {selectedTask.projectName && (() => {
                  const route = getProjectRoute({ projectId: selectedTask.projectId, sourceModule: selectedTask.sourceModule });
                  return (
                    <div>
                      <label className="text-xs text-muted-foreground">Project</label>
                      {route ? (
                        <button
                          onClick={() => { navigate(route); setIsDetailOpen(false); }}
                          className="font-medium text-blue-600 hover:underline flex items-center gap-1.5 cursor-pointer text-left"
                        >
                          {selectedTask.projectName}
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </button>
                      ) : (
                        <p className="font-medium">{selectedTask.projectName}</p>
                      )}
                    </div>
                  );
                })()}

                {/* Source Entity Link */}
                {(() => {
                  const route = getEntityRoute({
                    entityType: selectedTask.entityType,
                    entityId: selectedTask.entityId,
                    projectId: selectedTask.projectId,
                    sourceModule: selectedTask.sourceModule,
                  });
                  if (!route || selectedTask.entityType === 'project') return null;
                  return (
                    <div>
                      <label className="text-xs text-muted-foreground">Source Item</label>
                      <button
                        onClick={() => { navigate(route); setIsDetailOpen(false); }}
                        className="font-medium text-blue-600 hover:underline flex items-center gap-1.5 cursor-pointer text-left"
                      >
                        {selectedTask.entityName || selectedTask.entityType?.replace(/-/g, ' ')}
                        <ExternalLink className="h-3 w-3 flex-shrink-0" />
                      </button>
                    </div>
                  );
                })()}
              </div>

              {/* Checklist */}
              {selectedTask.checklistItems && selectedTask.checklistItems.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <CheckSquare className="h-4 w-4" />
                    Checklist ({selectedTask.checklistItems.filter(i => i.isCompleted).length}/{selectedTask.checklistItems.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedTask.checklistItems.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-start gap-3 p-3 border rounded-lg"
                      >
                        <input
                          type="checkbox"
                          checked={item.isCompleted}
                          onChange={(e) =>
                            updateChecklistItem(selectedTask.id, item.id, e.target.checked)
                          }
                          className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <div className="flex-1">
                          <p className={`text-sm ${item.isCompleted ? 'line-through text-muted-foreground' : ''}`}>
                            {item.title}
                            {item.isRequired && <span className="text-red-500 ml-1">*</span>}
                          </p>
                          {item.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* AI-Generated Checklist */}
              {selectedTask.aiChecklist && selectedTask.aiChecklist.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-amber-500" />
                    Suggested Steps
                    <span className="text-xs text-muted-foreground/60 font-normal">AI-generated</span>
                  </h4>
                  <div className="space-y-2">
                    {selectedTask.aiChecklist.map((item) => (
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
                            <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Relevant Documents */}
              {selectedTask.aiRelevantDocuments && selectedTask.aiRelevantDocuments.length > 0 && (
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <BookOpen className="h-4 w-4 text-blue-500" />
                    Relevant References
                    <span className="text-xs text-muted-foreground/60 font-normal">AI-identified</span>
                  </h4>
                  <div className="space-y-2">
                    {selectedTask.aiRelevantDocuments.map((doc, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-3 p-3 border border-blue-200/50 bg-blue-50/30 dark:bg-blue-950/10 dark:border-blue-800/30 rounded-lg"
                      >
                        <FileText className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{doc.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{doc.reason}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex justify-between pt-4 border-t">
                <div className="flex gap-2">
                  {selectedTask.status === 'pending' && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        updateTaskStatus(selectedTask.id, 'in_progress');
                        setIsDetailOpen(false);
                      }}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Start Task
                    </Button>
                  )}
                  {selectedTask.status === 'in_progress' && (
                    <>
                      <Button
                        variant="outline"
                        onClick={() => {
                          updateTaskStatus(selectedTask.id, 'completed');
                          setIsDetailOpen(false);
                        }}
                      >
                        <CheckCircle className="h-4 w-4 mr-2" />
                        Complete
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          updateTaskStatus(selectedTask.id, 'blocked');
                          setIsDetailOpen(false);
                        }}
                      >
                        <AlertCircle className="h-4 w-4 mr-2" />
                        Mark Blocked
                      </Button>
                    </>
                  )}
                </div>
                <Button variant="outline" onClick={() => setIsDetailOpen(false)}>
                  Close
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

export default TaskManagementPanel;
