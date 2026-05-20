/**
 * Smart Task Core Hooks - DawinOS v2.0
 * Unified hooks for the Intelligence Layer
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection,
  query,
  where,
  onSnapshot,
  limit,
} from 'firebase/firestore';
import { db } from '../../../shared/services/firebase/firestore';
import { COLLECTIONS } from '../config/constants';
import {
  DailyWorkSummary,
  MorningBriefing,
  WorkItem,
  WorkInboxFilters,
  WorkInboxSort,
  AIAnalysisResponse,
  AIAnalysisRequest,
} from '../types/smart-task-core.types';
import {
  generateDailyWorkSummary,
  generateMorningBriefing,
  getWorkInbox,
  requestAIAnalysis,
} from '../services/smart-task-core.service';
import { Task } from '../types/task-generation.types';
import { GreyArea } from '../types/grey-area.types';

/**
 * Async state interface for hooks
 */
interface AsyncState<T> {
  loading: boolean;
  data: T | null;
  error: string | null;
}

/**
 * Hook for daily work summary
 */
export function useDailyWorkSummary(employeeId: string | null) {
  const [state, setState] = useState<AsyncState<DailyWorkSummary>>({
    loading: true,
    data: null,
    error: null,
  });

  const refresh = useCallback(async () => {
    if (!employeeId) {
      setState({ loading: false, data: null, error: null });
      return;
    }

    setState(prev => ({ ...prev, loading: true }));

    try {
      const summary = await generateDailyWorkSummary(employeeId);
      setState({ loading: false, data: summary, error: null });
    } catch (error: any) {
      setState({ loading: false, data: null, error: error.message });
    }
  }, [employeeId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    ...state,
    summary: state.data,
    refresh,
  };
}

/**
 * Hook for morning briefing
 */
export function useMorningBriefing(employeeId: string | null) {
  const [state, setState] = useState<AsyncState<MorningBriefing>>({
    loading: true,
    data: null,
    error: null,
  });

  const generate = useCallback(async () => {
    if (!employeeId) {
      setState({ loading: false, data: null, error: null });
      return;
    }

    setState(prev => ({ ...prev, loading: true }));

    try {
      const briefing = await generateMorningBriefing(employeeId);
      setState({ loading: false, data: briefing, error: null });
    } catch (error: any) {
      setState({ loading: false, data: null, error: error.message });
    }
  }, [employeeId]);

  useEffect(() => {
    generate();
  }, [generate]);

  return {
    ...state,
    briefing: state.data,
    regenerate: generate,
  };
}

/**
 * Hook for unified work inbox
 */
export function useWorkInbox(
  employeeId: string | null,
  initialFilters: WorkInboxFilters = {},
  initialSort: WorkInboxSort = { field: 'priority', direction: 'desc' }
) {
  const [items, setItems] = useState<WorkItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<WorkInboxFilters>(initialFilters);
  const [sort, setSort] = useState<WorkInboxSort>(initialSort);

  // Fetch work inbox
  const fetchInbox = useCallback(async () => {
    if (!employeeId) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const inbox = await getWorkInbox(employeeId, filters, sort);
      setItems(inbox);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [employeeId, filters, sort]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!employeeId) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    // Create listeners for both tasks and grey areas
    const taskQuery = query(
      collection(db, COLLECTIONS.SMART_TASKS),
      where('assignment.assigneeId', '==', employeeId),
      where('status', 'in', ['pending', 'in-progress', 'blocked'])
    );

    const gaQuery = query(
      collection(db, COLLECTIONS.GREY_AREAS),
      where('assignedTo.id', '==', employeeId),
      where('status', 'in', ['detected', 'under_review', 'pending_input', 'escalated'])
    );

    const unsubTasks = onSnapshot(taskQuery, () => {
      // When tasks change, refresh the inbox
      fetchInbox();
    }, (err) => {
      setError(err.message);
      setLoading(false);
    });

    const unsubGA = onSnapshot(gaQuery, () => {
      // When grey areas change, refresh the inbox
      fetchInbox();
    }, (err) => {
      setError(err.message);
    });

    return () => {
      unsubTasks();
      unsubGA();
    };
  }, [employeeId, fetchInbox]);

  // Computed values
  const stats = useMemo(() => ({
    total: items.length,
    tasks: items.filter(i => i.type === 'task').length,
    greyAreas: items.filter(i => i.type === 'grey_area').length,
    overdue: items.filter(i => i.isOverdue).length,
    critical: items.filter(i => i.priority === 'critical').length,
  }), [items]);

  return {
    items,
    loading,
    error,
    stats,
    filters,
    setFilters,
    sort,
    setSort,
    refresh: fetchInbox,
  };
}

/**
 * Hook for AI analysis
 */
export function useAIAnalysis() {
  const [state, setState] = useState<AsyncState<AIAnalysisResponse>>({
    loading: false,
    data: null,
    error: null,
  });

  const analyze = useCallback(async (
    type: AIAnalysisRequest['type'],
    context: AIAnalysisRequest['context']
  ) => {
    setState({ loading: true, data: null, error: null });

    try {
      const response = await requestAIAnalysis({
        type,
        context,
      });
      setState({ loading: false, data: response, error: null });
      return response;
    } catch (error: any) {
      setState({ loading: false, data: null, error: error.message });
      throw error;
    }
  }, []);

  return {
    ...state,
    analysis: state.data,
    analyze,
  };
}

/**
 * Hook for quick actions
 */
export function useQuickActions(employeeId: string | null) {
  const [actionState, setActionState] = useState<{
    processing: boolean;
    lastAction?: string;
    error?: string;
  }>({ processing: false });

  /**
   * Quick complete a task
   */
  const quickCompleteTask = useCallback(async (
    _taskId: string,
    _notes?: string
  ) => {
    if (!employeeId) return;
    
    setActionState({ processing: true, lastAction: 'complete_task' });

    try {
      // In full implementation, would call task completion service
      setActionState({ processing: false, lastAction: 'complete_task' });
    } catch (error: any) {
      setActionState({ processing: false, lastAction: 'complete_task', error: error.message });
    }
  }, [employeeId]);

  /**
   * Quick resolve a grey area
   */
  const quickResolveGreyArea = useCallback(async (
    _greyAreaId: string,
    _decision: string
  ) => {
    if (!employeeId) return;
    
    setActionState({ processing: true, lastAction: 'resolve_grey_area' });

    try {
      // In full implementation, would call grey area resolution service
      setActionState({ processing: false, lastAction: 'resolve_grey_area' });
    } catch (error: any) {
      setActionState({ processing: false, lastAction: 'resolve_grey_area', error: error.message });
    }
  }, [employeeId]);

  /**
   * Snooze an item
   */
  const snoozeItem = useCallback(async (
    _itemId: string,
    _itemType: 'task' | 'grey_area',
    _snoozeUntil: Date
  ) => {
    setActionState({ processing: true, lastAction: 'snooze' });

    try {
      // In full implementation, would update due date
      setActionState({ processing: false, lastAction: 'snooze' });
    } catch (error: any) {
      setActionState({ processing: false, lastAction: 'snooze', error: error.message });
    }
  }, []);

  return {
    ...actionState,
    quickCompleteTask,
    quickResolveGreyArea,
    snoozeItem,
  };
}

/**
 * Hook for notification badge counts
 */
export function useNotificationBadges(employeeId: string | null) {
  const [badges, setBadges] = useState({
    tasks: 0,
    greyAreas: 0,
    urgent: 0,
    total: 0,
  });

  useEffect(() => {
    if (!employeeId) {
      setBadges({ tasks: 0, greyAreas: 0, urgent: 0, total: 0 });
      return;
    }

    // Subscribe to task count
    const taskQuery = query(
      collection(db, COLLECTIONS.SMART_TASKS),
      where('assignment.assigneeId', '==', employeeId),
      where('status', 'in', ['pending', 'in-progress']),
      limit(100)
    );

    const gaQuery = query(
      collection(db, COLLECTIONS.GREY_AREAS),
      where('assignedTo.id', '==', employeeId),
      where('status', 'in', ['detected', 'under_review', 'pending_input']),
      limit(50)
    );

    let taskCount = 0;
    let urgentTaskCount = 0;
    let gaCount = 0;
    let criticalGACount = 0;

    const unsubTasks = onSnapshot(taskQuery, (snapshot) => {
      const tasks = snapshot.docs.map(d => d.data() as Task);
      taskCount = tasks.length;
      urgentTaskCount = tasks.filter(t => 
        t.priority === 'critical' || 
        (t.dueDate && t.dueDate.toDate() < new Date())
      ).length;

      setBadges({
        tasks: taskCount,
        greyAreas: gaCount,
        urgent: urgentTaskCount + criticalGACount,
        total: taskCount + gaCount,
      });
    });

    const unsubGA = onSnapshot(gaQuery, (snapshot) => {
      const gas = snapshot.docs.map(d => d.data() as GreyArea);
      gaCount = gas.length;
      criticalGACount = gas.filter(g => g.severity === 'critical').length;

      setBadges({
        tasks: taskCount,
        greyAreas: gaCount,
        urgent: urgentTaskCount + criticalGACount,
        total: taskCount + gaCount,
      });
    });

    return () => {
      unsubTasks();
      unsubGA();
    };
  }, [employeeId]);

  return badges;
}

/**
 * Hook for work item details
 */
export function useWorkItem(itemId: string | null, itemType: 'task' | 'grey_area' | null) {
  const [state, setState] = useState<AsyncState<WorkItem>>({
    loading: true,
    data: null,
    error: null,
  });

  useEffect(() => {
    if (!itemId || !itemType) {
      setState({ loading: false, data: null, error: null });
      return;
    }

    const collectionPath = itemType === 'task' 
      ? COLLECTIONS.SMART_TASKS 
      : COLLECTIONS.GREY_AREAS;

    const unsubscribe = onSnapshot(
      query(collection(db, collectionPath), where('id', '==', itemId), limit(1)),
      (snapshot) => {
        if (snapshot.empty) {
          setState({ loading: false, data: null, error: 'Item not found' });
          return;
        }

        const doc = snapshot.docs[0];
        const data = doc.data();

        const workItem: WorkItem = {
          id: doc.id,
          type: itemType,
          title: data.title,
          description: data.description || '',
          priority: itemType === 'task' ? data.priority : data.severity,
          status: data.status,
          assignedTo: itemType === 'task' ? data.assignment?.assigneeRef : data.assignedTo,
          createdAt: data.createdAt,
          dueDate: itemType === 'task' ? data.dueDate : data.resolutionDeadline,
          isOverdue: false,
          subsidiaryId: data.subsidiaryId,
          departmentId: data.departmentId,
          entity: data as any,
        };

        // Check if overdue
        if (workItem.dueDate && workItem.dueDate.toDate() < new Date()) {
          workItem.isOverdue = true;
        }

        setState({ loading: false, data: workItem, error: null });
      },
      (error) => {
        setState({ loading: false, data: null, error: error.message });
      }
    );

    return () => unsubscribe();
  }, [itemId, itemType]);

  return state;
}
