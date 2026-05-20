/**
 * Intelligence Admin Overview Hook
 * Provides aggregated metrics and data for the Intelligence Admin Dashboard
 */

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import { STANDARD_ROLE_PROFILES } from '@/modules/intelligence/config/role-profile.constants';
import { WORKLOAD_DEFAULTS } from '@/modules/intelligence-layer/constants/shared';

// ============================================
// Types
// ============================================

export interface EventStats {
  today: number;
  processed: number;
  pending: number;
  failed: number;
}

export interface TaskStats {
  totalTasks: number;
  pendingTasks: number;
  activeTasks: number;
  completedToday: number;
  completionRate: number;
}

export interface WorkloadStats {
  totalEmployees: number;
  activeEmployees: number;
  avgUtilization: number;
  underCapacity: number;
  atCapacity: number;
  overCapacity: number;
}

export interface RoleStats {
  totalRoles: number;
  finishesRoles: number;
  rolesWithEmployees: number;
}

export interface RecentEvent {
  id: string;
  name: string;
  module: string;
  status: 'processed' | 'pending' | 'failed';
  time: string;
  tasksGenerated: number;
}

export interface TopEmployee {
  id: string;
  name: string;
  initials: string;
  role: string;
  activeTasks: number;
  utilization: number;
}

export interface IntelligenceAdminOverview {
  eventStats: EventStats;
  taskStats: TaskStats;
  workloadStats: WorkloadStats;
  roleStats: RoleStats;
  recentEvents: RecentEvent[];
  topEmployees: TopEmployee[];
}

// ============================================
// Hook
// ============================================

export function useIntelligenceAdminOverview() {
  const [overview, setOverview] = useState<IntelligenceAdminOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayTimestamp = Timestamp.fromDate(today);

      // Fetch events stats
      const eventStats = await fetchEventStats(todayTimestamp);

      // Fetch task stats
      const taskStats = await fetchTaskStats(todayTimestamp);

      // Fetch workload stats
      const workloadStats = await fetchWorkloadStats();

      // Get role stats from constants
      const roleStats = getRoleStats();

      // Fetch recent events
      const recentEvents = await fetchRecentEvents();

      // Fetch top employees
      const topEmployees = await fetchTopEmployees();

      setOverview({
        eventStats,
        taskStats,
        workloadStats,
        roleStats,
        recentEvents,
        topEmployees,
      });
    } catch (err) {
      console.error('Error fetching intelligence admin overview:', err);
      setError('Failed to load overview data');

      // Set default values on error
      setOverview({
        eventStats: { today: 0, processed: 0, pending: 0, failed: 0 },
        taskStats: { totalTasks: 0, pendingTasks: 0, activeTasks: 0, completedToday: 0, completionRate: 0 },
        workloadStats: { totalEmployees: 0, activeEmployees: 0, avgUtilization: 0, underCapacity: 0, atCapacity: 0, overCapacity: 0 },
        roleStats: getRoleStats(),
        recentEvents: [],
        topEmployees: [],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  return {
    overview,
    loading,
    error,
    refresh: fetchOverview,
  };
}

// ============================================
// Helper Functions
// ============================================

async function fetchEventStats(todayTimestamp: Timestamp): Promise<EventStats> {
  try {
    const eventsRef = collection(db, 'businessEvents');

    // Events today
    const todayQuery = query(
      eventsRef,
      where('createdAt', '>=', todayTimestamp),
      limit(500)
    );
    const todaySnapshot = await getDocs(todayQuery);

    let processed = 0;
    let pending = 0;
    let failed = 0;

    todaySnapshot.docs.forEach(doc => {
      const status = doc.data().status;
      if (status === 'processed') processed++;
      else if (status === 'pending') pending++;
      else if (status === 'failed') failed++;
    });

    return {
      today: todaySnapshot.size,
      processed,
      pending,
      failed,
    };
  } catch {
    return { today: 0, processed: 0, pending: 0, failed: 0 };
  }
}

async function fetchTaskStats(todayTimestamp: Timestamp): Promise<TaskStats> {
  try {
    const tasksRef = collection(db, 'generatedTasks');

    // All tasks
    const allQuery = query(tasksRef, limit(1000));
    const allSnapshot = await getDocs(allQuery);

    let pendingTasks = 0;
    let activeTasks = 0;
    let completedToday = 0;
    let totalCompleted = 0;

    allSnapshot.docs.forEach(doc => {
      const data = doc.data();
      const status = data.status;

      if (status === 'pending') pendingTasks++;
      else if (status === 'in_progress') activeTasks++;
      else if (status === 'completed') {
        totalCompleted++;
        if (data.completedAt && data.completedAt >= todayTimestamp) {
          completedToday++;
        }
      }
    });

    const totalTasks = allSnapshot.size;
    const completionRate = totalTasks > 0
      ? Math.round((totalCompleted / totalTasks) * 100)
      : 0;

    return {
      totalTasks,
      pendingTasks,
      activeTasks,
      completedToday,
      completionRate,
    };
  } catch {
    return { totalTasks: 0, pendingTasks: 0, activeTasks: 0, completedToday: 0, completionRate: 0 };
  }
}

async function fetchWorkloadStats(): Promise<WorkloadStats> {
  try {
    const employeesRef = collection(db, 'employees');

    // Get active employees across all subsidiaries
    const activeQuery = query(
      employeesRef,
      where('employmentStatus', 'in', ['active', 'probation']),
      limit(200)
    );
    const activeSnapshot = await getDocs(activeQuery);

    // Calculate workload distribution from actual task data
    const activeCount = activeSnapshot.size;
    let totalUtilization = 0;
    let underCapacity = 0;
    let atCapacity = 0;
    let overCapacity = 0;

    for (const empDoc of activeSnapshot.docs) {
      const data = empDoc.data();
      const activeTaskCount = data.workload?.activeTaskCount ?? 0;
      const maxCapacity = data.workload?.maxConcurrent ?? WORKLOAD_DEFAULTS.DEFAULT_MAX_CAPACITY;
      const utilization = maxCapacity > 0 ? Math.round((activeTaskCount / maxCapacity) * 100) : 0;

      totalUtilization += utilization;

      if (utilization >= 90) overCapacity++;
      else if (utilization >= 60) atCapacity++;
      else underCapacity++;
    }

    const avgUtilization = activeCount > 0 ? Math.round(totalUtilization / activeCount) : 0;

    return {
      totalEmployees: activeSnapshot.size,
      activeEmployees: activeCount,
      avgUtilization,
      underCapacity,
      atCapacity,
      overCapacity,
    };
  } catch {
    return { totalEmployees: 0, activeEmployees: 0, avgUtilization: 0, underCapacity: 0, atCapacity: 0, overCapacity: 0 };
  }
}

function getRoleStats(): RoleStats {
  const allRoles = Object.keys(STANDARD_ROLE_PROFILES);
  const finishesRoles = Object.values(STANDARD_ROLE_PROFILES)
    .filter(role => role.subsidiaryId === 'finishes')
    .length;

  return {
    totalRoles: allRoles.length,
    finishesRoles,
    rolesWithEmployees: 0, // Would need to query role assignments
  };
}

async function fetchRecentEvents(): Promise<RecentEvent[]> {
  try {
    const eventsRef = collection(db, 'businessEvents');
    const recentQuery = query(
      eventsRef,
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const snapshot = await getDocs(recentQuery);

    return snapshot.docs.map(doc => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate();
      const timeAgo = createdAt ? getTimeAgo(createdAt) : 'Unknown';

      return {
        id: doc.id,
        name: data.eventName || data.eventType || 'Unknown Event',
        module: data.sourceModule || 'system',
        status: data.status || 'pending',
        time: timeAgo,
        tasksGenerated: data.tasksGenerated || 0,
      };
    });
  } catch {
    return [];
  }
}

async function fetchTopEmployees(): Promise<TopEmployee[]> {
  try {
    const employeesRef = collection(db, 'employees');
    const activeQuery = query(
      employeesRef,
      where('employmentStatus', 'in', ['active', 'probation']),
      limit(10)
    );
    const snapshot = await getDocs(activeQuery);

    return snapshot.docs
      .map(doc => {
        const data = doc.data();
        const firstName = data.firstName || '';
        const lastName = data.lastName || '';
        const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
        const activeTaskCount = data.workload?.activeTaskCount ?? 0;
        const maxCapacity = data.workload?.maxConcurrent ?? WORKLOAD_DEFAULTS.DEFAULT_MAX_CAPACITY;
        const utilization = data.workload?.utilizationPercent
          ?? (maxCapacity > 0 ? Math.min(Math.round((activeTaskCount / maxCapacity) * 100), 100) : 0);

        return {
          id: doc.id,
          name: `${firstName} ${lastName}`.trim() || 'Unknown',
          initials: initials || '?',
          role: data.position?.title || 'Team Member',
          activeTasks: activeTaskCount,
          utilization,
        };
      })
      .sort((a, b) => b.activeTasks - a.activeTasks)
      .slice(0, 5);
  } catch {
    return [];
  }
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}

export default useIntelligenceAdminOverview;
