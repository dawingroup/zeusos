// ============================================================================
// USE SMART SUGGESTIONS HOOK
// DawinOS v2.0 - Intelligence Layer
// Manage AI-generated suggestions with Firestore backing + real-time fallback
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
import type { SmartSuggestion } from '../types';

const SUGGESTIONS_COLLECTION = 'intelligenceSuggestions';

interface UseSmartSuggestionsReturn {
  suggestions: SmartSuggestion[];
  loading: boolean;
  error: string | null;
  acceptSuggestion: (suggestion: SmartSuggestion) => Promise<void>;
  dismissSuggestion: (suggestion: SmartSuggestion) => Promise<void>;
}

export const useSmartSuggestions = (
  statusFilter?: 'pending' | 'accepted' | 'dismissed'
): UseSmartSuggestionsReturn => {
  const [suggestions, setSuggestions] = useState<SmartSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const constraints: any[] = [
      orderBy('createdAt', 'desc'),
      limit(50),
    ];

    if (statusFilter) {
      constraints.unshift(where('status', '==', statusFilter));
    }

    const q = query(collection(db, SUGGESTIONS_COLLECTION), ...constraints);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          // Generate suggestions from recent business events
          generateSuggestionsFromEvents().then((generated) => {
            setSuggestions(generated);
            setLoading(false);
          });
          return;
        }

        const data = snapshot.docs.map((d) => {
          const raw = d.data();
          return {
            id: d.id,
            type: raw.type || 'insight',
            title: raw.title || '',
            description: raw.description || '',
            sourceModule: raw.sourceModule || 'design_manager',
            priority: raw.priority || 'medium',
            confidence: raw.confidence || 0.5,
            actionLabel: raw.actionLabel,
            actionUrl: raw.actionUrl,
            metadata: raw.metadata,
            context: raw.context,
            status: raw.status || 'pending',
            createdAt: raw.createdAt?.toDate() || new Date(),
            expiresAt: raw.expiresAt?.toDate(),
            acceptedAt: raw.acceptedAt?.toDate(),
            dismissedAt: raw.dismissedAt?.toDate(),
          } as SmartSuggestion;
        });

        setSuggestions(data);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching suggestions:', err);
        // Fall back to generated suggestions on permission/index errors
        generateSuggestionsFromEvents().then((generated) => {
          setSuggestions(generated);
          setError(null);
          setLoading(false);
        });
      }
    );

    return () => unsubscribe();
  }, [statusFilter]);

  const acceptSuggestion = useCallback(async (suggestion: SmartSuggestion) => {
    try {
      await updateDoc(doc(db, SUGGESTIONS_COLLECTION, suggestion.id), {
        status: 'accepted',
        acceptedAt: Timestamp.now(),
      });
    } catch {
      // Optimistic local update if Firestore write fails
      setSuggestions((prev) =>
        prev.map((s) =>
          s.id === suggestion.id
            ? { ...s, status: 'accepted' as const, acceptedAt: new Date() }
            : s
        )
      );
    }
  }, []);

  const dismissSuggestion = useCallback(async (suggestion: SmartSuggestion) => {
    try {
      await updateDoc(doc(db, SUGGESTIONS_COLLECTION, suggestion.id), {
        status: 'dismissed',
        dismissedAt: Timestamp.now(),
      });
    } catch {
      setSuggestions((prev) =>
        prev.map((s) =>
          s.id === suggestion.id
            ? { ...s, status: 'dismissed' as const, dismissedAt: new Date() }
            : s
        )
      );
    }
  }, []);

  return { suggestions, loading, error, acceptSuggestion, dismissSuggestion };
};

// ============================================================================
// Generate suggestions from recent business events and task patterns
// ============================================================================

async function generateSuggestionsFromEvents(): Promise<SmartSuggestion[]> {
  try {
    const eventsQuery = query(
      collection(db, 'businessEvents'),
      where('status', '==', 'processed'),
      orderBy('createdAt', 'desc'),
      limit(20)
    );

    const tasksQuery = query(
      collection(db, 'generatedTasks'),
      where('status', 'in', ['pending', 'in_progress', 'blocked']),
      orderBy('dueDate', 'asc'),
      limit(30)
    );

    const [eventsSnap, tasksSnap] = await Promise.all([
      new Promise<any>((resolve) => {
        const unsub = onSnapshot(eventsQuery, (snap) => { unsub(); resolve(snap); }, () => { unsub(); resolve({ docs: [] }); });
      }),
      new Promise<any>((resolve) => {
        const unsub = onSnapshot(tasksQuery, (snap) => { unsub(); resolve(snap); }, () => { unsub(); resolve({ docs: [] }); });
      }),
    ]);

    const suggestions: SmartSuggestion[] = [];
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    // Analyze tasks for suggestions
    const tasks = tasksSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));

    // Overdue tasks suggestion
    const overdueTasks = tasks.filter((t: any) => {
      if (!t.dueDate) return false;
      const due = t.dueDate.toDate ? t.dueDate.toDate() : new Date(t.dueDate);
      return due < today && t.status !== 'completed' && t.status !== 'cancelled';
    });

    if (overdueTasks.length > 0) {
      suggestions.push({
        id: `gen-overdue-${Date.now()}`,
        type: 'alert',
        title: `${overdueTasks.length} overdue task${overdueTasks.length > 1 ? 's' : ''} need attention`,
        description: `You have ${overdueTasks.length} task${overdueTasks.length > 1 ? 's' : ''} past their due date. Prioritize or reschedule to stay on track.`,
        sourceModule: 'design_manager',
        priority: 'high',
        confidence: 0.95,
        actionLabel: 'View Tasks',
        actionUrl: '/my-tasks',
        status: 'pending',
        createdAt: now,
      });
    }

    // Blocked tasks suggestion
    const blockedTasks = tasks.filter((t: any) => t.status === 'blocked');
    if (blockedTasks.length > 0) {
      suggestions.push({
        id: `gen-blocked-${Date.now()}`,
        type: 'task',
        title: `${blockedTasks.length} blocked task${blockedTasks.length > 1 ? 's' : ''} require resolution`,
        description: `Blocked tasks are preventing workflow progress. Review blockers and take action to unblock.`,
        sourceModule: 'design_manager',
        priority: 'medium',
        confidence: 0.90,
        actionLabel: 'View Blocked',
        actionUrl: '/my-tasks',
        status: 'pending',
        createdAt: now,
      });
    }

    // High-volume events suggestion
    const events = eventsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() }));
    const moduleEventCounts: Record<string, number> = {};
    events.forEach((e: any) => {
      moduleEventCounts[e.sourceModule] = (moduleEventCounts[e.sourceModule] || 0) + 1;
    });

    Object.entries(moduleEventCounts).forEach(([mod, count]) => {
      if (count >= 5) {
        suggestions.push({
          id: `gen-activity-${mod}-${Date.now()}`,
          type: 'insight',
          title: `High activity detected in ${mod.replace('_', ' ')}`,
          description: `${count} events detected recently. Consider reviewing the module for any items requiring attention.`,
          sourceModule: mod as any,
          priority: 'low',
          confidence: 0.75,
          status: 'pending',
          createdAt: now,
        });
      }
    });

    // Low checklist progress suggestion
    const staleInProgress = tasks.filter((t: any) => {
      if (t.status !== 'in_progress') return false;
      return (t.checklistProgress || 0) < 25;
    });

    if (staleInProgress.length > 0) {
      suggestions.push({
        id: `gen-stale-${Date.now()}`,
        type: 'optimization',
        title: 'Tasks with low checklist progress',
        description: `${staleInProgress.length} in-progress task${staleInProgress.length > 1 ? 's have' : ' has'} less than 25% checklist completion. Consider focusing effort or reassigning.`,
        sourceModule: 'design_manager',
        priority: 'medium',
        confidence: 0.80,
        actionLabel: 'View Tasks',
        actionUrl: '/my-tasks',
        status: 'pending',
        createdAt: now,
      });
    }

    return suggestions;
  } catch (err) {
    console.error('Error generating suggestions:', err);
    return [];
  }
}

export default useSmartSuggestions;
