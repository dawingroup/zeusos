/**
 * GlobalTaskButton Component
 * Quick access button for viewing assigned tasks - appears in the app header
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ClipboardList, ChevronRight, Clock, AlertCircle, Play } from 'lucide-react';
import {
  collection,
  query,
  where,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import { useAuth } from '@/shared/hooks';

import { Button } from '@/core/components/ui/button';
import { Badge } from '@/core/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/core/components/ui/dropdown-menu';

// ============================================
// Types
// ============================================

interface TaskSummary {
  id: string;
  title: string;
  priority: 'P0' | 'P1' | 'P2' | 'P3';
  status: 'pending' | 'in_progress';
  dueDate?: Date;
}

interface TaskStats {
  total: number;
  pending: number;
  inProgress: number;
  overdue: number;
}

// ============================================
// GlobalTaskButton Component
// ============================================

export function GlobalTaskButton() {
  const { user } = useAuth();
  const userId = user?.uid;
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<TaskSummary[]>([]);
  const [stats, setStats] = useState<TaskStats>({ total: 0, pending: 0, inProgress: 0, overdue: 0 });
  const [isOpen, setIsOpen] = useState(false);

  // Subscribe to user's active tasks
  useEffect(() => {
    if (!userId) return;

    const tasksRef = collection(db, 'generatedTasks');
    const q = query(
      tasksRef,
      where('assignedTo', '==', userId),
      where('status', 'in', ['pending', 'in_progress'])
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      let pending = 0;
      let inProgress = 0;
      let overdue = 0;

      const taskData: TaskSummary[] = snapshot.docs.map((doc) => {
        const data = doc.data();
        const dueDate = data.dueDate?.toDate();

        // Count stats
        if (data.status === 'pending') pending++;
        if (data.status === 'in_progress') inProgress++;
        if (dueDate && dueDate < today && data.status !== 'completed') {
          overdue++;
        }

        return {
          id: doc.id,
          title: data.title,
          priority: data.priority,
          status: data.status,
          dueDate,
        };
      });

      // Sort by priority (P0 first) then by due date
      taskData.sort((a, b) => {
        const priorityOrder = { P0: 0, P1: 1, P2: 2, P3: 3 };
        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
          return priorityOrder[a.priority] - priorityOrder[b.priority];
        }
        if (a.dueDate && b.dueDate) {
          return a.dueDate.getTime() - b.dueDate.getTime();
        }
        return 0;
      });

      setTasks(taskData.slice(0, 5)); // Show top 5
      setStats({
        total: taskData.length,
        pending,
        inProgress,
        overdue,
      });
    }, (error) => {
      console.error('GlobalTaskButton: Failed to subscribe to tasks:', error);
      // Reset to empty state on error
      setTasks([]);
      setStats({ total: 0, pending: 0, inProgress: 0, overdue: 0 });
    });

    return () => unsubscribe();
  }, [userId]);

  const handleViewAll = () => {
    setIsOpen(false);
    navigate('/my-tasks');
  };

  const handleTaskClick = (taskId: string) => {
    setIsOpen(false);
    navigate(`/my-tasks?task=${taskId}`);
  };

  // Priority colors
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'P0': return 'bg-red-500';
      case 'P1': return 'bg-orange-500';
      case 'P2': return 'bg-blue-500';
      case 'P3': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  // Don't show if no userId
  if (!userId) return null;

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative h-9 w-9 p-0"
          title="My Tasks"
        >
          <ClipboardList className="h-5 w-5" />
          {stats.total > 0 && (
            <Badge
              className={`absolute -top-1 -right-1 h-5 min-w-5 px-1 text-xs ${
                stats.overdue > 0 ? 'bg-red-500' : 'bg-blue-500'
              }`}
            >
              {stats.total > 99 ? '99+' : stats.total}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-80 p-0" align="end">
        {/* Header */}
        <div className="p-3 border-b">
          <div className="flex items-center justify-between">
            <h4 className="font-semibold text-sm">My Tasks</h4>
            <div className="flex gap-2">
              {stats.pending > 0 && (
                <Badge variant="secondary" className="text-xs">
                  <Clock className="h-3 w-3 mr-1" />
                  {stats.pending}
                </Badge>
              )}
              {stats.inProgress > 0 && (
                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">
                  <Play className="h-3 w-3 mr-1" />
                  {stats.inProgress}
                </Badge>
              )}
              {stats.overdue > 0 && (
                <Badge variant="secondary" className="text-xs bg-red-100 text-red-700">
                  <AlertCircle className="h-3 w-3 mr-1" />
                  {stats.overdue}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Task List */}
        <div className="max-h-64 overflow-y-auto">
          {tasks.length === 0 ? (
            <div className="p-4 text-center text-muted-foreground text-sm">
              <ClipboardList className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No active tasks</p>
            </div>
          ) : (
            <div className="py-1">
              {tasks.map((task) => (
                <button
                  key={task.id}
                  onClick={() => handleTaskClick(task.id)}
                  className="w-full px-3 py-2 text-left hover:bg-muted/50 transition-colors flex items-start gap-2"
                >
                  <div
                    className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${getPriorityColor(task.priority)}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{task.title}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span className="capitalize">{task.status.replace('_', ' ')}</span>
                      {task.dueDate && (
                        <>
                          <span>•</span>
                          <span className={task.dueDate < new Date() ? 'text-red-600' : ''}>
                            {task.dueDate.toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-2 border-t">
          <Button
            variant="ghost"
            className="w-full justify-between text-sm"
            onClick={handleViewAll}
          >
            View all tasks
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default GlobalTaskButton;
