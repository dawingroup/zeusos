/**
 * ACTIVITY HOOKS
 *
 * React hooks for recent activity feed across projects.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  collectionGroup,
  query,
  orderBy,
  limit as firestoreLimit,
  getDocs,
  Timestamp,
  Firestore,
} from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface ActivityEntry {
  id: string;
  projectId: string;
  projectName?: string;
  action: string;
  userId: string;
  userName?: string;
  details?: Record<string, unknown>;
  timestamp: Date;
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useRecentActivity
// ─────────────────────────────────────────────────────────────────

interface UseRecentActivityResult {
  activities: ActivityEntry[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useRecentActivity(
  db: Firestore,
  options: { limit?: number } = {}
): UseRecentActivityResult {
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchLimit = options.limit || 10;

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Use collectionGroup to query activityLog across all projects
      const q = query(
        collectionGroup(db, 'activityLog'),
        orderBy('timestamp', 'desc'),
        firestoreLimit(fetchLimit)
      );

      const snapshot = await getDocs(q);
      const entries: ActivityEntry[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          projectId: data.projectId || '',
          projectName: data.projectName,
          action: data.action || '',
          userId: data.userId || '',
          userName: data.userName,
          details: data.details,
          timestamp: data.timestamp instanceof Timestamp
            ? data.timestamp.toDate()
            : new Date(data.timestamp),
        };
      });

      setActivities(entries);
    } catch (err) {
      // collectionGroup may fail if index doesn't exist yet - fail gracefully
      setError(err instanceof Error ? err : new Error('Failed to fetch activity'));
      setActivities([]);
    } finally {
      setLoading(false);
    }
  }, [db, fetchLimit]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  return { activities, loading, error, refresh: fetchActivities };
}
