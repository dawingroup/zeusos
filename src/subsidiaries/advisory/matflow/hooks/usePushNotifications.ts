/**
 * Push Notifications Hook
 * React hook for managing push notification subscriptions
 */

import { useState, useEffect, useCallback } from 'react';
import {
  isPushSupported,
  getPermissionStatus,
  subscribeToPush,
  unsubscribeFromPush,
  getCurrentSubscription,
  showDeliveryNotification,
  showSyncNotification,
  DeliveryNotification,
  SyncNotification,
} from '../services/pushNotificationService';

interface UsePushNotificationsOptions {
  userId?: string;
  autoSubscribe?: boolean;
}

interface UsePushNotificationsReturn {
  isSupported: boolean;
  permission: NotificationPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  error: Error | null;
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  notifyDelivery: (notification: DeliveryNotification) => Promise<void>;
  notifySync: (notification: SyncNotification) => Promise<void>;
}

export function usePushNotifications(
  options: UsePushNotificationsOptions = {}
): UsePushNotificationsReturn {
  const { userId, autoSubscribe = false } = options;

  const [isSupported] = useState(() => isPushSupported());
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    getPermissionStatus()
  );
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Check current subscription status
  useEffect(() => {
    if (!isSupported) return;

    getCurrentSubscription().then((subscription) => {
      setIsSubscribed(!!subscription);
    });
  }, [isSupported]);

  // Auto-subscribe if enabled
  useEffect(() => {
    if (autoSubscribe && userId && isSupported && !isSubscribed) {
      subscribeToPush(userId).then((subscription) => {
        setIsSubscribed(!!subscription);
        if (subscription) {
          setPermission('granted');
        }
      });
    }
  }, [autoSubscribe, userId, isSupported, isSubscribed]);

  // Listen for permission changes
  useEffect(() => {
    if (!isSupported) return;

    const checkPermission = () => {
      setPermission(getPermissionStatus());
    };

    // Check periodically (no native event for permission changes)
    const interval = setInterval(checkPermission, 5000);
    return () => clearInterval(interval);
  }, [isSupported]);

  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!userId) {
      setError(new Error('User ID required for push subscription'));
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const subscription = await subscribeToPush(userId);
      const success = !!subscription;
      setIsSubscribed(success);
      if (success) {
        setPermission('granted');
      }
      return success;
    } catch (err) {
      setError(err as Error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const unsubscribe = useCallback(async (): Promise<boolean> => {
    if (!userId) {
      setError(new Error('User ID required for push unsubscription'));
      return false;
    }

    setIsLoading(true);
    setError(null);

    try {
      const success = await unsubscribeFromPush(userId);
      if (success) {
        setIsSubscribed(false);
      }
      return success;
    } catch (err) {
      setError(err as Error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  const notifyDelivery = useCallback(
    async (notification: DeliveryNotification): Promise<void> => {
      if (permission !== 'granted') {
        console.warn('[Push] Cannot notify - permission not granted');
        return;
      }
      await showDeliveryNotification(notification);
    },
    [permission]
  );

  const notifySync = useCallback(
    async (notification: SyncNotification): Promise<void> => {
      if (permission !== 'granted') {
        console.warn('[Push] Cannot notify - permission not granted');
        return;
      }
      await showSyncNotification(notification);
    },
    [permission]
  );

  return {
    isSupported,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
    notifyDelivery,
    notifySync,
  };
}

export default usePushNotifications;
