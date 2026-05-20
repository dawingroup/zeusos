/**
 * WhatsApp Firestore Service
 * Real-time subscriptions and queries for WhatsApp data
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
import type {
  WhatsAppConversation,
  WhatsAppMessage,
  WhatsAppTemplate,
  WhatsAppConfig,
  WhatsAppBroadcast,
  ConversationFilter,
} from '../types';

// Collection references
const conversationsRef = collection(db, 'whatsappConversations');
const templatesRef = collection(db, 'whatsappTemplates');
const broadcastsRef = collection(db, 'whatsappBroadcasts');
const configRef = doc(db, 'systemConfig', 'whatsappConfig');

/**
 * Subscribe to conversations list
 */
export function subscribeToConversations(
  callback: (conversations: WhatsAppConversation[]) => void,
  onError?: (error: Error) => void,
  filter?: ConversationFilter
): () => void {
  // Base query - get all active conversations
  let q = query(conversationsRef);

  if (filter?.customerId) {
    q = query(conversationsRef, where('customerId', '==', filter.customerId));
  } else if (filter?.assignedTo) {
    q = query(conversationsRef, where('assignedTo', '==', filter.assignedTo));
  } else if (filter?.status) {
    q = query(conversationsRef, where('status', '==', filter.status));
  }

  return onSnapshot(
    q,
    (snapshot) => {
      let conversations = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as WhatsAppConversation[];

      // Client-side search filter
      if (filter?.search) {
        const searchLower = filter.search.toLowerCase();
        conversations = conversations.filter(
          (c) =>
            c.customerName.toLowerCase().includes(searchLower) ||
            c.phoneNumber.includes(filter.search!) ||
            c.lastMessageText.toLowerCase().includes(searchLower)
        );
      }

      // Sort by last message time (newest first)
      conversations.sort((a, b) => {
        const aTime = a.lastMessageAt?.toMillis?.() || 0;
        const bTime = b.lastMessageAt?.toMillis?.() || 0;
        return bTime - aTime;
      });

      callback(conversations);
    },
    (error) => {
      console.error('WhatsApp conversations subscription error:', error);
      onError?.(error);
    }
  );
}

/**
 * Subscribe to a single conversation
 */
export function subscribeToConversation(
  conversationId: string,
  callback: (conversation: WhatsAppConversation | null) => void,
  onError?: (error: Error) => void
): () => void {
  const docRef = doc(db, 'whatsappConversations', conversationId);

  return onSnapshot(
    docRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }
      callback({ id: snapshot.id, ...snapshot.data() } as WhatsAppConversation);
    },
    (error) => {
      console.error('WhatsApp conversation subscription error:', error);
      onError?.(error);
    }
  );
}

/**
 * Subscribe to messages for a conversation
 */
export function subscribeToMessages(
  conversationId: string,
  callback: (messages: WhatsAppMessage[]) => void,
  onError?: (error: Error) => void,
  messageLimit = 100
): () => void {
  const messagesRef = collection(db, 'whatsappConversations', conversationId, 'messages');
  const q = query(messagesRef, orderBy('createdAt', 'asc'), firestoreLimit(messageLimit));

  return onSnapshot(
    q,
    (snapshot) => {
      const messages = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as WhatsAppMessage[];
      callback(messages);
    },
    (error) => {
      console.error('WhatsApp messages subscription error:', error);
      onError?.(error);
    }
  );
}

/**
 * Subscribe to approved WhatsApp templates
 */
export function subscribeToTemplates(
  callback: (templates: WhatsAppTemplate[]) => void,
  onError?: (error: Error) => void
): () => void {
  const q = query(templatesRef, where('status', '==', 'approved'));

  return onSnapshot(
    q,
    (snapshot) => {
      const templates = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as WhatsAppTemplate[];
      templates.sort((a, b) => a.name.localeCompare(b.name));
      callback(templates);
    },
    (error) => {
      console.error('WhatsApp templates subscription error:', error);
      onError?.(error);
    }
  );
}

/**
 * Subscribe to all WhatsApp templates (all statuses)
 */
export function subscribeToAllTemplates(
  callback: (templates: WhatsAppTemplate[]) => void,
  onError?: (error: Error) => void
): () => void {
  return onSnapshot(
    templatesRef,
    (snapshot) => {
      const templates = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as WhatsAppTemplate[];
      templates.sort((a, b) => a.name.localeCompare(b.name));
      callback(templates);
    },
    (error) => {
      console.error('WhatsApp all templates subscription error:', error);
      onError?.(error);
    }
  );
}

/**
 * Subscribe to WhatsApp module config
 */
export function subscribeToConfig(
  callback: (config: WhatsAppConfig | null) => void,
  onError?: (error: Error) => void
): () => void {
  return onSnapshot(
    configRef,
    (snapshot) => {
      if (!snapshot.exists()) {
        callback(null);
        return;
      }
      callback(snapshot.data() as WhatsAppConfig);
    },
    (error) => {
      console.error('WhatsApp config subscription error:', error);
      onError?.(error);
    }
  );
}

/**
 * Mark a conversation as read (reset unread count)
 */
export async function markConversationRead(conversationId: string): Promise<void> {
  const docRef = doc(db, 'whatsappConversations', conversationId);
  await updateDoc(docRef, {
    unreadCount: 0,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get total unread count across all conversations
 */
export function subscribeToUnreadCount(
  callback: (count: number) => void,
  onError?: (error: Error) => void
): () => void {
  const q = query(conversationsRef, where('status', '==', 'active'));

  return onSnapshot(
    q,
    (snapshot) => {
      const totalUnread = snapshot.docs.reduce((sum, doc) => {
        return sum + (doc.data().unreadCount || 0);
      }, 0);
      callback(totalUnread);
    },
    (error) => {
      console.error('WhatsApp unread count subscription error:', error);
      onError?.(error);
    }
  );
}

/**
 * Subscribe to WhatsApp broadcast campaigns
 */
export function subscribeToBroadcasts(
  callback: (broadcasts: WhatsAppBroadcast[]) => void,
  onError?: (error: Error) => void
): () => void {
  const q = query(broadcastsRef, orderBy('createdAt', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const broadcasts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as WhatsAppBroadcast[];
      callback(broadcasts);
    },
    (error) => {
      console.error('WhatsApp broadcasts subscription error:', error);
      onError?.(error);
    }
  );
}
