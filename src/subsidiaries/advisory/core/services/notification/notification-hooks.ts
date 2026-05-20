/**
 * NOTIFICATION HOOKS
 * 
 * React hooks for consuming notification service functionality.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { notificationService } from './notification-service';
import {
  Notification,
  NotificationPreferences,
  NotificationCategory,
  SendNotificationRequest,
  SendNotificationResult,
} from './notification-types';

// ============================================================================
// Notifications Hook
// ============================================================================

interface UseNotificationsResult {
  notifications: Notification[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to fetch and subscribe to user's notifications
 */
export function useNotifications(
  userId: string | undefined,
  options?: {
    unreadOnly?: boolean;
    category?: string;
    limit?: number;
    realtime?: boolean;
  }
): UseNotificationsResult {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { realtime = true, ...queryOptions } = options || {};
  const optionsKey = JSON.stringify(queryOptions);

  const fetchNotifications = useCallback(async () => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await notificationService.getNotifications(userId, queryOptions);
      setNotifications(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch notifications'));
    } finally {
      setLoading(false);
    }
  }, [userId, optionsKey]);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    if (realtime) {
      setLoading(true);
      const unsubscribe = notificationService.subscribeToNotifications(
        userId,
        (data) => {
          // Apply client-side filtering for unreadOnly and category
          let filtered = data;
          if (queryOptions.unreadOnly) {
            filtered = filtered.filter(n => !n.readAt);
          }
          if (queryOptions.category) {
            filtered = filtered.filter(n => n.category === queryOptions.category);
          }
          setNotifications(filtered);
          setLoading(false);
        },
        { limit: queryOptions.limit }
      );
      return () => unsubscribe();
    } else {
      fetchNotifications();
    }
  }, [userId, realtime, optionsKey, fetchNotifications]);

  return {
    notifications,
    loading,
    error,
    refresh: fetchNotifications,
  };
}

// ============================================================================
// Unread Count Hook
// ============================================================================

interface UseUnreadCountResult {
  count: number;
  loading: boolean;
}

/**
 * Hook to get real-time unread notification count
 */
export function useUnreadCount(userId: string | undefined): UseUnreadCountResult {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setCount(0);
      setLoading(false);
      return;
    }

    const unsubscribe = notificationService.subscribeToUnreadCount(
      userId,
      (newCount) => {
        setCount(newCount);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [userId]);

  return { count, loading };
}

// ============================================================================
// Notification Actions Hook
// ============================================================================

interface UseNotificationActionsResult {
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook for notification actions (mark as read)
 */
export function useNotificationActions(
  userId: string | undefined
): UseNotificationActionsResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const markAsRead = useCallback(async (notificationId: string) => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      await notificationService.markAsRead(userId, notificationId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to mark as read');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const markAllAsRead = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      await notificationService.markAllAsRead(userId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to mark all as read');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return {
    markAsRead,
    markAllAsRead,
    loading,
    error,
  };
}

// ============================================================================
// Notification Preferences Hook
// ============================================================================

interface UseNotificationPreferencesResult {
  preferences: NotificationPreferences | null;
  loading: boolean;
  error: Error | null;
  updatePreferences: (updates: Partial<NotificationPreferences>) => Promise<void>;
  refresh: () => Promise<void>;
}

/**
 * Hook for managing notification preferences
 */
export function useNotificationPreferences(
  userId: string | undefined
): UseNotificationPreferencesResult {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchPreferences = useCallback(async () => {
    if (!userId) {
      setPreferences(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await notificationService.getPreferences(userId);
      setPreferences(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch preferences'));
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchPreferences();
  }, [fetchPreferences]);

  const updatePreferences = useCallback(async (updates: Partial<NotificationPreferences>) => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      await notificationService.updatePreferences(userId, updates);
      setPreferences(prev => prev ? { ...prev, ...updates } : null);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update preferences');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [userId]);

  return {
    preferences,
    loading,
    error,
    updatePreferences,
    refresh: fetchPreferences,
  };
}

// ============================================================================
// Send Notification Hook
// ============================================================================

interface UseSendNotificationResult {
  send: (request: SendNotificationRequest) => Promise<SendNotificationResult>;
  loading: boolean;
  error: Error | null;
  lastResult: SendNotificationResult | null;
}

/**
 * Hook for sending notifications
 */
export function useSendNotification(): UseSendNotificationResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastResult, setLastResult] = useState<SendNotificationResult | null>(null);

  const send = useCallback(async (request: SendNotificationRequest) => {
    setLoading(true);
    setError(null);

    try {
      const result = await notificationService.send(request);
      setLastResult(result);
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to send notification');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    send,
    loading,
    error,
    lastResult,
  };
}

// ============================================================================
// Notification Summary Hook
// ============================================================================

interface NotificationSummary {
  total: number;
  unread: number;
  byCategory: Record<NotificationCategory, number>;
}

interface UseNotificationSummaryResult {
  summary: NotificationSummary;
  loading: boolean;
}

/**
 * Hook to get notification summary
 */
export function useNotificationSummary(
  notifications: Notification[]
): UseNotificationSummaryResult {
  const summary = useMemo(() => {
    const byCategory: Record<NotificationCategory, number> = {
      approval: 0,
      payment: 0,
      covenant: 0,
      report: 0,
      milestone: 0,
      alert: 0,
      system: 0,
      reminder: 0,
    };

    for (const notification of notifications) {
      if (byCategory[notification.category] !== undefined) {
        byCategory[notification.category]++;
      }
    }

    return {
      total: notifications.length,
      unread: notifications.filter(n => !n.readAt).length,
      byCategory,
    };
  }, [notifications]);

  return {
    summary,
    loading: false,
  };
}

// ============================================================================
// Grouped Notifications Hook
// ============================================================================

interface NotificationGroup {
  date: string;
  notifications: Notification[];
}

interface UseGroupedNotificationsResult {
  groups: NotificationGroup[];
  loading: boolean;
}

/**
 * Hook to group notifications by date
 */
export function useGroupedNotifications(
  notifications: Notification[]
): UseGroupedNotificationsResult {
  const groups = useMemo(() => {
    const groupMap = new Map<string, Notification[]>();

    for (const notification of notifications) {
      const date = notification.createdAt.toDate().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const existing = groupMap.get(date) || [];
      existing.push(notification);
      groupMap.set(date, existing);
    }

    return Array.from(groupMap.entries()).map(([date, notifications]) => ({
      date,
      notifications,
    }));
  }, [notifications]);

  return {
    groups,
    loading: false,
  };
}
