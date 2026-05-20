/**
 * Task Generation Hooks - DawinOS v2.0
 * React hooks for task generation and management
 */

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  Timestamp,
  arrayUnion,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase/firestore';
import { COLLECTIONS, TaskStatus, TaskPriority } from '../config/constants';
import { Task, TaskStage } from '../types/task-generation.types';
import { generateId } from '../utils';

/**
 * Async state interface for hooks
 */
interface AsyncState<T> {
  loading: boolean;
  data: T | null;
  error: string | null;
}

/**
 * Helper: Current Timestamp
 */
function now(): Timestamp {
  return Timestamp.now();
}

/**
 * Hook for employee's assigned tasks
 */
export function useEmployeeTasks(employeeId: string | null) {
  const [state, setState] = useState<AsyncState<Task[]>>({
    loading: true,
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!employeeId) {
      setState({ loading: false, data: [], error: null });
      return;
    }

    const q = query(
      collection(db, COLLECTIONS.SMART_TASKS),
      where('assignment.assigneeId', '==', employeeId),
      where('status', 'in', ['pending', 'in-progress', 'blocked']),
      orderBy('priority', 'desc'),
      orderBy('dueDate', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const tasks = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Task[];

        setState({ loading: false, data: tasks, error: null });
      },
      (error) => {
        console.error('Error loading tasks:', error);
        setState({ loading: false, data: null, error: error.message });
      }
    );

    return () => unsubscribe();
  }, [employeeId]);

  // Computed properties
  const tasks = state.data || [];
  const overdueTasks = tasks.filter(t => 
    t.dueDate && t.dueDate.toDate() < new Date()
  );
  const criticalTasks = tasks.filter(t => t.priority === 'critical');
  const todayTasks = tasks.filter(t => {
    if (!t.dueDate) return false;
    const due = t.dueDate.toDate();
    const today = new Date();
    return due.toDateString() === today.toDateString();
  });

  return {
    ...state,
    tasks,
    overdueTasks,
    criticalTasks,
    todayTasks,
    totalCount: tasks.length,
    overdueCount: overdueTasks.length,
  };
}

/**
 * Hook for a single task with real-time updates
 */
export function useTask(taskId: string | null) {
  const [state, setState] = useState<AsyncState<Task>>({
    loading: true,
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!taskId) {
      setState({ loading: false, data: null, error: null });
      return;
    }

    const unsubscribe = onSnapshot(
      doc(db, COLLECTIONS.SMART_TASKS, taskId),
      (snapshot) => {
        if (snapshot.exists()) {
          setState({
            loading: false,
            data: { id: snapshot.id, ...snapshot.data() } as Task,
            error: null,
          });
        } else {
          setState({ loading: false, data: null, error: 'Task not found' });
        }
      },
      (error) => {
        console.error('Error loading task:', error);
        setState({ loading: false, data: null, error: error.message });
      }
    );

    return () => unsubscribe();
  }, [taskId]);

  return state;
}

/**
 * Hook for task actions
 */
export function useTaskActions() {
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Start working on a task
   */
  const startTask = useCallback(async (taskId: string) => {
    setUpdating(true);
    setError(null);

    try {
      await updateDoc(doc(db, COLLECTIONS.SMART_TASKS, taskId), {
        status: 'in-progress' as TaskStatus,
        stage: 'in_progress' as TaskStage,
        startDate: now(),
        updatedAt: now(),
      });
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setUpdating(false);
    }
  }, []);

  /**
   * Complete a task
   */
  const completeTask = useCallback(async (
    taskId: string,
    completion: {
      outcome: 'success' | 'partial' | 'failed' | 'not_applicable';
      notes?: string;
      deliverables?: { type: string; reference: string; url?: string }[];
    },
    userId: string,
    userName: string
  ) => {
    setUpdating(true);
    setError(null);

    try {
      await updateDoc(doc(db, COLLECTIONS.SMART_TASKS, taskId), {
        status: 'completed' as TaskStatus,
        stage: 'completed' as TaskStage,
        completion: {
          completedAt: now(),
          completedBy: { id: userId, name: userName },
          completionType: 'manual',
          outcome: completion.outcome,
          notes: completion.notes,
          deliverables: completion.deliverables,
        },
        updatedAt: now(),
      });
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setUpdating(false);
    }
  }, []);

  /**
   * Reassign a task
   */
  const reassignTask = useCallback(async (
    taskId: string,
    newAssignee: { id: string; name: string; email: string },
    _reason: string,
    reassignedBy: { id: string; name: string }
  ) => {
    setUpdating(true);
    setError(null);

    try {
      // Note: In a real implementation, we'd need to read the current task
      // and update the previousAssignees array
      await updateDoc(doc(db, COLLECTIONS.SMART_TASKS, taskId), {
        'assignment.assigneeId': newAssignee.id,
        'assignment.assigneeRef': newAssignee,
        'assignment.assignedAt': now(),
        'assignment.assignedBy': reassignedBy,
        'assignment.assignmentMethod': 'manual',
        stage: 'assigned' as TaskStage,
        updatedAt: now(),
      });
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setUpdating(false);
    }
  }, []);

  /**
   * Update task priority
   */
  const updatePriority = useCallback(async (
    taskId: string,
    priority: TaskPriority
  ) => {
    setUpdating(true);
    setError(null);

    try {
      await updateDoc(doc(db, COLLECTIONS.SMART_TASKS, taskId), {
        priority,
        updatedAt: now(),
      });
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setUpdating(false);
    }
  }, []);

  /**
   * Add comment to task
   */
  const addComment = useCallback(async (
    taskId: string,
    comment: string,
    author: { id: string; name: string }
  ) => {
    setUpdating(true);
    setError(null);

    try {
      await updateDoc(doc(db, COLLECTIONS.SMART_TASKS, taskId), {
        comments: arrayUnion({
          id: generateId('comment'),
          text: comment,
          author,
          createdAt: now(),
        }),
        updatedAt: now(),
      });
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setUpdating(false);
    }
  }, []);

  /**
   * Block a task
   */
  const blockTask = useCallback(async (
    taskId: string,
    blockedReason: string
  ) => {
    setUpdating(true);
    setError(null);

    try {
      await updateDoc(doc(db, COLLECTIONS.SMART_TASKS, taskId), {
        status: 'blocked' as TaskStatus,
        stage: 'blocked' as TaskStage,
        blockedReason,
        updatedAt: now(),
      });
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setUpdating(false);
    }
  }, []);

  /**
   * Unblock a task
   */
  const unblockTask = useCallback(async (taskId: string) => {
    setUpdating(true);
    setError(null);

    try {
      await updateDoc(doc(db, COLLECTIONS.SMART_TASKS, taskId), {
        status: 'in-progress' as TaskStatus,
        stage: 'in_progress' as TaskStage,
        blockedReason: null,
        updatedAt: now(),
      });
    } catch (err: any) {
      setError(err.message);
      throw err;
    } finally {
      setUpdating(false);
    }
  }, []);

  return {
    updating,
    error,
    startTask,
    completeTask,
    reassignTask,
    updatePriority,
    addComment,
    blockTask,
    unblockTask,
  };
}

/**
 * Hook for department/subsidiary task overview
 */
export function useTaskOverview(filters: {
  subsidiaryId?: string;
  departmentId?: string;
}) {
  const [state, setState] = useState<AsyncState<{
    total: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    overdue: number;
    unassigned: number;
  }>>({
    loading: true,
    data: null,
    error: null,
  });

  useEffect(() => {
    let q = query(
      collection(db, COLLECTIONS.SMART_TASKS),
      where('status', 'in', ['pending', 'in-progress', 'blocked'])
    );

    if (filters.subsidiaryId) {
      q = query(q, where('subsidiaryId', '==', filters.subsidiaryId));
    }

    if (filters.departmentId) {
      q = query(q, where('departmentId', '==', filters.departmentId));
    }

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const tasks = snapshot.docs.map(doc => doc.data() as Task);
        const nowTime = new Date();

        const overview = {
          total: tasks.length,
          byStatus: tasks.reduce((acc, t) => {
            acc[t.status] = (acc[t.status] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          byPriority: tasks.reduce((acc, t) => {
            acc[t.priority] = (acc[t.priority] || 0) + 1;
            return acc;
          }, {} as Record<string, number>),
          overdue: tasks.filter(t => 
            t.dueDate && t.dueDate.toDate() < nowTime
          ).length,
          unassigned: tasks.filter(t => 
            t.stage === 'pending_assignment'
          ).length,
        };

        setState({ loading: false, data: overview, error: null });
      },
      (error) => {
        console.error('Error loading task overview:', error);
        setState({ loading: false, data: null, error: error.message });
      }
    );

    return () => unsubscribe();
  }, [filters.subsidiaryId, filters.departmentId]);

  return state;
}

/**
 * Hook for tasks by event
 */
export function useTasksByEvent(eventId: string | null) {
  const [state, setState] = useState<AsyncState<Task[]>>({
    loading: true,
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!eventId) {
      setState({ loading: false, data: [], error: null });
      return;
    }

    const q = query(
      collection(db, COLLECTIONS.SMART_TASKS),
      where('context.eventId', '==', eventId),
      orderBy('createdAt', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const tasks = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Task[];

        setState({ loading: false, data: tasks, error: null });
      },
      (error) => {
        console.error('Error loading tasks by event:', error);
        setState({ loading: false, data: null, error: error.message });
      }
    );

    return () => unsubscribe();
  }, [eventId]);

  return {
    ...state,
    tasks: state.data || [],
  };
}
