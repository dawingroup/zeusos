/**
 * Notification Service
 * In-app notification CRUD + subscriptions
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  Timestamp,
  onSnapshot,
  writeBatch,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import type { ModuleId } from '@/integration/constants';

const NOTIFICATIONS_COLLECTION = 'notifications';

export type NotificationPriority = 'critical' | 'high' | 'medium' | 'low';

export interface Notification {
  id: string;
  organizationId: string;
  userId: string;

  type: string;
  title: string;
  message: string;

  module: ModuleId;

  entityType?: string;
  entityId?: string;
  actionUrl?: string;

  priority: NotificationPriority;
  isRead: boolean;
  isArchived: boolean;

  metadata?: Record<string, unknown>;

  createdAt: Timestamp;
  readAt?: Timestamp;
  expiresAt?: Timestamp;
}

export async function createNotification(
  notification: Omit<Notification, 'id' | 'createdAt' | 'isRead' | 'isArchived'>
): Promise<Notification> {
  const docRef = await addDoc(collection(db, NOTIFICATIONS_COLLECTION), {
    ...notification,
    isRead: false,
    isArchived: false,
    createdAt: Timestamp.now(),
  });

  const snapshot = await getDoc(docRef);
  return { id: snapshot.id, ...(snapshot.data() as object) } as Notification;
}

export async function getUserNotifications(
  userId: string,
  options: {
    unreadOnly?: boolean;
    moduleFilter?: ModuleId[];
    limit?: number;
  } = {}
): Promise<Notification[]> {
  const constraints: any[] = [
    where('userId', '==', userId),
    where('isArchived', '==', false),
  ];

  if (options.unreadOnly) {
    constraints.push(where('isRead', '==', false));
  }

  constraints.push(orderBy('createdAt', 'desc'));
  constraints.push(limit(options.limit || 50));

  const q = query(collection(db, NOTIFICATIONS_COLLECTION), ...constraints);
  const snapshot = await getDocs(q);

  let notifications = snapshot.docs.map((d) => ({
    id: d.id,
    ...(d.data() as object),
  })) as Notification[];

  if (options.moduleFilter?.length) {
    notifications = notifications.filter((n) => options.moduleFilter!.includes(n.module));
  }

  return notifications;
}

export async function getUnreadCount(userId: string): Promise<number> {
  const q = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where('userId', '==', userId),
    where('isRead', '==', false),
    where('isArchived', '==', false)
  );

  const snapshot = await getDocs(q);
  return snapshot.size;
}

export async function markAsRead(notificationId: string): Promise<void> {
  await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, notificationId), {
    isRead: true,
    readAt: Timestamp.now(),
  });
}

export async function markAllAsRead(userId: string): Promise<void> {
  const q = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where('userId', '==', userId),
    where('isRead', '==', false)
  );

  const snapshot = await getDocs(q);
  const batch = writeBatch(db);

  snapshot.docs.forEach((d) => {
    batch.update(d.ref, {
      isRead: true,
      readAt: Timestamp.now(),
    });
  });

  await batch.commit();
}

export async function archiveNotification(notificationId: string): Promise<void> {
  await updateDoc(doc(db, NOTIFICATIONS_COLLECTION, notificationId), {
    isArchived: true,
  });
}

export async function deleteNotification(notificationId: string): Promise<void> {
  await deleteDoc(doc(db, NOTIFICATIONS_COLLECTION, notificationId));
}

export async function clearArchivedNotifications(userId: string): Promise<void> {
  const q = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where('userId', '==', userId),
    where('isArchived', '==', true)
  );

  const snapshot = await getDocs(q);
  const batch = writeBatch(db);

  snapshot.docs.forEach((d) => batch.delete(d.ref));

  await batch.commit();
}

export function subscribeToNotifications(
  userId: string,
  callback: (notifications: Notification[]) => void
): Unsubscribe {
  const q = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where('userId', '==', userId),
    where('isArchived', '==', false),
    orderBy('createdAt', 'desc'),
    limit(50)
  );

  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map((d) => ({
      id: d.id,
      ...(d.data() as object),
    })) as Notification[];
    callback(notifications);
  });
}

export function subscribeToUnreadCount(
  userId: string,
  callback: (count: number) => void
): Unsubscribe {
  const q = query(
    collection(db, NOTIFICATIONS_COLLECTION),
    where('userId', '==', userId),
    where('isRead', '==', false),
    where('isArchived', '==', false)
  );

  return onSnapshot(q, (snapshot) => callback(snapshot.size));
}
