/**
 * useMarketingAgent Hook
 * React hook for the Marketing AI Agent with conversation state
 */

import { useState, useCallback, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type {
  AgentMessage,
  MarketingKeyDate,
  ContentGenerationRequest,
  GeneratedContent,
  StrategyContext,
  MarketingAgentConfig,
  CampaignProposal,
} from '../types';
import type { MarketingTask, MarketingTaskStatus } from '../types/marketing-task.types';
import type { StrategyAnalysisResult, StrategyResearchResult, AISuggestedTask } from '../services/marketingAgentService';
import {
  chatWithAgent,
  generateContent,
  discoverKeyDates,
  saveKeyDates,
  getKeyDates,
  acknowledgeKeyDate,
  deleteKeyDate,
  getAgentConfig,
  saveAgentConfig,
  proposeCampaigns,
  analyzeStrategyDocument,
  loadStrategyContext,
  saveStrategyContext,
  researchStrategyUpdate,
  suggestTasksFromAI,
} from '../services/marketingAgentService';
import {
  getMarketingTasks,
  createAISuggestedTasks,
  updateTaskStatus as updateTaskStatusSvc,
  deleteMarketingTask,
} from '../services/marketingTaskService';

interface UseMarketingAgentReturn {
  // Chat
  messages: AgentMessage[];
  sendMessage: (content: string) => Promise<void>;
  clearChat: () => void;
  chatLoading: boolean;

  // Content Generation
  generatedContent: GeneratedContent | null;
  generatePostContent: (request: ContentGenerationRequest) => Promise<GeneratedContent | null>;
  generating: boolean;

  // Key Dates
  keyDates: MarketingKeyDate[];
  loadKeyDates: () => Promise<void>;
  discoverDates: (options?: {
    region?: string;
    country?: string;
    industry?: string;
  }) => Promise<MarketingKeyDate[]>;
  saveDates: (dates: MarketingKeyDate[]) => Promise<void>;
  acknowledgeDt: (dateId: string) => Promise<void>;
  removeDt: (dateId: string) => Promise<void>;
  datesLoading: boolean;

  // Config
  config: MarketingAgentConfig | null;
  loadConfig: () => Promise<void>;
  updateConfig: (config: MarketingAgentConfig) => Promise<void>;

  // Campaign Proposals
  campaignProposals: CampaignProposal[];
  proposeDraftCampaigns: () => Promise<CampaignProposal[]>;
  proposingCampaigns: boolean;

  // Strategy
  strategyContext: Partial<StrategyContext>;
  setStrategyContext: (ctx: Partial<StrategyContext>) => void;
  saveStrategy: (ctx: Partial<StrategyContext>) => Promise<void>;
  loadStrategy: () => Promise<void>;
  strategyLoaded: boolean;
  analyzeStrategy: (file: File) => Promise<StrategyAnalysisResult | null>;
  strategyAnalysis: StrategyAnalysisResult | null;
  analyzingStrategy: boolean;
  researchStrategy: () => Promise<StrategyResearchResult | null>;
  strategyResearch: StrategyResearchResult | null;
  researchingStrategy: boolean;

  // AI-Anchored Tasks
  tasks: MarketingTask[];
  tasksLoading: boolean;
  suggestedTasks: AISuggestedTask[];
  suggestingTasks: boolean;
  loadTasks: () => Promise<void>;
  suggestTasks: () => Promise<AISuggestedTask[]>;
  acceptSuggestedTasks: (tasks: AISuggestedTask[]) => Promise<void>;
  updateTaskStatus: (taskId: string, status: MarketingTaskStatus) => Promise<void>;
  removeTask: (taskId: string) => Promise<void>;

  // Error
  error: Error | null;
}

export function useMarketingAgent(companyId?: string): UseMarketingAgentReturn {
  const { user } = useAuth();
  // Firebase User doesn't have companyId — use uid as company identifier
  const effectiveCompanyId = companyId || (user as any)?.companyId || user?.uid || '';

  // Chat state
  const [messages, setMessages] = useState<AgentMessage[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hello! I'm your Marketing AI Assistant. I can help you with:\n\n" +
        "🗓️ **Key Dates** — Discover important marketing dates\n" +
        "✍️ **Content Creation** — Draft posts aligned with your strategy\n" +
        "📊 **Campaign Planning** — Plan and optimize campaigns\n\n" +
        "What would you like to work on today?",
      timestamp: new Date(),
    },
  ]);
  const [chatLoading, setChatLoading] = useState(false);

  // Content state
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const [generating, setGenerating] = useState(false);

  // Key dates state
  const [keyDates, setKeyDates] = useState<MarketingKeyDate[]>([]);
  const [datesLoading, setDatesLoading] = useState(false);

  // Config state
  const [config, setConfig] = useState<MarketingAgentConfig | null>(null);
  const [strategyContext, setStrategyContext] = useState<Partial<StrategyContext>>({});

  // Campaign proposals state
  const [campaignProposals, setCampaignProposals] = useState<CampaignProposal[]>([]);
  const [proposingCampaigns, setProposingCampaigns] = useState(false);

  // Strategy analysis state
  const [strategyAnalysis, setStrategyAnalysis] = useState<StrategyAnalysisResult | null>(null);
  const [analyzingStrategy, setAnalyzingStrategy] = useState(false);
  const [strategyLoaded, setStrategyLoaded] = useState(false);

  // Strategy research state
  const [strategyResearch, setStrategyResearch] = useState<StrategyResearchResult | null>(null);
  const [researchingStrategy, setResearchingStrategy] = useState(false);

  // AI-anchored task state
  const [tasks, setTasks] = useState<MarketingTask[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [suggestedTasks, setSuggestedTasks] = useState<AISuggestedTask[]>([]);
  const [suggestingTasks, setSuggestingTasks] = useState(false);

  // Error
  const [error, setError] = useState<Error | null>(null);

  // Auto-load strategy context from Firestore on mount
  useEffect(() => {
    if (!effectiveCompanyId) return;
    let cancelled = false;
    (async () => {
      try {
        const saved = await loadStrategyContext(effectiveCompanyId);
        if (!cancelled && saved) {
          setStrategyContext(saved);
        }
      } catch (err) {
        console.warn('Failed to load saved strategy:', err);
      } finally {
        if (!cancelled) setStrategyLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [effectiveCompanyId]);

  // Send chat message
  const sendMessage = useCallback(async (content: string) => {
    if (!effectiveCompanyId) return;

    const userMessage: AgentMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setChatLoading(true);
    setError(null);

    try {
      const response = await chatWithAgent(
        content,
        effectiveCompanyId,
        strategyContext,
        [...messages, userMessage]
      );
      setMessages((prev) => [...prev, response]);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to get response'));
      const errorMessage: AgentMessage = {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setChatLoading(false);
    }
  }, [effectiveCompanyId, strategyContext, messages]);

  // Clear chat
  const clearChat = useCallback(() => {
    setMessages([
      {
        id: 'welcome',
        role: 'assistant',
        content: "Chat cleared! How can I help you with your marketing today?",
        timestamp: new Date(),
      },
    ]);
  }, []);

  // Generate content
  const generatePostContent = useCallback(async (
    request: ContentGenerationRequest
  ): Promise<GeneratedContent | null> => {
    if (!effectiveCompanyId) return null;

    setGenerating(true);
    setError(null);

    try {
      const result = await generateContent(
        { ...request, strategyContext },
        effectiveCompanyId
      );
      setGeneratedContent(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Content generation failed'));
      return null;
    } finally {
      setGenerating(false);
    }
  }, [effectiveCompanyId, strategyContext]);

  // Load key dates
  const loadKeyDatesFn = useCallback(async () => {
    if (!effectiveCompanyId) return;

    setDatesLoading(true);
    try {
      const dates = await getKeyDates(effectiveCompanyId);
      setKeyDates(dates);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load key dates'));
    } finally {
      setDatesLoading(false);
    }
  }, [effectiveCompanyId]);

  // Discover new key dates
  const discoverDatesFn = useCallback(async (options?: {
    region?: string;
    country?: string;
    industry?: string;
  }): Promise<MarketingKeyDate[]> => {
    if (!effectiveCompanyId) return [];

    setDatesLoading(true);
    try {
      const dates = await discoverKeyDates(effectiveCompanyId, {
        ...options,
        strategyContext,
      });
      return dates;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to discover dates'));
      return [];
    } finally {
      setDatesLoading(false);
    }
  }, [effectiveCompanyId, strategyContext]);

  // Save key dates
  const saveDatesFn = useCallback(async (dates: MarketingKeyDate[]) => {
    try {
      await saveKeyDates(dates);
      await loadKeyDatesFn();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to save dates'));
    }
  }, [loadKeyDatesFn]);

  // Acknowledge date
  const acknowledgeDtFn = useCallback(async (dateId: string) => {
    try {
      await acknowledgeKeyDate(dateId);
      setKeyDates((prev) =>
        prev.map((d) => (d.id === dateId ? { ...d, acknowledged: true } : d))
      );
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to acknowledge date'));
    }
  }, []);

  // Remove date
  const removeDtFn = useCallback(async (dateId: string) => {
    try {
      await deleteKeyDate(dateId);
      setKeyDates((prev) => prev.filter((d) => d.id !== dateId));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete date'));
    }
  }, []);

  // Analyze strategy document
  const analyzeStrategyFn = useCallback(async (file: File): Promise<StrategyAnalysisResult | null> => {
    setAnalyzingStrategy(true);
    setError(null);

    try {
      const result = await analyzeStrategyDocument(file);
      setStrategyAnalysis(result);
      // Auto-populate strategy context from analysis and persist
      if (result.extractedContext) {
        const merged = { ...strategyContext, ...result.extractedContext };
        setStrategyContext(merged);
        if (effectiveCompanyId) {
          await saveStrategyContext(effectiveCompanyId, merged);
        }
      }
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to analyze strategy document'));
      return null;
    } finally {
      setAnalyzingStrategy(false);
    }
  }, [effectiveCompanyId, strategyContext]);

  // Propose draft campaigns
  const proposeDraftCampaigns = useCallback(async (): Promise<CampaignProposal[]> => {
    if (!effectiveCompanyId) return [];

    setProposingCampaigns(true);
    setError(null);

    try {
      const proposals = await proposeCampaigns(
        effectiveCompanyId,
        strategyContext,
        keyDates
      );
      setCampaignProposals(proposals);
      return proposals;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to propose campaigns'));
      return [];
    } finally {
      setProposingCampaigns(false);
    }
  }, [effectiveCompanyId, strategyContext, keyDates]);

  // Load tasks
  const loadTasksFn = useCallback(async () => {
    if (!effectiveCompanyId) return;
    setTasksLoading(true);
    try {
      const result = await getMarketingTasks(effectiveCompanyId);
      setTasks(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load tasks'));
    } finally {
      setTasksLoading(false);
    }
  }, [effectiveCompanyId]);

  // Suggest tasks via AI
  const suggestTasksFn = useCallback(async (): Promise<AISuggestedTask[]> => {
    if (!effectiveCompanyId) return [];
    setSuggestingTasks(true);
    setError(null);
    try {
      const existing = tasks.map((t) => t.title);
      const suggestions = await suggestTasksFromAI(
        effectiveCompanyId,
        strategyContext,
        keyDates,
        campaignProposals,
        existing
      );
      setSuggestedTasks(suggestions);
      return suggestions;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to suggest tasks'));
      return [];
    } finally {
      setSuggestingTasks(false);
    }
  }, [effectiveCompanyId, strategyContext, keyDates, campaignProposals, tasks]);

  // Accept AI-suggested tasks and save to Firestore
  const acceptSuggestedTasksFn = useCallback(async (toAccept: AISuggestedTask[]) => {
    if (!effectiveCompanyId || !user) return;
    try {
      await createAISuggestedTasks(
        effectiveCompanyId,
        toAccept,
        user.uid,
        user.displayName || 'Unknown'
      );
      setSuggestedTasks([]);
      await loadTasksFn();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to create tasks'));
    }
  }, [effectiveCompanyId, user, loadTasksFn]);

  // Update task status
  const updateTaskStatusFn = useCallback(async (taskId: string, status: MarketingTaskStatus) => {
    try {
      await updateTaskStatusSvc(taskId, status);
      setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status } : t)));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update task'));
    }
  }, []);

  // Delete task
  const removeTaskFn = useCallback(async (taskId: string) => {
    try {
      await deleteMarketingTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete task'));
    }
  }, []);

  // Save strategy
  const saveStrategyFn = useCallback(async (ctx: Partial<StrategyContext>) => {
    if (!effectiveCompanyId) return;
    try {
      await saveStrategyContext(effectiveCompanyId, ctx);
      setStrategyContext(ctx);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to save strategy'));
    }
  }, [effectiveCompanyId]);

  // Load strategy
  const loadStrategyFn = useCallback(async () => {
    if (!effectiveCompanyId) return;
    try {
      const saved = await loadStrategyContext(effectiveCompanyId);
      if (saved) setStrategyContext(saved);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load strategy'));
    } finally {
      setStrategyLoaded(true);
    }
  }, [effectiveCompanyId]);

  // Research strategy
  const researchStrategyFn = useCallback(async (): Promise<StrategyResearchResult | null> => {
    if (!effectiveCompanyId) return null;
    setResearchingStrategy(true);
    setError(null);
    try {
      const result = await researchStrategyUpdate(strategyContext, keyDates);
      setStrategyResearch(result);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to research strategy'));
      return null;
    } finally {
      setResearchingStrategy(false);
    }
  }, [strategyContext, keyDates]);

  // Load config
  const loadConfigFn = useCallback(async () => {
    if (!effectiveCompanyId) return;
    try {
      const result = await getAgentConfig(effectiveCompanyId);
      if (result) {
        setConfig(result);
        setStrategyContext(result.strategyContext);
      }
    } catch (err) {
      console.warn('Failed to load agent config:', err);
    }
  }, [effectiveCompanyId]);

  // Update config
  const updateConfigFn = useCallback(async (newConfig: MarketingAgentConfig) => {
    try {
      await saveAgentConfig(newConfig);
      setConfig(newConfig);
      setStrategyContext(newConfig.strategyContext);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to save config'));
    }
  }, []);

  return {
    messages,
    sendMessage,
    clearChat,
    chatLoading,
    generatedContent,
    generatePostContent,
    generating,
    keyDates,
    loadKeyDates: loadKeyDatesFn,
    discoverDates: discoverDatesFn,
    saveDates: saveDatesFn,
    acknowledgeDt: acknowledgeDtFn,
    removeDt: removeDtFn,
    datesLoading,
    config,
    loadConfig: loadConfigFn,
    updateConfig: updateConfigFn,
    campaignProposals,
    proposeDraftCampaigns,
    proposingCampaigns,
    strategyContext,
    setStrategyContext,
    saveStrategy: saveStrategyFn,
    loadStrategy: loadStrategyFn,
    strategyLoaded,
    analyzeStrategy: analyzeStrategyFn,
    strategyAnalysis,
    analyzingStrategy,
    researchStrategy: researchStrategyFn,
    strategyResearch,
    researchingStrategy,
    tasks,
    tasksLoading,
    suggestedTasks,
    suggestingTasks,
    loadTasks: loadTasksFn,
    suggestTasks: suggestTasksFn,
    acceptSuggestedTasks: acceptSuggestedTasksFn,
    updateTaskStatus: updateTaskStatusFn,
    removeTask: removeTaskFn,
    error,
  };
}
