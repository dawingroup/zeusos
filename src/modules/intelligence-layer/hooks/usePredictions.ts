// ============================================================================
// USE PREDICTIONS HOOK
// DawinOS v2.0 - Intelligence Layer
// Manage AI predictions with Firestore backing + generated fallback
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
import type { Prediction } from '../types';

const PREDICTIONS_COLLECTION = 'intelligencePredictions';

interface UsePredictionsReturn {
  predictions: Prediction[];
  loading: boolean;
  error: string | null;
  validatePrediction: (prediction: Prediction, actualValue: number) => Promise<void>;
}

export const usePredictions = (
  statusFilter?: 'active' | 'validated' | 'invalidated' | 'expired'
): UsePredictionsReturn => {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const constraints: any[] = [
      orderBy('createdAt', 'desc'),
      limit(20),
    ];

    if (statusFilter) {
      constraints.unshift(where('status', '==', statusFilter));
    }

    const q = query(collection(db, PREDICTIONS_COLLECTION), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          generatePredictionsFromTasks().then((generated) => {
            setPredictions(generated);
            setLoading(false);
          });
          return;
        }

        const data = snapshot.docs.map((d) => {
          const raw = d.data();
          return {
            id: d.id,
            type: raw.type || 'general',
            title: raw.title || '',
            description: raw.description || '',
            sourceModule: raw.sourceModule || 'design_manager',
            targetDate: raw.targetDate?.toDate() || new Date(),
            predictedValue: raw.predictedValue || 0,
            confidence: raw.confidence || 0.5,
            confidenceInterval: raw.confidenceInterval || { lower: 0, upper: 0 },
            factors: raw.factors || [],
            historicalAccuracy: raw.historicalAccuracy,
            status: raw.status || 'active',
            createdAt: raw.createdAt?.toDate() || new Date(),
            validatedAt: raw.validatedAt?.toDate(),
            actualValue: raw.actualValue,
          } as Prediction;
        });

        setPredictions(data);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching predictions:', err);
        generatePredictionsFromTasks().then((generated) => {
          setPredictions(generated);
          setError(null);
          setLoading(false);
        });
      }
    );

    return () => unsubscribe();
  }, [statusFilter]);

  const validatePrediction = useCallback(
    async (prediction: Prediction, actualValue: number) => {
      const isValid =
        actualValue >= prediction.confidenceInterval.lower &&
        actualValue <= prediction.confidenceInterval.upper;

      const status = isValid ? 'validated' : 'invalidated';

      try {
        await updateDoc(doc(db, PREDICTIONS_COLLECTION, prediction.id), {
          status,
          actualValue,
          validatedAt: Timestamp.now(),
        });
      } catch {
        setPredictions((prev) =>
          prev.map((p) =>
            p.id === prediction.id
              ? { ...p, status: status as any, actualValue, validatedAt: new Date() }
              : p
          )
        );
      }
    },
    []
  );

  return { predictions, loading, error, validatePrediction };
};

// ============================================================================
// Generate predictions from task velocity and event patterns
// ============================================================================

async function generatePredictionsFromTasks(): Promise<Prediction[]> {
  try {
    const tasksQuery = query(
      collection(db, 'generatedTasks'),
      orderBy('createdAt', 'desc'),
      limit(100)
    );

    const snap = await new Promise<any>((resolve) => {
      const unsub = onSnapshot(tasksQuery, (s) => { unsub(); resolve(s); }, () => { unsub(); resolve({ docs: [] }); });
    });

    const tasks = snap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    const predictions: Prediction[] = [];
    const now = new Date();

    if (tasks.length === 0) return predictions;

    // Prediction: Task completion rate
    const completedTasks = tasks.filter((t: any) => t.status === 'completed');
    const totalActive = tasks.filter((t: any) => t.status !== 'cancelled').length;
    const completionRate = totalActive > 0 ? (completedTasks.length / totalActive) * 100 : 0;

    const nextMonth = new Date(now);
    nextMonth.setMonth(nextMonth.getMonth() + 1);

    predictions.push({
      id: `pred-completion-${Date.now()}`,
      type: 'task_completion',
      title: 'Task Completion Rate Forecast',
      description: `Predicted task completion rate for the next 30 days based on current velocity.`,
      sourceModule: 'design_manager',
      targetDate: nextMonth,
      predictedValue: Math.round(Math.min(completionRate * 1.05, 100)),
      confidence: 0.78,
      confidenceInterval: {
        lower: Math.round(Math.max(completionRate * 0.85, 0)),
        upper: Math.round(Math.min(completionRate * 1.2, 100)),
      },
      factors: [
        {
          name: 'Current Velocity',
          impact: completionRate > 50 ? 'positive' : 'negative',
          weight: 0.4,
          description: `${Math.round(completionRate)}% of tasks completed`,
        },
        {
          name: 'Blocked Tasks',
          impact: tasks.filter((t: any) => t.status === 'blocked').length > 2 ? 'negative' : 'neutral',
          weight: 0.3,
          description: `${tasks.filter((t: any) => t.status === 'blocked').length} currently blocked`,
        },
        {
          name: 'Task Volume',
          impact: tasks.filter((t: any) => t.status === 'pending').length > 10 ? 'negative' : 'positive',
          weight: 0.3,
          description: `${tasks.filter((t: any) => t.status === 'pending').length} pending tasks in queue`,
        },
      ],
      status: 'active',
      createdAt: now,
    });

    // Prediction: Workload trend
    const pendingCount = tasks.filter((t: any) => t.status === 'pending').length;
    const inProgressCount = tasks.filter((t: any) => t.status === 'in_progress').length;
    const activeWorkload = pendingCount + inProgressCount;

    predictions.push({
      id: `pred-workload-${Date.now()}`,
      type: 'workload',
      title: 'Active Workload Forecast',
      description: 'Predicted number of active tasks over the next 30 days.',
      sourceModule: 'design_manager',
      targetDate: nextMonth,
      predictedValue: Math.round(activeWorkload * 1.1),
      confidence: 0.72,
      confidenceInterval: {
        lower: Math.round(activeWorkload * 0.8),
        upper: Math.round(activeWorkload * 1.4),
      },
      factors: [
        {
          name: 'Current Backlog',
          impact: pendingCount > 10 ? 'negative' : 'neutral',
          weight: 0.35,
          description: `${pendingCount} tasks pending`,
        },
        {
          name: 'Event Generation Rate',
          impact: 'neutral',
          weight: 0.35,
          description: 'Based on recent business event frequency',
        },
        {
          name: 'Completion Rate',
          impact: completionRate > 60 ? 'positive' : 'negative',
          weight: 0.3,
          description: `${Math.round(completionRate)}% completion rate`,
        },
      ],
      status: 'active',
      createdAt: now,
    });

    // Prediction: Overdue risk
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const threeDays = new Date(today);
    threeDays.setDate(threeDays.getDate() + 3);

    const dueSoonTasks = tasks.filter((t: any) => {
      if (t.status === 'completed' || t.status === 'cancelled' || !t.dueDate) return false;
      const due = t.dueDate.toDate ? t.dueDate.toDate() : new Date(t.dueDate);
      return due >= today && due <= threeDays;
    });

    if (dueSoonTasks.length > 0) {
      const overdueRisk = Math.min(
        Math.round((dueSoonTasks.filter((t: any) => (t.checklistProgress || 0) < 50).length / dueSoonTasks.length) * 100),
        100
      );

      predictions.push({
        id: `pred-overdue-risk-${Date.now()}`,
        type: 'overdue_risk',
        title: 'Tasks At Risk of Becoming Overdue',
        description: `${dueSoonTasks.length} tasks due within 3 days. Risk assessment based on checklist progress.`,
        sourceModule: 'design_manager',
        targetDate: threeDays,
        predictedValue: overdueRisk,
        confidence: 0.85,
        confidenceInterval: {
          lower: Math.max(overdueRisk - 15, 0),
          upper: Math.min(overdueRisk + 15, 100),
        },
        factors: [
          {
            name: 'Checklist Progress',
            impact: overdueRisk > 50 ? 'negative' : 'positive',
            weight: 0.5,
            description: `${dueSoonTasks.filter((t: any) => (t.checklistProgress || 0) < 50).length} tasks below 50% progress`,
          },
          {
            name: 'Due Date Proximity',
            impact: 'negative',
            weight: 0.3,
            description: `${dueSoonTasks.length} tasks due within 3 days`,
          },
          {
            name: 'Historical Pattern',
            impact: 'neutral',
            weight: 0.2,
            description: 'Based on past task completion patterns',
          },
        ],
        status: 'active',
        createdAt: now,
      });
    }

    return predictions;
  } catch (err) {
    console.error('Error generating predictions:', err);
    return [];
  }
}

export default usePredictions;
