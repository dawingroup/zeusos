/**
 * @deprecated Use ai_conversations collection via @/shared/services/ai/aiMemory.service instead.
 * This service uses the legacy aiChats collection. New code should use getOrCreateConversation,
 * addConversationMessage, and subscribeToConversation from aiMemory.service.
 * 
 * AI Chat History Service (LEGACY)
 * Persists chat conversations for AI tools (Strategy Research, Design Item Enhancement, etc.)
 * 
 * Data Structure:
 * - aiChats/{chatId} - Chat metadata and messages
 * - Indexed by projectId, designItemId, or userId for quick lookups
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';

// Chat types
export type AIChatType = 'strategy-research' | 'design-item-enhancement' | 'project-scoping' | 'customer-intelligence' | 'image-analysis';

export interface AIChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  sources?: Array<{ url: string; title: string; domain?: string }>;
  metadata?: Record<string, any>;
  timestamp: Date;
}

export interface AIChat {
  id: string;
  type: AIChatType;
  title: string;
  projectId?: string;
  designItemId?: string;
  customerId?: string;
  userId: string;
  messages: AIChatMessage[];
  context?: Record<string, any>; // Store relevant context (project info, design item specs, etc.)
  createdAt: Date;
  updatedAt: Date;
  lastMessageAt: Date;
}

export interface AIChatFormData {
  type: AIChatType;
  title: string;
  projectId?: string;
  designItemId?: string;
  customerId?: string;
  context?: Record<string, any>;
}

const COLLECTION_NAME = 'aiChats';
const chatsRef = collection(db, COLLECTION_NAME);

/**
 * Create a new chat
 */
export async function createChat(
  data: AIChatFormData,
  userId: string
): Promise<string> {
  const now = serverTimestamp();
  
  const docData = {
    ...data,
    userId,
    messages: [],
    createdAt: now,
    updatedAt: now,
    lastMessageAt: now,
  };

  const docRef = await addDoc(chatsRef, docData);
  return docRef.id;
}

/**
 * Get a chat by ID
 */
export async function getChat(chatId: string): Promise<AIChat | null> {
  const docRef = doc(chatsRef, chatId);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) return null;
  
  return docToChat(snapshot.id, snapshot.data());
}

/**
 * Subscribe to a chat (real-time updates)
 */
export function subscribeToChat(
  chatId: string,
  onData: (chat: AIChat | null) => void,
  onError?: (error: Error) => void
): () => void {
  const docRef = doc(chatsRef, chatId);
  
  return onSnapshot(docRef, 
    (snapshot) => {
      if (snapshot.exists()) {
        onData(docToChat(snapshot.id, snapshot.data()));
      } else {
        onData(null);
      }
    },
    (error) => {
      console.error('Error subscribing to chat:', error);
      onError?.(error);
    }
  );
}

/**
 * Get chats for a project
 */
export async function getChatsByProject(
  projectId: string,
  chatType?: AIChatType
): Promise<AIChat[]> {
  let q = query(
    chatsRef,
    where('projectId', '==', projectId),
    orderBy('lastMessageAt', 'desc')
  );
  
  if (chatType) {
    q = query(
      chatsRef,
      where('projectId', '==', projectId),
      where('type', '==', chatType),
      orderBy('lastMessageAt', 'desc')
    );
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => docToChat(doc.id, doc.data()));
}

/**
 * Get chats for a design item
 */
export async function getChatsByDesignItem(
  designItemId: string,
  chatType?: AIChatType
): Promise<AIChat[]> {
  let q = query(
    chatsRef,
    where('designItemId', '==', designItemId),
    orderBy('lastMessageAt', 'desc')
  );
  
  if (chatType) {
    q = query(
      chatsRef,
      where('designItemId', '==', designItemId),
      where('type', '==', chatType),
      orderBy('lastMessageAt', 'desc')
    );
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => docToChat(doc.id, doc.data()));
}

/**
 * Get recent chats for a user
 */
export async function getRecentChats(
  userId: string,
  chatType?: AIChatType,
  maxResults = 10
): Promise<AIChat[]> {
  let q = query(
    chatsRef,
    where('userId', '==', userId),
    orderBy('lastMessageAt', 'desc'),
    limit(maxResults)
  );
  
  if (chatType) {
    q = query(
      chatsRef,
      where('userId', '==', userId),
      where('type', '==', chatType),
      orderBy('lastMessageAt', 'desc'),
      limit(maxResults)
    );
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => docToChat(doc.id, doc.data()));
}

/**
 * Add a message to a chat
 */
export async function addMessage(
  chatId: string,
  message: Omit<AIChatMessage, 'id' | 'timestamp'>
): Promise<AIChatMessage> {
  const docRef = doc(chatsRef, chatId);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) {
    throw new Error('Chat not found');
  }
  
  const chat = snapshot.data();
  const newMessage: AIChatMessage = {
    ...message,
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
  };
  
  const messages = [...(chat.messages || []), {
    ...newMessage,
    timestamp: Timestamp.fromDate(newMessage.timestamp),
  }];
  
  await updateDoc(docRef, {
    messages,
    updatedAt: serverTimestamp(),
    lastMessageAt: serverTimestamp(),
  });
  
  return newMessage;
}

/**
 * Add multiple messages to a chat (for batch updates)
 */
export async function addMessages(
  chatId: string,
  newMessages: Array<Omit<AIChatMessage, 'id' | 'timestamp'>>
): Promise<AIChatMessage[]> {
  const docRef = doc(chatsRef, chatId);
  const snapshot = await getDoc(docRef);
  
  if (!snapshot.exists()) {
    throw new Error('Chat not found');
  }
  
  const chat = snapshot.data();
  const addedMessages: AIChatMessage[] = newMessages.map(msg => ({
    ...msg,
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: new Date(),
  }));
  
  const messages = [
    ...(chat.messages || []),
    ...addedMessages.map(m => ({
      ...m,
      timestamp: Timestamp.fromDate(m.timestamp),
    })),
  ];
  
  await updateDoc(docRef, {
    messages,
    updatedAt: serverTimestamp(),
    lastMessageAt: serverTimestamp(),
  });
  
  return addedMessages;
}

/**
 * Update chat context
 */
export async function updateChatContext(
  chatId: string,
  context: Record<string, any>
): Promise<void> {
  const docRef = doc(chatsRef, chatId);
  await updateDoc(docRef, {
    context,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Update chat title
 */
export async function updateChatTitle(
  chatId: string,
  title: string
): Promise<void> {
  const docRef = doc(chatsRef, chatId);
  await updateDoc(docRef, {
    title,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a chat
 */
export async function deleteChat(chatId: string): Promise<void> {
  const docRef = doc(chatsRef, chatId);
  await deleteDoc(docRef);
}

/**
 * Get or create a chat for a specific context
 * Useful for ensuring one active chat per project/design item
 */
export async function getOrCreateChat(
  data: AIChatFormData,
  userId: string
): Promise<AIChat> {
  // Try to find existing chat
  let q;
  if (data.designItemId) {
    q = query(
      chatsRef,
      where('designItemId', '==', data.designItemId),
      where('type', '==', data.type),
      where('userId', '==', userId),
      orderBy('lastMessageAt', 'desc'),
      limit(1)
    );
  } else if (data.projectId) {
    q = query(
      chatsRef,
      where('projectId', '==', data.projectId),
      where('type', '==', data.type),
      where('userId', '==', userId),
      orderBy('lastMessageAt', 'desc'),
      limit(1)
    );
  } else {
    // User-level chat
    q = query(
      chatsRef,
      where('type', '==', data.type),
      where('userId', '==', userId),
      orderBy('lastMessageAt', 'desc'),
      limit(1)
    );
  }
  
  const snapshot = await getDocs(q);
  
  if (!snapshot.empty) {
    return docToChat(snapshot.docs[0].id, snapshot.docs[0].data());
  }
  
  // Create new chat
  const chatId = await createChat(data, userId);
  const newChat = await getChat(chatId);
  if (!newChat) throw new Error('Failed to create chat');
  return newChat;
}

/**
 * Convert Firestore doc to AIChat
 */
function docToChat(id: string, data: any): AIChat {
  return {
    id,
    type: data.type,
    title: data.title,
    projectId: data.projectId,
    designItemId: data.designItemId,
    customerId: data.customerId,
    userId: data.userId,
    messages: (data.messages || []).map((m: any) => ({
      ...m,
      timestamp: m.timestamp?.toDate?.() || new Date(m.timestamp),
    })),
    context: data.context,
    createdAt: data.createdAt?.toDate?.() || new Date(),
    updatedAt: data.updatedAt?.toDate?.() || new Date(),
    lastMessageAt: data.lastMessageAt?.toDate?.() || new Date(),
  };
}
