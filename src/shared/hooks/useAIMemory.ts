/**
 * useAIMemory Hook
 * ZeusOS v2.0 - React hook for AI Memory System
 * 
 * Provides:
 * - Conversation persistence (load/save/subscribe)
 * - Business memory access
 * - Context injection for AI prompts
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getOrCreateConversation,
  addConversationMessage,
  subscribeToConversation,
  startNewConversation,
  getRecentConversations,
  buildMemoryContext,
  formatMemoryForPrompt,
  searchMemories,
  createMemory,
} from '@/shared/services/ai/aiMemory.service';
import type {
  AIConversation,
  AIConversationFormData,
  ConversationMessage,
  ConversationModule,
  MemoryContext,
  MemoryCategory,
  AIMemoryFormData,
  AIMemoryEntry,
  MemorySearchParams,
} from '@/shared/services/ai/aiMemory.types';

// ============================================================================
// useAIConversation — Persistent conversation hook
// ============================================================================

interface UseAIConversationOptions {
  module: ConversationModule;
  companyId: string;
  userId: string;
  mode?: string;
  title?: string;
  projectId?: string;
  designItemId?: string;
  customerId?: string;
  autoLoad?: boolean;
}

interface UseAIConversationReturn {
  conversation: AIConversation | null;
  messages: ConversationMessage[];
  isLoading: boolean;
  error: string | null;
  addMessage: (message: Omit<ConversationMessage, 'id' | 'timestamp'>) => Promise<ConversationMessage | null>;
  startNew: () => Promise<void>;
  conversationId: string | null;
  recentConversations: AIConversation[];
  loadConversation: (conversationId: string) => void;
}

export function useAIConversation(options: UseAIConversationOptions): UseAIConversationReturn {
  const {
    module,
    companyId,
    userId,
    mode,
    title,
    projectId,
    designItemId,
    customerId,
    autoLoad = true,
  } = options;

  const [conversation, setConversation] = useState<AIConversation | null>(null);
  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recentConversations, setRecentConversations] = useState<AIConversation[]>([]);
  const initialized = useRef(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);

  // Build form data for conversation creation
  const buildFormData = useCallback((): AIConversationFormData => ({
    module,
    mode,
    title: title || `${module} conversation`,
    projectId,
    designItemId,
    customerId,
  }), [module, mode, title, projectId, designItemId, customerId]);

  // Initialize conversation
  useEffect(() => {
    if (!companyId || !userId || !autoLoad || initialized.current) return;

    const init = async () => {
      try {
        setIsLoading(true);
        const conv = await getOrCreateConversation(buildFormData(), companyId, userId);
        setConversation(conv);
        setMessages(conv.messages);
        initialized.current = true;

        // Load recent conversations for history sidebar
        try {
          const recent = await getRecentConversations(userId, companyId, module, 10);
          setRecentConversations(recent);
        } catch {
          // Non-critical — ignore
        }
      } catch (err) {
        console.warn('AI conversation init failed (non-blocking):', err);
        setError('Conversation history unavailable');
        initialized.current = true;
      } finally {
        setIsLoading(false);
      }
    };

    init();
  }, [companyId, userId, autoLoad, module, buildFormData]);

  // Subscribe to real-time updates
  useEffect(() => {
    if (!conversation?.id) return;

    // Clean up previous subscription
    if (unsubscribeRef.current) {
      unsubscribeRef.current();
    }

    unsubscribeRef.current = subscribeToConversation(
      conversation.id,
      (updated) => {
        if (updated) {
          setConversation(updated);
          setMessages(updated.messages);
        }
      },
      (err) => {
        console.warn('Conversation subscription error:', err);
      }
    );

    return () => {
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [conversation?.id]);

  // Add a message to the conversation
  const addMessage = useCallback(async (
    message: Omit<ConversationMessage, 'id' | 'timestamp'>
  ): Promise<ConversationMessage | null> => {
    if (!conversation?.id) {
      // If conversation hasn't loaded yet, add to local state only
      const localMsg: ConversationMessage = {
        ...message,
        id: `local-${Date.now()}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, localMsg]);
      return localMsg;
    }

    try {
      const newMsg = await addConversationMessage(conversation.id, message);
      return newMsg;
    } catch (err) {
      console.warn('Failed to persist message:', err);
      // Still add locally so the UI isn't broken
      const localMsg: ConversationMessage = {
        ...message,
        id: `local-${Date.now()}`,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, localMsg]);
      return localMsg;
    }
  }, [conversation?.id]);

  // Start a new conversation
  const startNew = useCallback(async () => {
    if (!companyId || !userId) return;

    try {
      setIsLoading(true);
      const newConv = await startNewConversation(
        conversation?.id || null,
        buildFormData(),
        companyId,
        userId
      );
      setConversation(newConv);
      setMessages([]);
    } catch (err) {
      console.warn('Failed to start new conversation:', err);
      setError('Failed to start new conversation');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, userId, conversation?.id, buildFormData]);

  // Load a specific conversation by ID
  const loadConversation = useCallback((conversationId: string) => {
    const conv = recentConversations.find(c => c.id === conversationId);
    if (conv) {
      setConversation(conv);
      setMessages(conv.messages);
    }
  }, [recentConversations]);

  return {
    conversation,
    messages,
    isLoading,
    error,
    addMessage,
    startNew,
    conversationId: conversation?.id || null,
    recentConversations,
    loadConversation,
  };
}

// ============================================================================
// useAIMemoryContext — Memory context for AI prompt injection
// ============================================================================

interface UseAIMemoryContextOptions {
  companyId: string;
  userId: string;
  module: ConversationModule;
  categories?: MemoryCategory[];
  projectId?: string;
  customerId?: string;
  enabled?: boolean;
}

interface UseAIMemoryContextReturn {
  memoryContext: MemoryContext | null;
  memoryPrompt: string;
  isLoading: boolean;
  refresh: () => Promise<void>;
}

export function useAIMemoryContext(options: UseAIMemoryContextOptions): UseAIMemoryContextReturn {
  const {
    companyId,
    userId,
    module,
    categories,
    projectId,
    customerId,
    enabled = true,
  } = options;

  const [memoryContext, setMemoryContext] = useState<MemoryContext | null>(null);
  const [memoryPrompt, setMemoryPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const loadContext = useCallback(async () => {
    if (!companyId || !userId || !enabled) return;

    try {
      setIsLoading(true);
      const context = await buildMemoryContext({
        companyId,
        userId,
        module,
        categories,
        projectId,
        customerId,
      });
      setMemoryContext(context);
      setMemoryPrompt(formatMemoryForPrompt(context));
    } catch (err) {
      console.warn('Failed to load memory context:', err);
    } finally {
      setIsLoading(false);
    }
  }, [companyId, userId, module, categories, projectId, customerId, enabled]);

  useEffect(() => {
    loadContext();
  }, [loadContext]);

  return {
    memoryContext,
    memoryPrompt,
    isLoading,
    refresh: loadContext,
  };
}

// ============================================================================
// useBusinessMemory — CRUD for business memory entries
// ============================================================================

interface UseBusinessMemoryOptions {
  companyId: string;
  userId: string;
  categories?: MemoryCategory[];
  autoLoad?: boolean;
}

interface UseBusinessMemoryReturn {
  memories: AIMemoryEntry[];
  isLoading: boolean;
  error: string | null;
  addMemory: (data: AIMemoryFormData) => Promise<string | null>;
  search: (params: Partial<MemorySearchParams>) => Promise<AIMemoryEntry[]>;
  refresh: () => Promise<void>;
}

export function useBusinessMemory(options: UseBusinessMemoryOptions): UseBusinessMemoryReturn {
  const { companyId, userId, categories, autoLoad = true } = options;

  const [memories, setMemories] = useState<AIMemoryEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMemories = useCallback(async () => {
    if (!companyId) return;

    try {
      setIsLoading(true);
      const result = await searchMemories({
        companyId,
        categories,
        limit: 50,
      });
      setMemories(result);
    } catch (err) {
      console.warn('Failed to load business memories:', err);
      setError('Failed to load memories');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, categories]);

  useEffect(() => {
    if (autoLoad) {
      loadMemories();
    }
  }, [autoLoad, loadMemories]);

  const addMemory = useCallback(async (data: AIMemoryFormData): Promise<string | null> => {
    if (!companyId || !userId) return null;
    try {
      const id = await createMemory(data, companyId, userId);
      await loadMemories(); // Refresh list
      return id;
    } catch (err) {
      console.warn('Failed to create memory:', err);
      setError('Failed to save memory');
      return null;
    }
  }, [companyId, userId, loadMemories]);

  const search = useCallback(async (params: Partial<MemorySearchParams>): Promise<AIMemoryEntry[]> => {
    try {
      return await searchMemories({ companyId, ...params });
    } catch (err) {
      console.warn('Memory search failed:', err);
      return [];
    }
  }, [companyId]);

  return {
    memories,
    isLoading,
    error,
    addMemory,
    search,
    refresh: loadMemories,
  };
}
