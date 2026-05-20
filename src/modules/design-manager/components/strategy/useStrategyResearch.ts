/**
 * Strategy Research Hook
 * Manages strategy research state and API calls
 * Now with persistent chat history via ai_conversations collection
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { doc, onSnapshot, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import {
  getOrCreateConversation,
  addConversationMessage,
  subscribeToConversation,
} from '@/shared/services/ai/aiMemory.service';

const API_BASE = 'https://api-okekivpl2a-uc.a.run.app';

export interface ProjectStrategy {
  id: string;
  projectId: string;
  challenges: {
    painPoints: string[];
    goals: string[];
    constraints: string[];
  };
  spaceParameters: {
    totalArea: number;
    areaUnit: 'sqm' | 'sqft';
    spaceType: string;
    circulationPercent: number;
    calculatedCapacity?: {
      minimum: number;
      optimal: number;
      maximum: number;
    };
  };
  budgetFramework: {
    tier: 'economy' | 'standard' | 'premium' | 'luxury';
    priorities: string[];
  };
  researchFindings: ResearchFinding[];
  designBrief?: string;
  updatedAt?: Date;
}

export interface ResearchFinding {
  id: string;
  title: string;
  content: string;
  sources: string[];
  category: 'trend' | 'benchmark' | 'recommendation' | 'insight';
  createdAt: Date;
}

export interface ResearchMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: Array<{ url: string; title: string; domain?: string }>;
  timestamp: Date;
}

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface UseStrategyResearchReturn {
  strategy: ProjectStrategy | null;
  messages: ResearchMessage[];
  isLoading: boolean;
  isSending: boolean;
  error: string | null;
  saveStatus: SaveStatus;
  lastSaved: Date | null;
  isSynced: boolean;
  updateStrategy: (updates: Partial<ProjectStrategy>) => Promise<void>;
  sendQuery: (query: string, enableWebSearch?: boolean) => Promise<void>;
  saveFinding: (finding: Omit<ResearchFinding, 'id' | 'createdAt'>) => Promise<void>;
  deleteFinding: (findingId: string) => Promise<void>;
  clearError: () => void;
}

const DEFAULT_STRATEGY: Omit<ProjectStrategy, 'id' | 'projectId'> = {
  challenges: { painPoints: [], goals: [], constraints: [] },
  spaceParameters: {
    totalArea: 0,
    areaUnit: 'sqm',
    spaceType: 'restaurant',
    circulationPercent: 30,
  },
  budgetFramework: { tier: 'standard', priorities: [] },
  researchFindings: [],
};

export function useStrategyResearch(projectId: string, userId?: string, companyId?: string): UseStrategyResearchReturn {
  const [strategy, setStrategy] = useState<ProjectStrategy | null>(null);
  const [messages, setMessages] = useState<ResearchMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [chatId, setChatId] = useState<string | null>(null);
  const chatInitialized = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isSavingRef = useRef(false);
  const pendingUpdateRef = useRef<any>(null);

  // Load strategy from Firestore
  useEffect(() => {
    if (!projectId) {
      setIsLoading(false);
      return;
    }

    const strategyRef = doc(db, 'projectStrategy', projectId);

    const unsubscribe = onSnapshot(strategyRef, (snapshot) => {
      // Skip update if we're currently saving to prevent overwriting user input
      if (isSavingRef.current) {
        // Store the update to apply after save completes
        pendingUpdateRef.current = snapshot;
        return;
      }

      if (snapshot.exists()) {
        const data = snapshot.data();
        setStrategy({
          id: snapshot.id,
          projectId,
          ...data,
          updatedAt: data.updatedAt?.toDate(),
          researchFindings: (data.researchFindings || []).map((f: any) => ({
            ...f,
            createdAt: f.createdAt?.toDate() || new Date(),
          })),
        } as ProjectStrategy);
      } else {
        // Initialize with defaults
        setStrategy({
          id: projectId,
          projectId,
          ...DEFAULT_STRATEGY,
        });
      }
      setIsLoading(false);
    }, (err) => {
      console.error('Error loading strategy:', err);
      setError('Failed to load project strategy');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [projectId]);

  // Initialize or load chat history (non-blocking - failures won't affect core functionality)
  useEffect(() => {
    if (!projectId || !userId || chatInitialized.current) return;
    
    const initChat = async () => {
      try {
        const conv = await getOrCreateConversation({
          module: 'strategy_research',
          title: `Strategy Research - ${projectId}`,
          projectId,
        }, companyId || 'default', userId);
        
        setChatId(conv.id);
        chatInitialized.current = true;
        
        // Load existing messages
        if (conv.messages.length > 0) {
          setMessages(conv.messages.map(m => ({
            id: m.id,
            role: m.role as 'user' | 'assistant',
            content: m.content,
            sources: m.sources as any,
            timestamp: m.timestamp,
          })));
        }
      } catch (err) {
        // Chat history is optional - don't break the UI if it fails
        console.warn('Chat history unavailable:', err);
        chatInitialized.current = true; // Prevent retries
      }
    };
    
    initChat();
  }, [projectId, userId, companyId]);

  // Subscribe to conversation updates for real-time sync
  useEffect(() => {
    if (!chatId) return;
    
    const unsubscribe = subscribeToConversation(chatId, (conv) => {
      if (conv && conv.messages.length > 0) {
        setMessages(conv.messages.map(m => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          sources: m.sources as any,
          timestamp: m.timestamp,
        })));
      }
    });
    
    return () => unsubscribe();
  }, [chatId]);

  const updateStrategy = useCallback(async (updates: Partial<ProjectStrategy>) => {
    if (!projectId) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set saving flag to prevent onSnapshot from overwriting user input
    isSavingRef.current = true;
    setSaveStatus('saving');
    setError(null);

    try {
      const strategyRef = doc(db, 'projectStrategy', projectId);
      await setDoc(strategyRef, {
        ...updates,
        updatedAt: Timestamp.now(),
      }, { merge: true });

      setSaveStatus('saved');
      setLastSaved(new Date());

      // Reset to idle after 2 seconds
      saveTimeoutRef.current = setTimeout(() => {
        setSaveStatus('idle');
      }, 2000);

    } catch (err) {
      console.error('Error updating strategy:', err);
      setSaveStatus('error');
      setError('Failed to save changes');

      // Reset to idle after 5 seconds even on error
      saveTimeoutRef.current = setTimeout(() => {
        setSaveStatus('idle');
      }, 5000);
    } finally {
      // Clear saving flag and apply any pending updates
      isSavingRef.current = false;

      // If there was a pending Firestore update, apply it now
      if (pendingUpdateRef.current) {
        const snapshot = pendingUpdateRef.current;
        pendingUpdateRef.current = null;

        if (snapshot.exists()) {
          const data = snapshot.data();
          setStrategy({
            id: snapshot.id,
            projectId,
            ...data,
            updatedAt: data.updatedAt?.toDate(),
            researchFindings: (data.researchFindings || []).map((f: any) => ({
              ...f,
              createdAt: f.createdAt?.toDate() || new Date(),
            })),
          } as ProjectStrategy);
        }
      }
    }
  }, [projectId]);

  const sendQuery = useCallback(async (query: string, enableWebSearch = false) => {
    if (!query.trim()) return;

    setIsSending(true);
    setError(null);

    // Add user message to local state first for immediate UI feedback
    const userMessage: ResearchMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMessage]);

    // Persist user message to Firestore
    if (chatId) {
      try {
        await addConversationMessage(chatId, { role: 'user', content: query });
      } catch (err) {
        console.warn('Failed to persist user message:', err);
      }
    }

    try {
      const response = await fetch(`${API_BASE}/ai/strategy-research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query,
          projectId,
          projectContext: strategy ? {
            challenges: strategy.challenges,
            spaceParameters: strategy.spaceParameters,
            budgetFramework: strategy.budgetFramework,
          } : undefined,
          enableWebSearch,
          userId,
          companyId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Research query failed');
      }

      // Add assistant response to local state
      const assistantMessage: ResearchMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: result.text,
        sources: result.sources,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, assistantMessage]);

      // Persist assistant message to Firestore
      if (chatId) {
        try {
          await addConversationMessage(chatId, {
            role: 'assistant',
            content: result.text,
            sources: result.sources,
          });
        } catch (err) {
          console.warn('Failed to persist assistant message:', err);
        }
      }

    } catch (err: any) {
      console.error('Error sending query:', err);
      setError(err.message || 'Failed to process research query');
      setMessages(prev => prev.filter(m => m.id !== userMessage.id));
    } finally {
      setIsSending(false);
    }
  }, [projectId, strategy, userId, chatId]);

  const saveFinding = useCallback(async (finding: Omit<ResearchFinding, 'id' | 'createdAt'>) => {
    if (!projectId || !strategy) return;

    const newFinding: ResearchFinding = {
      ...finding,
      id: `finding-${Date.now()}`,
      createdAt: new Date(),
    };

    const updatedFindings = [...(strategy.researchFindings || []), newFinding];
    await updateStrategy({ researchFindings: updatedFindings });
  }, [projectId, strategy, updateStrategy]);

  const deleteFinding = useCallback(async (findingId: string) => {
    if (!projectId || !strategy) return;

    const updatedFindings = strategy.researchFindings.filter(f => f.id !== findingId);
    await updateStrategy({ researchFindings: updatedFindings });
  }, [projectId, strategy, updateStrategy]);

  const clearError = useCallback(() => setError(null), []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return {
    strategy,
    messages,
    isLoading,
    isSending,
    error,
    saveStatus,
    lastSaved,
    isSynced: saveStatus === 'saved' || saveStatus === 'idle',
    updateStrategy,
    sendQuery,
    saveFinding,
    deleteFinding,
    clearError,
  };
}
