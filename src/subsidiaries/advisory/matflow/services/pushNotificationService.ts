/**
 * Push Notification Service
 * Handle push notification subscriptions and delivery notifications
 */

import { db } from '@/core/services/firebase';
import { doc, setDoc, deleteDoc, getDoc, Timestamp } from 'firebase/firestore';

// VAPID public key - generate your own for production
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY || '';

export interface PushSubscriptionData {
  userId: string;
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  createdAt: Date;
  userAgent: string;
  deviceType: 'mobile' | 'tablet' | 'desktop';
}

export interface DeliveryNotification {
  type: 'delivery';
  title: string;
  body: string;
  projectId: string;
  deliveryId: string;
  materialName?: string;
  quantity?: number;
  unit?: string;
  supplierName?: string;
  actions?: NotificationAction[];
}

export interface SyncNotification {
  type: 'sync';
  title: string;
  body: string;
  projectId: string;
  pendingCount?: number;
}

export interface NotificationAction {
  action: string;
  title: string;
  icon?: string;
}

export type NotificationPayload = DeliveryNotification | SyncNotification;

// ============================================================================
// PERMISSION & SUBSCRIPTION
// ============================================================================

/**
 * Check if push notifications are supported
 */
export function isPushSupported(): boolean {
  return (
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  );
}

/**
 * Get current notification permission status
 */
export function getPermissionStatus(): NotificationPermission {
  if (!('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

/**
 * Request notification permission
 */
export async function requestPermission(): Promise<NotificationPermission> {
  if (!isPushSupported()) {
    console.warn('[Push] Push notifications not supported');
    return 'denied';
  }

  const permission = await Notification.requestPermission();
  console.log('[Push] Permission:', permission);
  return permission;
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPush(userId: string): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    console.warn('[Push] Push notifications not supported');
    return null;
  }

  const permission = await requestPermission();
  if (permission !== 'granted') {
    console.warn('[Push] Permission not granted');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    
    // Check for existing subscription
    let subscription = await registration.pushManager.getSubscription();
    
    if (!subscription) {
      // Create new subscription
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      });
      console.log('[Push] New subscription created');
    }

    // Save subscription to Firestore
    await saveSubscription(userId, subscription);
    
    return subscription;
  } catch (error) {
    console.error('[Push] Failed to subscribe:', error);
    return null;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPush(userId: string): Promise<boolean> {
  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      await subscription.unsubscribe();
      await deleteSubscription(userId);
      console.log('[Push] Unsubscribed successfully');
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[Push] Failed to unsubscribe:', error);
    return false;
  }
}

/**
 * Get current push subscription
 */
export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!isPushSupported()) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch (error) {
    console.error('[Push] Failed to get subscription:', error);
    return null;
  }
}

// ============================================================================
// LOCAL NOTIFICATIONS
// ============================================================================

/**
 * Show a local notification (not push)
 */
export async function showLocalNotification(
  title: string,
  options: NotificationOptions = {}
): Promise<void> {
  if (getPermissionStatus() !== 'granted') {
    console.warn('[Push] Cannot show notification - permission not granted');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      icon: '/icons/icon-192x192.png',
      badge: '/icons/badge-72x72.png',
      ...options,
    } as NotificationOptions);
  } catch (error) {
    console.error('[Push] Failed to show notification:', error);
  }
}

/**
 * Show delivery notification
 */
export async function showDeliveryNotification(
  notification: DeliveryNotification
): Promise<void> {
  const body = notification.materialName
    ? `${notification.materialName}: ${notification.quantity} ${notification.unit} from ${notification.supplierName}`
    : notification.body;

  await showLocalNotification(notification.title, {
    body,
    tag: `delivery-${notification.deliveryId}`,
    data: {
      type: 'delivery',
      projectId: notification.projectId,
      deliveryId: notification.deliveryId,
    },
    requireInteraction: true,
  } as NotificationOptions);
}

/**
 * Show sync notification
 */
export async function showSyncNotification(
  notification: SyncNotification
): Promise<void> {
  await showLocalNotification(notification.title, {
    body: notification.body,
    tag: 'sync-notification',
    data: {
      type: 'sync',
      projectId: notification.projectId,
      pendingCount: notification.pendingCount,
    },
    silent: true,
  });
}

// ============================================================================
// FIRESTORE STORAGE
// ============================================================================

/**
 * Save push subscription to Firestore
 */
async function saveSubscription(
  userId: string,
  subscription: PushSubscription
): Promise<void> {
  const subscriptionJson = subscription.toJSON();
  
  const data: Omit<PushSubscriptionData, 'createdAt'> & { createdAt: Timestamp } = {
    userId,
    endpoint: subscriptionJson.endpoint || '',
    keys: {
      p256dh: subscriptionJson.keys?.p256dh || '',
      auth: subscriptionJson.keys?.auth || '',
    },
    createdAt: Timestamp.now(),
    userAgent: navigator.userAgent,
    deviceType: getDeviceType(),
  };

  await setDoc(doc(db, 'push_subscriptions', userId), data);
  console.log('[Push] Subscription saved to Firestore');
}

/**
 * Delete push subscription from Firestore
 */
async function deleteSubscription(userId: string): Promise<void> {
  await deleteDoc(doc(db, 'push_subscriptions', userId));
  console.log('[Push] Subscription deleted from Firestore');
}

/**
 * Get push subscription from Firestore
 */
export async function getSubscription(
  userId: string
): Promise<PushSubscriptionData | null> {
  const docRef = doc(db, 'push_subscriptions', userId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return docSnap.data() as PushSubscriptionData;
  }
  
  return null;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Convert VAPID key to Uint8Array
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  
  return outputArray;
}

/**
 * Detect device type
 */
function getDeviceType(): 'mobile' | 'tablet' | 'desktop' {
  const ua = navigator.userAgent;
  
  if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
    return 'tablet';
  }
  
  if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(ua)) {
    return 'mobile';
  }
  
  return 'desktop';
}

// ============================================================================
// EXPORTS
// ============================================================================

export const pushNotificationService = {
  isPushSupported,
  getPermissionStatus,
  requestPermission,
  subscribeToPush,
  unsubscribeFromPush,
  getCurrentSubscription,
  showLocalNotification,
  showDeliveryNotification,
  showSyncNotification,
  getSubscription,
};

export default pushNotificationService;
