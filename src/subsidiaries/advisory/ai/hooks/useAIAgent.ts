// src/subsidiaries/advisory/ai/hooks/useAIAgent.ts

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import {
  AgentConversation,
  AgentMessage,
  AgentAction,
  AgentDomain,
  SessionContext,
  UserAIPreferences,
} from '../types/agent';
import { createDomainDetector, DomainDetector } from '../services/domain-detector';
import { createGeminiAgent, GeminiAgent } from '../services/gemini-agent';
import { executeToolCall } from '../services/tool-executor';

// Default configuration
const DEFAULT_PREFERENCES: UserAIPreferences = {
  preferredLanguage: 'en',
  responseLength: 'detailed',
  autoExecuteActions: false,
  showConfidenceScores: false,
  enabledDomains: ['general', 'infrastructure', 'investment', 'advisory', 'matflow', 'analytics'],
  defaultCurrency: 'UGX',
  timezone: 'Africa/Kampala',
};

interface UseAIConversationOptions {
  userId: string;
  organizationId: string;
  conversationId?: string;
  sessionContext?: Partial<SessionContext>;
  onDomainChange?: (domain: AgentDomain) => void;
  onAction?: (action: AgentAction) => void;
}

interface UseAIConversationReturn {
  conversation: AgentConversation | null;
  messages: AgentMessage[];
  isLoading: boolean;
  isSending: boolean;
  error: Error | null;
  currentDomain: AgentDomain;
  sendMessage: (content: string) => Promise<void>;
  clearConversation: () => void;
  executeAction: (action: AgentAction) => Promise<void>;
}

/**
 * Hook for managing AI conversations
 */
export function useAIConversation(
  options: UseAIConversationOptions
): UseAIConversationReturn {
  const {
    userId,
    organizationId,
    conversationId: initialConversationId,
    sessionContext: initialSessionContext,
    onDomainChange,
    onAction,
  } = options;

  const [conversation, setConversation] = useState<AgentConversation | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [currentDomain, setCurrentDomain] = useState<AgentDomain>('general');
  const [conversationId, setConversationId] = useState<string | undefined>(
    initialConversationId
  );

  const agentRef = useRef<GeminiAgent | null>(null);
  const detectorRef = useRef<DomainDetector | null>(null);

  // Initialize session context
  const sessionContext: SessionContext = {
    userId,
    organizationId,
    currentModule: initialSessionContext?.currentModule,
    currentPage: initialSessionContext?.currentPage,
    currentEntityId: initialSessionContext?.currentEntityId,
    currentEntityType: initialSessionContext?.currentEntityType,
    recentEntities: initialSessionContext?.recentEntities || [],
    preferences: initialSessionContext?.preferences || DEFAULT_PREFERENCES,
  };

  // Initialize agent and detector
  useEffect(() => {
    detectorRef.current = createDomainDetector(sessionContext);
    
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || '';
    if (apiKey) {
      agentRef.current = createGeminiAgent(
        apiKey,
        {
          model: 'gemini-1.5-flash',
          temperature: 0.7,
          maxTokens: 2048,
          enabledDomains: sessionContext.preferences.enabledDomains,
          defaultDomain: 'general',
          features: {
            enableActions: true,
            enableEntityLinking: true,
            enableCrossModuleQueries: true,
            enableStreaming: true,
          },
          safety: {
            blockHarmfulContent: true,
            requireConfirmation: ['delete', 'approve', 'reject'],
          },
          rateLimit: {
            maxMessagesPerMinute: 20,
            maxTokensPerDay: 100000,
          },
        },
        detectorRef.current
      );
    }
  }, [userId, organizationId]);

  // Subscribe to conversation
  useEffect(() => {
    if (!conversationId) {
      setIsLoading(false);
      return;
    }

    const conversationRef = doc(db, 'aiConversations', conversationId);
    const unsubscribeConversation = onSnapshot(
      conversationRef,
      (snapshot) => {
        if (snapshot.exists()) {
          setConversation({
            id: snapshot.id,
            ...snapshot.data(),
          } as AgentConversation);
        }
      },
      (err) => {
        setError(err);
      }
    );

    // Subscribe to messages
    const messagesRef = collection(db, 'aiConversations', conversationId, 'messages');
    const messagesQuery = query(
      messagesRef,
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    const unsubscribeMessages = onSnapshot(
      messagesQuery,
      (snapshot) => {
        const newMessages = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as AgentMessage[];
        setMessages(newMessages);
        setIsLoading(false);
      },
      (err) => {
        setError(err);
        setIsLoading(false);
      }
    );

    return () => {
      unsubscribeConversation();
      unsubscribeMessages();
    };
  }, [conversationId]);

  // Create new conversation
  const createConversation = useCallback(async (): Promise<string> => {
    const conversationsRef = collection(db, 'aiConversations');
    const newConversation: Omit<AgentConversation, 'id'> = {
      userId,
      organizationId,
      title: 'New Conversation',
      status: 'active',
      currentDomain: 'general',
      domainHistory: [],
      linkedEntities: [],
      messageCount: 0,
      lastMessageAt: Timestamp.now(),
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(conversationsRef, newConversation);
    setConversationId(docRef.id);
    return docRef.id;
  }, [userId, organizationId]);

  // Send message
  const sendMessage = useCallback(
    async (content: string) => {
      if (!content.trim()) return;

      setIsSending(true);
      setError(null);

      try {
        // Create conversation if needed
        let activeConversationId = conversationId;
        if (!activeConversationId) {
          activeConversationId = await createConversation();
        }

        // Add user message to Firestore
        const messagesRef = collection(
          db,
          'aiConversations',
          activeConversationId,
          'messages'
        );

        const userMessage: Omit<AgentMessage, 'id'> = {
          conversationId: activeConversationId,
          role: 'user',
          content,
          domain: currentDomain,
          entities: [],
          actions: [],
          createdAt: Timestamp.now(),
        };

        await addDoc(messagesRef, userMessage);

        // Process with AI agent
        if (agentRef.current) {
          const result = await agentRef.current.processMessage(
            activeConversationId,
            content,
            currentDomain
          );

          // Check for domain change
          if (result.domain.domain !== currentDomain) {
            setCurrentDomain(result.domain.domain);
            onDomainChange?.(result.domain.domain);
          }

          // Add assistant message
          const assistantMessage: Omit<AgentMessage, 'id'> = {
            conversationId: activeConversationId,
            role: 'assistant',
            content: result.response,
            domain: result.domain.domain,
            domainContext: result.domain,
            entities: result.domain.detectedEntities,
            actions: result.actions,
            tokenUsage: result.tokenUsage,
            processingTimeMs: result.processingTimeMs,
            createdAt: Timestamp.now(),
          };

          await addDoc(messagesRef, assistantMessage);

          // Update conversation
          const conversationRef = doc(db, 'aiConversations', activeConversationId);
          await updateDoc(conversationRef, {
            currentDomain: result.domain.domain,
            messageCount: messages.length + 2,
            lastMessageAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          // Handle actions
          for (const action of result.actions) {
            onAction?.(action);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to send message'));
      } finally {
        setIsSending(false);
      }
    },
    [conversationId, currentDomain, messages.length, createConversation, onDomainChange, onAction]
  );

  // Clear conversation
  const clearConversation = useCallback(() => {
    if (agentRef.current && conversationId) {
      agentRef.current.clearHistory(conversationId);
    }
    setMessages([]);
    setCurrentDomain('general');
  }, [conversationId]);

  // Execute action
  const executeActionCallback = useCallback(
    async (action: AgentAction) => {
      try {
        const result = await executeToolCall(action.type, action.params);
        onAction?.({ ...action, status: 'executed', result });
      } catch (err) {
        onAction?.({
          ...action,
          status: 'failed',
          error: err instanceof Error ? err.message : 'Action failed',
        });
      }
    },
    [onAction]
  );

  return {
    conversation,
    messages,
    isLoading,
    isSending,
    error,
    currentDomain,
    sendMessage,
    clearConversation,
    executeAction: executeActionCallback,
  };
}

/**
 * Hook for streaming AI responses
 */
export function useAIStreaming(conversationId: string) {
  const [streamingResponse, setStreamingResponse] = useState<string>('');
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  const startStreaming = useCallback(
    async (message: string, agent: GeminiAgent) => {
      setIsStreaming(true);
      setStreamingResponse('');
      abortControllerRef.current = new AbortController();

      try {
        for await (const chunk of agent.streamMessage(conversationId, message)) {
          if (abortControllerRef.current?.signal.aborted) {
            break;
          }
          setStreamingResponse((prev) => prev + chunk);
        }
      } finally {
        setIsStreaming(false);
      }
    },
    [conversationId]
  );

  const stopStreaming = useCallback(() => {
    abortControllerRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return {
    streamingResponse,
    isStreaming,
    startStreaming,
    stopStreaming,
  };
}

/**
 * Hook for AI suggestions based on context
 */
export function useAISuggestions(domain: AgentDomain) {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const generateSuggestions = useCallback(() => {
    setIsLoading(true);

    // Domain-specific suggestions
    const domainSuggestions: Record<AgentDomain, string[]> = {
      general: [
        'What can you help me with?',
        'Show me my recent activity',
        'Navigate to infrastructure projects',
        'Search for active engagements',
      ],
      infrastructure: [
        'What is the status of the Rushoroza project?',
        'Show me delayed milestones',
        'Generate IPC for current period',
        'Compare project progress across sites',
        'What projects are over budget?',
      ],
      investment: [
        'Show portfolio performance YTD',
        'What is our current IRR?',
        'Compare returns across asset classes',
        'Which investments are underperforming?',
        'Show NAV breakdown by sector',
      ],
      advisory: [
        'Show active deals in pipeline',
        'What deals are closing this month?',
        'Generate proposal for new mandate',
        'Show client engagement summary',
        'Compare deal performance',
      ],
      matflow: [
        'Create a new requisition',
        'Check budget for Rushoroza project',
        'Get supplier quotes for cement',
        'Track delivery for latest PO',
        'What materials are low in stock?',
      ],
      analytics: [
        'Generate monthly performance report',
        'Compare all active projects',
        'Show KPI dashboard',
        'Analyze spending trends',
        'Export data to Excel',
      ],
      settings: [
        'Change notification preferences',
        'Update timezone settings',
        'Show my profile',
        'Configure default currency',
      ],
    };

    setSuggestions(domainSuggestions[domain] || domainSuggestions.general);
    setIsLoading(false);
  }, [domain]);

  useEffect(() => {
    generateSuggestions();
  }, [generateSuggestions]);

  return {
    suggestions,
    isLoading,
    refreshSuggestions: generateSuggestions,
  };
}
