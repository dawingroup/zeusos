/**
 * Sales Tasks Page
 * Task management for sales staff — create, track, and complete follow-up tasks
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  CheckSquare,
  Search,
  Plus,
  AlertTriangle,
  Calendar,
  Trash2,
  CheckCircle,
  Circle,
  PlayCircle,
  XCircle,
} from 'lucide-react';
import { useAuth } from '@/shared/hooks';
import { Timestamp } from 'firebase/firestore';
import { createTask, fetchAllTasks, completeTask, updateTask, deleteTask } from '../services/crmTaskService';
import { SALES_TASK_TYPE_LABELS, DEAL_PRIORITY_LABELS, DEAL_PRIORITY_COLORS } from '../constants/crm.constants';
import type { SalesTask, SalesTaskType, SalesTaskStatus, DealPriority } from '../types';
import { KPIGrid, KPICard } from '@/shared/components/data-display';

const STATUS_CONFIG: Record<SalesTaskStatus, { label: string; color: string; Icon: React.ComponentType<{ className?: string }> }> = {
  pending: { label: 'Pending', color: 'bg-gray-100 text-gray-600', Icon: Circle },
  in_progress: { label: 'In Progress', color: 'bg-blue-100 text-blue-600', Icon: PlayCircle },
  completed: { label: 'Completed', color: 'bg-green-100 text-green-600', Icon: CheckCircle },
  cancelled: { label: 'Cancelled', color: 'bg-red-100 text-red-600', Icon: XCircle },
  overdue: { label: 'Overdue', color: 'bg-orange-100 text-orange-700', Icon: AlertTriangle },
};

const TASK_TYPES = Object.keys(SALES_TASK_TYPE_LABELS) as SalesTaskType[];
const PRIORITIES: DealPriority[] = ['low', 'medium', 'high', 'critical'];

function formatDueDate(ts: Timestamp | unknown): { text: string; isOverdue: boolean; isToday: boolean } {
  if (!ts) return { text: '-', isOverdue: false, isToday: false };
  const date = (ts as Timestamp).toDate?.() ?? new Date(((ts as { seconds: number }).seconds ?? 0) * 1000);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const isOverdue = dueDay < today;
  const isToday = dueDay.getTime() === today.getTime();
  const text = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return { text, isOverdue, isToday };
}

export default function SalesTasksPage() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<SalesTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Create form state
  const [newType, setNewType] = useState<SalesTaskType>('follow_up_call');
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPriority, setNewPriority] = useState<DealPriority>('medium');
  const [newDueDate, setNewDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  const loadTasks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchAllTasks();
      setTasks(data);
    } catch (err) {
      console.error('Failed to load tasks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Enrich tasks with overdue status
  const enrichedTasks = useMemo(() => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    return tasks.map((task) => {
      if (task.status === 'completed' || task.status === 'cancelled') return task;
      if (!task.dueDate) return task;
      const dueDate = (task.dueDate as Timestamp).toDate?.() ?? new Date(((task.dueDate as unknown as { seconds: number }).seconds ?? 0) * 1000);
      const dueDay = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      if (dueDay < today) {
        return { ...task, status: 'overdue' as SalesTaskStatus };
      }
      return task;
    });
  }, [tasks]);

  const filtered = useMemo(() => {
    let result = enrichedTasks;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q) ||
          t.assignedToName?.toLowerCase().includes(q)
      );
    }
    if (statusFilter) result = result.filter((t) => t.status === statusFilter);
    if (typeFilter) result = result.filter((t) => t.type === typeFilter);
    return result;
  }, [enrichedTasks, search, statusFilter, typeFilter]);

  // Summary counts
  const counts = useMemo(() => {
    let pending = 0, inProgress = 0, overdue = 0, completed = 0;
    for (const t of enrichedTasks) {
      if (t.status === 'pending') pending++;
      else if (t.status === 'in_progress') inProgress++;
      else if (t.status === 'overdue') overdue++;
      else if (t.status === 'completed') completed++;
    }
    return { pending, inProgress, overdue, completed };
  }, [enrichedTasks]);

  const handleCreateTask = async () => {
    if (!user || !newTitle.trim() || !newDueDate) return;
    setSaving(true);
    try {
      await createTask(
        {
          type: newType,
          title: newTitle.trim(),
          description: newDescription.trim() || undefined,
          status: 'pending',
          priority: newPriority,
          assignedTo: user.uid,
          assignedToName: user.displayName || user.email || 'Unknown',
          dueDate: Timestamp.fromDate(new Date(newDueDate + 'T23:59:59')),
          createdBy: user.uid,
        },
        user.uid
      );
      setShowCreateForm(false);
      setNewTitle('');
      setNewDescription('');
      setNewDueDate('');
      setNewPriority('medium');
      setNewType('follow_up_call');
      await loadTasks();
    } catch (err) {
      console.error('Failed to create task:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async (taskId: string) => {
    try {
      await completeTask(taskId);
      await loadTasks();
    } catch (err) {
      console.error('Failed to complete task:', err);
    }
  };

  const handleStatusChange = async (taskId: string, status: SalesTaskStatus) => {
    try {
      await updateTask(taskId, { status });
      await loadTasks();
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  const handleDelete = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      await loadTasks();
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Sales Tasks</h2>
          <p className="text-sm text-gray-500">
            Manage follow-ups, site visits, and other sales tasks.
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors"
        >
          {showCreateForm ? 'Cancel' : <><Plus className="h-4 w-4" /> New Task</>}
        </button>
      </div>

      {/* Summary Cards */}
      <KPIGrid cols={4}>
        <KPICard label="Pending" value={counts.pending} />
        <KPICard label="In Progress" value={counts.inProgress} />
        <KPICard label="Overdue" value={counts.overdue} trend={counts.overdue > 0 ? 'down' : undefined} />
        <KPICard label="Completed" value={counts.completed} trend="up" />
      </KPIGrid>

      {/* Create Task Form */}
      {showCreateForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Create New Task</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as SalesTaskType)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {TASK_TYPES.map((t) => (
                  <option key={t} value={t}>{SALES_TASK_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="e.g., Follow up with client on quote"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label>
              <input
                type="date"
                value={newDueDate}
                onChange={(e) => setNewDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as DealPriority)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {PRIORITIES.map((p) => (
                  <option key={p} value={p}>{DEAL_PRIORITY_LABELS[p]}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <input
                type="text"
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Optional details..."
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
          <div className="flex justify-end">
            <button
              onClick={handleCreateTask}
              disabled={saving || !newTitle.trim() || !newDueDate}
              className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm min-w-[140px]"
          >
            <option value="">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="overdue">Overdue</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm min-w-[140px]"
          >
            <option value="">All Types</option>
            {TASK_TYPES.map((t) => (
              <option key={t} value={t}>{SALES_TASK_TYPE_LABELS[t]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="text-sm text-gray-500">{filtered.length} task{filtered.length !== 1 ? 's' : ''}</div>

      {/* Task List */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg border p-12 text-center">
          <CheckSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-sm font-medium text-gray-600 mb-1">No tasks yet</h3>
          <p className="text-xs text-gray-400">Create your first task using the button above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => {
            const statusCfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending;
            const StatusIcon = statusCfg.Icon;
            const due = formatDueDate(task.dueDate);
            const isActive = task.status !== 'completed' && task.status !== 'cancelled';

            return (
              <div
                key={task.id}
                className={`bg-white rounded-lg border p-4 transition-colors ${
                  task.status === 'overdue'
                    ? 'border-orange-200 bg-orange-50/30'
                    : task.status === 'completed'
                    ? 'border-gray-100 opacity-70'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Complete button */}
                  <button
                    onClick={() => isActive ? handleComplete(task.id) : undefined}
                    className={`mt-0.5 flex-shrink-0 ${isActive ? 'hover:text-green-600 cursor-pointer' : 'cursor-default'}`}
                    title={isActive ? 'Mark complete' : ''}
                    disabled={!isActive}
                  >
                    <StatusIcon className={`h-5 w-5 ${
                      task.status === 'completed' ? 'text-green-500' :
                      task.status === 'overdue' ? 'text-orange-500' :
                      task.status === 'in_progress' ? 'text-blue-500' :
                      task.status === 'cancelled' ? 'text-red-400' :
                      'text-gray-300'
                    }`} />
                  </button>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className={`text-sm font-medium truncate ${
                        task.status === 'completed' ? 'text-gray-400 line-through' : 'text-gray-900'
                      }`}>
                        {task.title}
                      </h4>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {/* Due date */}
                        <span className={`flex items-center gap-1 text-xs ${
                          due.isOverdue && isActive ? 'text-orange-600 font-medium' :
                          due.isToday && isActive ? 'text-blue-600 font-medium' :
                          'text-gray-400'
                        }`}>
                          <Calendar className="h-3 w-3" />
                          {due.isToday && isActive ? 'Today' : due.text}
                        </span>
                      </div>
                    </div>

                    {task.description && (
                      <p className="text-sm text-gray-500 mt-0.5">{task.description}</p>
                    )}

                    <div className="flex items-center gap-3 mt-2 text-xs flex-wrap">
                      <span className={`px-1.5 py-0.5 rounded ${statusCfg.color}`}>
                        {statusCfg.label}
                      </span>
                      <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">
                        {SALES_TASK_TYPE_LABELS[task.type]}
                      </span>
                      <span className={`font-medium ${DEAL_PRIORITY_COLORS[task.priority] || 'text-gray-500'}`}>
                        {DEAL_PRIORITY_LABELS[task.priority]}
                      </span>
                      <span className="text-gray-400">{task.assignedToName}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {isActive && task.status === 'pending' && (
                      <button
                        onClick={() => handleStatusChange(task.id, 'in_progress')}
                        className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded transition-colors"
                        title="Start task"
                      >
                        <PlayCircle className="h-4 w-4" />
                      </button>
                    )}
                    {isActive && (
                      <button
                        onClick={() => handleComplete(task.id)}
                        className="p-1.5 text-gray-400 hover:text-green-500 hover:bg-green-50 rounded transition-colors"
                        title="Complete"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(task.id)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
