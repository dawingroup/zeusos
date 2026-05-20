// ============================================================================
// USE ANOMALIES HOOK
// DawinOS v2.0 - Intelligence Layer
// Detect anomalies from real business events and task data
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
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
import type { Anomaly } from '../types';

const ANOMALIES_COLLECTION = 'intelligenceAnomalies';

interface UseAnomaliesReturn {
  anomalies: Anomaly[];
  loading: boolean;
  error: string | null;
  acknowledgeAnomaly: (anomaly: Anomaly) => Promise<void>;
  investigateAnomaly: (anomaly: Anomaly) => Promise<void>;
  resolveAnomaly: (anomaly: Anomaly, resolution?: string) => Promise<void>;
  markFalsePositive: (anomaly: Anomaly) => Promise<void>;
}

export const useAnomalies = (
  statusFilter?: string[]
): UseAnomaliesReturn => {
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const constraints: any[] = [
      orderBy('detectedAt', 'desc'),
      limit(50),
    ];

    if (statusFilter && statusFilter.length > 0 && statusFilter.length <= 10) {
      constraints.unshift(where('status', 'in', statusFilter));
    }

    const q = query(collection(db, ANOMALIES_COLLECTION), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          generateAnomaliesFromEvents().then((generated) => {
            setAnomalies(generated);
            setLoading(false);
          });
          return;
        }

        const data = snapshot.docs.map((d) => {
          const raw = d.data();
          return {
            id: d.id,
            type: raw.type || 'unknown',
            severity: raw.severity || 'medium',
            title: raw.title || '',
            description: raw.description || '',
            sourceModule: raw.sourceModule || 'design_manager',
            detectedAt: raw.detectedAt?.toDate() || new Date(),
            metric: raw.metric,
            affectedEntities: raw.affectedEntities,
            suggestedActions: raw.suggestedActions,
            status: raw.status || 'new',
            acknowledgedBy: raw.acknowledgedBy,
            resolvedAt: raw.resolvedAt?.toDate(),
            resolution: raw.resolution,
          } as Anomaly;
        });

        setAnomalies(data);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching anomalies:', err);
        generateAnomaliesFromEvents().then((generated) => {
          setAnomalies(generated);
          setError(null);
          setLoading(false);
        });
      }
    );

    return () => unsubscribe();
  }, [statusFilter]);

  const updateAnomalyStatus = useCallback(async (anomaly: Anomaly, status: string, extra?: Record<string, any>) => {
    try {
      await updateDoc(doc(db, ANOMALIES_COLLECTION, anomaly.id), {
        status,
        ...extra,
      });
    } catch {
      setAnomalies((prev) =>
        prev.map((a) =>
          a.id === anomaly.id ? { ...a, status: status as any, ...extra } : a
        )
      );
    }
  }, []);

  const acknowledgeAnomaly = useCallback(async (anomaly: Anomaly) => {
    await updateAnomalyStatus(anomaly, 'acknowledged');
  }, [updateAnomalyStatus]);

  const investigateAnomaly = useCallback(async (anomaly: Anomaly) => {
    await updateAnomalyStatus(anomaly, 'investigating');
  }, [updateAnomalyStatus]);

  const resolveAnomaly = useCallback(async (anomaly: Anomaly, resolution?: string) => {
    await updateAnomalyStatus(anomaly, 'resolved', {
      resolvedAt: Timestamp.now(),
      resolution,
    });
  }, [updateAnomalyStatus]);

  const markFalsePositive = useCallback(async (anomaly: Anomaly) => {
    await updateAnomalyStatus(anomaly, 'false_positive', {
      resolvedAt: Timestamp.now(),
    });
  }, [updateAnomalyStatus]);

  return {
    anomalies,
    loading,
    error,
    acknowledgeAnomaly,
    investigateAnomaly,
    resolveAnomaly,
    markFalsePositive,
  };
};

// ============================================================================
// Generate anomalies from business event patterns
// ============================================================================

async function generateAnomaliesFromEvents(): Promise<Anomaly[]> {
  try {
    const eventsQuery = query(
      collection(db, 'businessEvents'),
      orderBy('createdAt', 'desc'),
      limit(50)
    );

    const tasksQuery = query(
      collection(db, 'generatedTasks'),
      where('status', 'in', ['pending', 'in_progress', 'blocked']),
      limit(50)
    );

    const [eventsSnap, tasksSnap] = await Promise.all([
      new Promise<any>((resolve) => {
        const unsub = onSnapshot(eventsQuery, (snap) => { unsub(); resolve(snap); }, () => { unsub(); resolve({ docs: [] }); });
      }),
      new Promise<any>((resolve) => {
        const unsub = onSnapshot(tasksQuery, (snap) => { unsub(); resolve(snap); }, () => { unsub(); resolve({ docs: [] }); });
      }),
    ]);

    const anomalies: Anomaly[] = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const events = eventsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    const tasks = tasksSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

    // Detect: High severity events spike
    const highSeverityEvents = events.filter((e: any) => e.severity === 'high' || e.severity === 'critical');
    if (highSeverityEvents.length >= 3) {
      anomalies.push({
        id: `anomaly-severity-spike-${Date.now()}`,
        type: 'event_spike',
        severity: 'high',
        title: 'High severity event spike detected',
        description: `${highSeverityEvents.length} high/critical severity events detected recently.`,
        sourceModule: 'design_manager',
        detectedAt: now,
        metric: {
          name: 'High Severity Events',
          expectedValue: 1,
          actualValue: highSeverityEvents.length,
          deviation: ((highSeverityEvents.length - 1) / 1) * 100,
          threshold: 2,
          historicalAverage: 1,
          trend: 'increasing',
        },
        suggestedActions: [
          'Review recent high-priority events',
          'Check for systemic issues',
          'Ensure critical tasks are assigned',
        ],
        status: 'new',
      });
    }

    // Detect: Task completion bottleneck
    const blockedCount = tasks.filter((t: any) => t.status === 'blocked').length;
    if (blockedCount >= 3) {
      anomalies.push({
        id: `anomaly-blocked-spike-${Date.now()}`,
        type: 'task_bottleneck',
        severity: 'medium',
        title: 'Task completion bottleneck detected',
        description: `${blockedCount} tasks are currently blocked, indicating a workflow bottleneck.`,
        sourceModule: 'design_manager',
        detectedAt: now,
        metric: {
          name: 'Blocked Tasks',
          expectedValue: 0,
          actualValue: blockedCount,
          deviation: blockedCount * 100,
          threshold: 2,
          historicalAverage: 1,
          trend: 'increasing',
        },
        suggestedActions: [
          'Review blocked task reasons',
          'Escalate to managers',
          'Identify common blockers',
        ],
        status: 'new',
      });
    }

    // Detect: Overdue task accumulation
    const overdueTasks = tasks.filter((t: any) => {
      if (!t.dueDate) return false;
      const due = t.dueDate.toDate ? t.dueDate.toDate() : new Date(t.dueDate);
      return due < today;
    });

    if (overdueTasks.length >= 5) {
      anomalies.push({
        id: `anomaly-overdue-${Date.now()}`,
        type: 'overdue_accumulation',
        severity: 'high',
        title: 'Overdue task accumulation',
        description: `${overdueTasks.length} tasks are overdue, suggesting capacity issues or priority misalignment.`,
        sourceModule: 'design_manager',
        detectedAt: now,
        metric: {
          name: 'Overdue Tasks',
          expectedValue: 0,
          actualValue: overdueTasks.length,
          deviation: overdueTasks.length * 50,
          threshold: 3,
          historicalAverage: 2,
          trend: 'increasing',
        },
        suggestedActions: [
          'Prioritize overdue tasks',
          'Redistribute workload',
          'Review task due date estimates',
        ],
        status: 'new',
      });
    }

    return anomalies;
  } catch (err) {
    console.error('Error generating anomalies:', err);
    return [];
  }
}

export default useAnomalies;
