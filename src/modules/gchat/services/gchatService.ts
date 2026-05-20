/**
 * Google Chat Firestore Service
 * Real-time subscriptions and queries for Google Chat data
 * Mirrors the pattern from whatsappService.ts
 */

import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit as firestoreLimit,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { GChatSpace, GChatMessage, SpaceFilter } from '../types';

// Collection references
const spacesRef = collection(db, 'gchatSpaces');

/**
 * Subscribe to spaces list
 */
export function subscribeToSpaces(
  callback: (spaces: GChatSpace[]) => void,
  onError?: (error: Error) => void,
  filter?: SpaceFilter
): () => void {
  let q = query(spacesRef);

  if (filter?.type) {
    q = query(spacesRef, where('type', '==', filter.type));
  } else if (filter?.status) {
    q = query(spacesRef, where('status', '==', filter.status));
  }

  return onSnapshot(
    q,
    (snapshot) => {
      let spaces = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as GChatSpace[];

      // Client-side search filter
      if (filter?.search) {
        const searchLower = filter.search.toLowerCase();
        spaces = spaces.filter(
          (s) =>
            s.displayName.toLowerCase().includes(searchLower) ||
            s.lastMessageText.toLowerCase().includes(searchLower) ||
            s.members.some((m) => m.toLowerCase().includes(searchLower))
        );
      }

      // Sort by last message time (newest first)
      spaces.sort((a, b) => {
        const aTime = a.lastMessageAt?.toMillis?.() || 0;
        const bTime = b.lastMessageAt?.toMillis?.() || 0;
        return bTime - aTime;
      });

      callback(spaces);
    },
    (error) => {
      console.error('GChat spaces subscription error:', error);
      onError?.(error);
    }
  );
}

/**
 * Subscribe to a single space
 */
export function subscribeToSpace(
  spaceId: string,
  callback: (space: GChatSpace | null) => void,
  onError?: (error: Error) => void
): () => void {
  const docRef = doc(db, 'gchatSpaces', spaceId);

  return onSnapshot(
    docRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }
      callback({ id: snapshot.id, ...snapshot.data() } as GChatSpace);
    },
    (error) => {
      console.error('GChat space subscription error:', error);
      onError?.(error);
    }
  );
}

/**
 * Subscribe to messages for a space
 */
export function subscribeToGChatMessages(
  spaceId: string,
  callback: (messages: GChatMessage[]) => void,
  onError?: (error: Error) => void,
  messageLimit = 100
): () => void {
  const messagesRef = collection(db, 'gchatSpaces', spaceId, 'messages');
  const q = query(messagesRef, orderBy('createdAt', 'asc'), firestoreLimit(messageLimit));

  return onSnapshot(
    q,
    (snapshot) => {
      const messages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as GChatMessage[];
      callback(messages);
    },
    (error) => {
      console.error('GChat messages subscription error:', error);
      onError?.(error);
    }
  );
}

/**
 * Mark a space as read (reset unread count)
 */
export async function markSpaceRead(spaceId: string): Promise<void> {
  const docRef = doc(db, 'gchatSpaces', spaceId);
  await updateDoc(docRef, {
    unreadCount: 0,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get total unread count across all active spaces
 */
export function subscribeToGChatUnreadCount(
  callback: (count: number) => void,
  onError?: (error: Error) => void
): () => void {
  const q = query(spacesRef, where('status', '==', 'active'));

  return onSnapshot(
    q,
    (snapshot) => {
      const totalUnread = snapshot.docs.reduce((sum, doc) => {
        return sum + (doc.data().unreadCount || 0);
      }, 0);
      callback(totalUnread);
    },
    (error) => {
      console.error('GChat unread count subscription error:', error);
      onError?.(error);
    }
  );
}
