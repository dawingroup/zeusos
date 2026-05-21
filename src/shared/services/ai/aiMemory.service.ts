/**
 * AI Memory Service
 * ZeusOS v2.0 - Persistent AI Memory Layer
 * 
 * Handles CRUD operations for:
 * - Business memories (ai_memory collection)
 * - Conversation persistence (ai_conversations collection)
 * - Context injection (aggregating relevant memories for AI prompts)
 */

import {
  collection,
  doc,
  addDoc,
  setDoc,
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
  increment,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  AIMemoryEntry,
  AIMemoryFormData,
  AIConversation,
  AIConversationFormData,
  ConversationMessage,
  ConversationModule,
  MemoryCategory,
  MemorySearchParams,
  MemoryContext,
  ContextInjectionRequest,
} from './aiMemory.types';

// ============================================================================
// Collection References
// ============================================================================

const MEMORY_COLLECTION = 'ai_memory';
const CONVERSATION_COLLECTION = 'ai_conversations';

const memoryRef = collection(db, MEMORY_COLLECTION);
const conversationRef = collection(db, CONVERSATION_COLLECTION);

// ============================================================================
// Business Memory CRUD
// ============================================================================

/**
 * Create a new business memory entry
 */
export async function createMemory(
  data: AIMemoryFormData,
  companyId: string,
  userId: string
): Promise<string> {
  const now = serverTimestamp();

  const docData = {
    ...data,
    companyId,
    createdBy: userId,
    createdAt: now,
    updatedAt: now,
    accessCount: 0,
    lastAccessedAt: now,
    isArchived: false,
  };

  const docRef = await addDoc(memoryRef, docData);
  return docRef.id;
}

/**
 * Create multiple memories in a batch
 */
export async function createMemories(
  memories: AIMemoryFormData[],
  companyId: string,
  userId: string
): Promise<string[]> {
  const batch = writeBatch(db);
  const now = Timestamp.now();
  const ids: string[] = [];

  for (const memory of memories) {
    const docRef = doc(memoryRef);
    ids.push(docRef.id);
    batch.set(docRef, {
      ...memory,
      companyId,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      accessCount: 0,
      lastAccessedAt: now,
      isArchived: false,
    });
  }

  await batch.commit();
  return ids;
}

/**
 * Get a memory by ID
 */
export async function getMemory(memoryId: string): Promise<AIMemoryEntry | null> {
  const docRef = doc(memoryRef, memoryId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) return null;
  return docToMemory(snapshot.id, snapshot.data());
}

/**
 * Search memories with filters
 */
export async function searchMemories(
  params: MemorySearchParams
): Promise<AIMemoryEntry[]> {
  let q = query(
    memoryRef,
    where('companyId', '==', params.companyId),
    where('isArchived', '==', params.includeArchived || false),
    orderBy('importance'),
    orderBy('lastAccessedAt', 'desc'),
    limit(params.limit || 50)
  );

  if (params.categories && params.categories.length > 0) {
    q = query(
      memoryRef,
      where('companyId', '==', params.companyId),
      where('category', 'in', params.categories),
      where('isArchived', '==', params.includeArchived || false),
      orderBy('lastAccessedAt', 'desc'),
      limit(params.limit || 50)
    );
  }

  if (params.relatedEntityId) {
    q = query(
      memoryRef,
      where('companyId', '==', params.companyId),
      where('relatedEntityIds', 'array-contains', params.relatedEntityId),
      where('isArchived', '==', params.includeArchived || false),
      orderBy('lastAccessedAt', 'desc'),
      limit(params.limit || 50)
    );
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => docToMemory(d.id, d.data()));
}

/**
 * Get recent memories for context injection
 */
export async function getRecentMemories(
  companyId: string,
  maxResults = 20
): Promise<AIMemoryEntry[]> {
  const q = query(
    memoryRef,
    where('companyId', '==', companyId),
    where('isArchived', '==', false),
    orderBy('lastAccessedAt', 'desc'),
    limit(maxResults)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => docToMemory(d.id, d.data()));
}

/**
 * Get memories by category
 */
export async function getMemoriesByCategory(
  companyId: string,
  category: MemoryCategory,
  maxResults = 20
): Promise<AIMemoryEntry[]> {
  const q = query(
    memoryRef,
    where('companyId', '==', companyId),
    where('category', '==', category),
    where('isArchived', '==', false),
    orderBy('updatedAt', 'desc'),
    limit(maxResults)
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => docToMemory(d.id, d.data()));
}

/**
 * Update a memory entry
 */
export async function updateMemory(
  memoryId: string,
  updates: Partial<AIMemoryFormData>
): Promise<void> {
  const docRef = doc(memoryRef, memoryId);
  await updateDoc(docRef, {
    ...updates,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Record memory access (updates accessCount and lastAccessedAt)
 */
export async function recordMemoryAccess(memoryIds: string[]): Promise<void> {
  const batch = writeBatch(db);

  for (const id of memoryIds) {
    const docRef = doc(memoryRef, id);
    batch.update(docRef, {
      accessCount: increment(1),
      lastAccessedAt: serverTimestamp(),
    });
  }

  await batch.commit();
}

/**
 * Archive a memory
 */
export async function archiveMemory(memoryId: string): Promise<void> {
  const docRef = doc(memoryRef, memoryId);
  await updateDoc(docRef, {
    isArchived: true,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Delete a memory permanently
 */
export async function deleteMemory(memoryId: string): Promise<void> {
  const docRef = doc(memoryRef, memoryId);
  await deleteDoc(docRef);
}

/**
 * Subscribe to memory updates for a company
 */
export function subscribeToMemories(
  companyId: string,
  onData: (memories: AIMemoryEntry[]) => void,
  onError?: (error: Error) => void
): () => void {
  const q = query(
    memoryRef,
    where('companyId', '==', companyId),
    where('isArchived', '==', false),
    orderBy('updatedAt', 'desc'),
    limit(100)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const memories = snapshot.docs.map(d => docToMemory(d.id, d.data()));
      onData(memories);
    },
    (error) => {
      console.error('Error subscribing to memories:', error);
      onError?.(error);
    }
  );
}

// ============================================================================
// Conversation Persistence
// ============================================================================

/**
 * Create a new conversation
 * Messages are stored in a subcollection, not inline on the document.
 */
export async function createConversation(
  data: AIConversationFormData,
  companyId: string,
  userId: string
): Promise<string> {
  const now = serverTimestamp();

  // Strip undefined values — Firestore rejects them
  const cleanData: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) {
      cleanData[key] = value;
    }
  }

  const docData = {
    ...cleanData,
    companyId,
    userId,
    memoryExtractionDone: false,
    messageCount: 0,
    isArchived: false,
    createdAt: now,
    updatedAt: now,
    lastMessageAt: now,
  };

  const docRef = await addDoc(conversationRef, docData);
  return docRef.id;
}

/**
 * Get a conversation by ID.
 * Loads messages from the subcollection; falls back to inline messages for legacy docs.
 */
export async function getConversation(
  conversationId: string
): Promise<AIConversation | null> {
  const docRef = doc(conversationRef, conversationId);
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) return null;

  const conv = docToConversation(snapshot.id, snapshot.data());

  // Load messages from subcollection
  const msgsSnap = await getDocs(
    query(
      collection(db, CONVERSATION_COLLECTION, conversationId, 'messages'),
      orderBy('timestamp', 'asc'),
      limit(500)
    )
  );

  if (!msgsSnap.empty) {
    conv.messages = msgsSnap.docs.map(d => {
      const m = d.data();
      return {
        ...m,
        id: d.id,
        timestamp: m.timestamp?.toDate?.() || new Date(m.timestamp),
      } as ConversationMessage;
    });
  }
  // If subcollection is empty, conv.messages keeps the inline fallback from docToConversation

  return conv;
}

/**
 * Get or create a conversation for a given context
 * Finds the most recent active conversation for the same module/user/entity combo
 */
export async function getOrCreateConversation(
  data: AIConversationFormData,
  companyId: string,
  userId: string
): Promise<AIConversation> {
  // Build query to find existing conversation
  let q;
  if (data.designItemId) {
    q = query(
      conversationRef,
      where('userId', '==', userId),
      where('module', '==', data.module),
      where('designItemId', '==', data.designItemId),
      where('isArchived', '==', false),
      orderBy('lastMessageAt', 'desc'),
      limit(1)
    );
  } else if (data.projectId) {
    q = query(
      conversationRef,
      where('userId', '==', userId),
      where('module', '==', data.module),
      where('projectId', '==', data.projectId),
      where('isArchived', '==', false),
      orderBy('lastMessageAt', 'desc'),
      limit(1)
    );
  } else {
    q = query(
      conversationRef,
      where('userId', '==', userId),
      where('module', '==', data.module),
      where('companyId', '==', companyId),
      where('isArchived', '==', false),
      orderBy('lastMessageAt', 'desc'),
      limit(1)
    );
  }

  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    // Load full conversation including messages from subcollection
    const existingConversation = await getConversation(snapshot.docs[0].id);
    if (existingConversation) return existingConversation;
  }

  // Create new conversation
  const conversationId = await createConversation(data, companyId, userId);
  const newConversation = await getConversation(conversationId);
  if (!newConversation) throw new Error('Failed to create conversation');
  return newConversation;
}

/**
 * Add a message to a conversation.
 * Writes to the messages subcollection and updates the parent doc counters.
 */
export async function addConversationMessage(
  conversationId: string,
  message: Omit<ConversationMessage, 'id' | 'timestamp'>
): Promise<ConversationMessage> {
  const msgId = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const now = new Date();

  const newMessage: ConversationMessage = {
    ...message,
    id: msgId,
    timestamp: now,
  };

  // Write to subcollection
  const msgRef = doc(db, CONVERSATION_COLLECTION, conversationId, 'messages', msgId);
  await setDoc(msgRef, {
    ...message,
    id: msgId,
    timestamp: Timestamp.fromDate(now),
  });

  // Update parent doc counters
  const convRef = doc(conversationRef, conversationId);
  await updateDoc(convRef, {
    messageCount: increment(1),
    updatedAt: serverTimestamp(),
    lastMessageAt: serverTimestamp(),
  });

  return newMessage;
}

/**
 * Get recent conversations for a user
 */
export async function getRecentConversations(
  userId: string,
  companyId: string,
  module?: ConversationModule,
  maxResults = 20
): Promise<AIConversation[]> {
  let q;
  if (module) {
    q = query(
      conversationRef,
      where('userId', '==', userId),
      where('companyId', '==', companyId),
      where('module', '==', module),
      where('isArchived', '==', false),
      orderBy('lastMessageAt', 'desc'),
      limit(maxResults)
    );
  } else {
    q = query(
      conversationRef,
      where('userId', '==', userId),
      where('companyId', '==', companyId),
      where('isArchived', '==', false),
      orderBy('lastMessageAt', 'desc'),
      limit(maxResults)
    );
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => docToConversation(d.id, d.data()));
}

/**
 * Subscribe to a conversation (real-time updates).
 * Subscribes to the messages subcollection for live message updates.
 */
export function subscribeToConversation(
  conversationId: string,
  onData: (conversation: AIConversation | null) => void,
  onError?: (error: Error) => void
): () => void {
  const convDocRef = doc(conversationRef, conversationId);
  let latestConv: AIConversation | null = null;

  // Listen to the conversation doc for metadata
  const unsubConv = onSnapshot(
    convDocRef,
    (snapshot) => {
      if (snapshot.exists()) {
        latestConv = docToConversation(snapshot.id, snapshot.data());
      } else {
        latestConv = null;
        onData(null);
      }
    },
    (error) => {
      console.error('Error subscribing to conversation doc:', error);
      onError?.(error);
    }
  );

  // Listen to the messages subcollection
  const msgsQuery = query(
    collection(db, CONVERSATION_COLLECTION, conversationId, 'messages'),
    orderBy('timestamp', 'asc'),
    limit(500)
  );

  const unsubMsgs = onSnapshot(
    msgsQuery,
    (snapshot) => {
      if (!latestConv) return;
      const subMessages = snapshot.docs.map(d => {
        const m = d.data();
        return {
          ...m,
          id: d.id,
          timestamp: m.timestamp?.toDate?.() || new Date(m.timestamp),
        } as ConversationMessage;
      });
      // Use subcollection messages if present, else keep inline fallback
      if (subMessages.length > 0) {
        latestConv = { ...latestConv!, messages: subMessages };
      }
      onData(latestConv);
    },
    (error) => {
      console.error('Error subscribing to messages subcollection:', error);
      // Fallback: just send conversation with inline messages
      if (latestConv) onData(latestConv);
    }
  );

  return () => {
    unsubConv();
    unsubMsgs();
  };
}

/**
 * Archive a conversation
 */
export async function archiveConversation(
  conversationId: string
): Promise<void> {
  const docRef = doc(conversationRef, conversationId);
  await updateDoc(docRef, {
    isArchived: true,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Start a new conversation (archives the current one and creates fresh)
 */
export async function startNewConversation(
  currentConversationId: string | null,
  data: AIConversationFormData,
  companyId: string,
  userId: string
): Promise<AIConversation> {
  // Archive current conversation if it exists
  if (currentConversationId) {
    try {
      await archiveConversation(currentConversationId);
    } catch (err) {
      console.warn('Failed to archive previous conversation:', err);
    }
  }

  const conversationId = await createConversation(data, companyId, userId);
  const newConversation = await getConversation(conversationId);
  if (!newConversation) throw new Error('Failed to create conversation');
  return newConversation;
}

// ============================================================================
// Context Injection
// ============================================================================

/**
 * Build memory context for AI prompt injection.
 * Gathers relevant memories and recent conversation context.
 */
export async function buildMemoryContext(
  request: ContextInjectionRequest
): Promise<MemoryContext> {
  const { companyId, userId: _userId, categories, maxMemories = 15, projectId, customerId } = request;

  let memories: AIMemoryEntry[] = [];

  // Fetch entity-specific memories first (highest relevance)
  if (projectId) {
    const projectMemories = await searchMemories({
      companyId,
      relatedEntityId: projectId,
      limit: 5,
    });
    memories.push(...projectMemories);
  }

  if (customerId) {
    const customerMemories = await searchMemories({
      companyId,
      relatedEntityId: customerId,
      limit: 5,
    });
    memories.push(...customerMemories);
  }

  // Fetch category-specific memories
  if (categories && categories.length > 0) {
    const categoryMemories = await searchMemories({
      companyId,
      categories,
      limit: maxMemories - memories.length,
    });
    // Deduplicate
    const existingIds = new Set(memories.map(m => m.id));
    memories.push(...categoryMemories.filter(m => !existingIds.has(m.id)));
  }

  // Fill remaining slots with recent important memories
  if (memories.length < maxMemories) {
    const recentMemories = await getRecentMemories(
      companyId,
      maxMemories - memories.length
    );
    const existingIds = new Set(memories.map(m => m.id));
    memories.push(...recentMemories.filter(m => !existingIds.has(m.id)));
  }

  // Trim to max
  memories = memories.slice(0, maxMemories);

  // Record access for retrieved memories
  if (memories.length > 0) {
    try {
      await recordMemoryAccess(memories.map(m => m.id));
    } catch (err) {
      console.warn('Failed to record memory access:', err);
    }
  }

  return {
    memories,
    totalMemories: memories.length,
  };
}

/**
 * Format memory context as a string for injection into AI system prompts.
 */
export function formatMemoryForPrompt(context: MemoryContext): string {
  if (context.memories.length === 0) {
    return '';
  }

  const grouped: Record<string, string[]> = {};

  for (const memory of context.memories) {
    const category = memory.category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(`- ${memory.summary || memory.content}`);
  }

  let prompt = '\n\n--- BUSINESS KNOWLEDGE (from persistent memory) ---\n';
  prompt += 'The following information has been learned from previous conversations and business data. Use it to provide more informed, contextual responses:\n\n';

  for (const [category, items] of Object.entries(grouped)) {
    prompt += `${category}:\n${items.join('\n')}\n\n`;
  }

  prompt += '--- END BUSINESS KNOWLEDGE ---\n';

  if (context.recentConversationSummary) {
    prompt += `\nPrevious conversation summary: ${context.recentConversationSummary}\n`;
  }

  return prompt;
}

// ============================================================================
// Document Converters
// ============================================================================

function docToMemory(id: string, data: any): AIMemoryEntry {
  return {
    id,
    category: data.category,
    content: data.content,
    summary: data.summary,
    tags: data.tags || [],
    importance: data.importance,
    source: data.source || { type: 'manual' },
    companyId: data.companyId,
    createdBy: data.createdBy,
    createdAt: data.createdAt?.toDate?.() || new Date(),
    updatedAt: data.updatedAt?.toDate?.() || new Date(),
    accessCount: data.accessCount || 0,
    lastAccessedAt: data.lastAccessedAt?.toDate?.() || new Date(),
    expiresAt: data.expiresAt?.toDate?.() || undefined,
    isArchived: data.isArchived || false,
    relatedEntityIds: data.relatedEntityIds || [],
    embedding: data.embedding,
  };
}

function docToConversation(id: string, data: any): AIConversation {
  return {
    id,
    userId: data.userId,
    companyId: data.companyId,
    module: data.module,
    mode: data.mode,
    title: data.title,
    messages: (data.messages || []).map((m: any) => ({
      ...m,
      timestamp: m.timestamp?.toDate?.() || new Date(m.timestamp),
    })),
    context: data.context,
    memoryExtractionDone: data.memoryExtractionDone || false,
    projectId: data.projectId,
    designItemId: data.designItemId,
    customerId: data.customerId,
    createdAt: data.createdAt?.toDate?.() || new Date(),
    updatedAt: data.updatedAt?.toDate?.() || new Date(),
    lastMessageAt: data.lastMessageAt?.toDate?.() || new Date(),
    messageCount: data.messageCount || 0,
    isArchived: data.isArchived || false,
  };
}
