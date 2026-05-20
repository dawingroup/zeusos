// ============================================================================
// MARKET INTELLIGENCE HOOK
// DawinOS v2.0 - Market Intelligence Module
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  Competitor,
  MarketSignal,
  IntelligenceItem,
  SWOTAnalysis,
  MarketIntelligenceSummary,
  CompetitorFilters,
  SignalFilters,
  IntelligenceFilters,
} from '../types/market.types';
import {
  createCompetitor,
  getCompetitor,
  getCompetitors,
  updateCompetitor,
  deleteCompetitor,
  createMarketSignal,
  getMarketSignals,
  updateMarketSignal,
  markSignalActioned,
  deleteMarketSignal,
  createIntelligenceItem,
  getIntelligenceItems,
  updateIntelligenceItem,
  deleteIntelligenceItem,
  createSWOTAnalysis,
  getSWOTAnalyses,
  updateSWOTAnalysis,
  deleteSWOTAnalysis,
  getMarketIntelligenceSummary,
  getActionableSignals,
} from '../services/marketService';
import {
  CompetitorInput,
  CompetitorUpdate,
  MarketSignalInput,
  IntelligenceItemInput,
  SWOTAnalysisInput,
} from '../schemas/market.schemas';
import { useAuth } from '@/core/hooks/useAuth';

// ============================================================================
// TYPES
// ============================================================================

interface UseMarketIntelligenceOptions {
  companyId: string;
  autoLoad?: boolean;
}

interface UseMarketIntelligenceReturn {
  // Data
  competitors: Competitor[];
  currentCompetitor: Competitor | null;
  signals: MarketSignal[];
  actionableSignals: MarketSignal[];
  intelligenceItems: IntelligenceItem[];
  swotAnalyses: SWOTAnalysis[];
  summary: MarketIntelligenceSummary | null;
  
  // State
  isLoading: boolean;
  error: string | null;
  
  // Competitor Actions
  loadCompetitors: (filters?: CompetitorFilters) => Promise<void>;
  loadCompetitor: (competitorId: string) => Promise<Competitor | null>;
  addCompetitor: (input: CompetitorInput) => Promise<Competitor | null>;
  editCompetitor: (competitorId: string, updates: CompetitorUpdate) => Promise<boolean>;
  removeCompetitor: (competitorId: string) => Promise<boolean>;
  
  // Signal Actions
  loadSignals: (filters?: SignalFilters) => Promise<void>;
  loadActionableSignals: () => Promise<void>;
  addSignal: (input: MarketSignalInput) => Promise<MarketSignal | null>;
  editSignal: (signalId: string, updates: Partial<MarketSignalInput>) => Promise<boolean>;
  actionSignal: (signalId: string, actionTaken: string) => Promise<boolean>;
  removeSignal: (signalId: string) => Promise<boolean>;
  
  // Intelligence Actions
  loadIntelligence: (filters?: IntelligenceFilters) => Promise<void>;
  addIntelligence: (input: IntelligenceItemInput) => Promise<IntelligenceItem | null>;
  editIntelligence: (itemId: string, updates: Partial<IntelligenceItemInput>) => Promise<boolean>;
  removeIntelligence: (itemId: string) => Promise<boolean>;
  
  // SWOT Actions
  loadSWOTAnalyses: (targetId?: string) => Promise<void>;
  addSWOTAnalysis: (input: SWOTAnalysisInput) => Promise<SWOTAnalysis | null>;
  editSWOTAnalysis: (swotId: string, updates: Partial<SWOTAnalysisInput>) => Promise<boolean>;
  removeSWOTAnalysis: (swotId: string) => Promise<boolean>;
  
  // Summary
  loadSummary: () => Promise<void>;
  
  // Utility
  clearError: () => void;
  setCurrentCompetitor: (competitor: Competitor | null) => void;
}

// ============================================================================
// HOOK
// ============================================================================

export const useMarketIntelligence = ({
  companyId,
  autoLoad = true,
}: UseMarketIntelligenceOptions): UseMarketIntelligenceReturn => {
  const { user } = useAuth();
  
  // Data State
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [currentCompetitor, setCurrentCompetitor] = useState<Competitor | null>(null);
  const [signals, setSignals] = useState<MarketSignal[]>([]);
  const [actionableSignals, setActionableSignals] = useState<MarketSignal[]>([]);
  const [intelligenceItems, setIntelligenceItems] = useState<IntelligenceItem[]>([]);
  const [swotAnalyses, setSWOTAnalyses] = useState<SWOTAnalysis[]>([]);
  const [summary, setSummary] = useState<MarketIntelligenceSummary | null>(null);
  
  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  // -------------------------------------------------------------------------
  // COMPETITOR ACTIONS
  // -------------------------------------------------------------------------

  const loadCompetitors = useCallback(async (filters?: CompetitorFilters) => {
    if (!companyId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getCompetitors(companyId, filters);
      setCompetitors(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load competitors');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  const loadCompetitor = useCallback(async (competitorId: string): Promise<Competitor | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const competitor = await getCompetitor(competitorId);
      if (competitor) {
        setCurrentCompetitor(competitor);
      }
      return competitor;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load competitor');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addCompetitor = useCallback(async (input: CompetitorInput): Promise<Competitor | null> => {
    if (!user || !companyId) return null;
    setError(null);
    try {
      const competitor = await createCompetitor(companyId, input, user.uid);
      setCompetitors(prev => [competitor, ...prev]);
      return competitor;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create competitor');
      return null;
    }
  }, [companyId, user]);

  const editCompetitor = useCallback(async (competitorId: string, updates: CompetitorUpdate): Promise<boolean> => {
    setError(null);
    try {
      await updateCompetitor(competitorId, updates);
      setCompetitors(prev => prev.map(c => 
        c.id === competitorId ? { ...c, ...updates } : c
      ));
      if (currentCompetitor?.id === competitorId) {
        setCurrentCompetitor(prev => prev ? { ...prev, ...updates } : null);
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update competitor');
      return false;
    }
  }, [currentCompetitor?.id]);

  const removeCompetitor = useCallback(async (competitorId: string): Promise<boolean> => {
    setError(null);
    try {
      await deleteCompetitor(competitorId);
      setCompetitors(prev => prev.filter(c => c.id !== competitorId));
      if (currentCompetitor?.id === competitorId) {
        setCurrentCompetitor(null);
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete competitor');
      return false;
    }
  }, [currentCompetitor?.id]);

  // -------------------------------------------------------------------------
  // SIGNAL ACTIONS
  // -------------------------------------------------------------------------

  const loadSignals = useCallback(async (filters?: SignalFilters) => {
    if (!companyId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getMarketSignals(companyId, filters);
      setSignals(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load signals');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  const loadActionableSignals = useCallback(async () => {
    if (!companyId) return;
    try {
      const data = await getActionableSignals(companyId);
      setActionableSignals(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load actionable signals');
    }
  }, [companyId]);

  const addSignal = useCallback(async (input: MarketSignalInput): Promise<MarketSignal | null> => {
    if (!user || !companyId) return null;
    setError(null);
    try {
      const signal = await createMarketSignal(companyId, input, user.uid, user.displayName || 'User');
      setSignals(prev => [signal, ...prev]);
      if (input.requiresAction) {
        setActionableSignals(prev => [signal, ...prev]);
      }
      return signal;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create signal');
      return null;
    }
  }, [companyId, user]);

  const editSignal = useCallback(async (signalId: string, updates: Partial<MarketSignalInput>): Promise<boolean> => {
    setError(null);
    try {
      await updateMarketSignal(signalId, updates);
      setSignals(prev => prev.map(s => 
        s.id === signalId ? { ...s, ...updates } : s
      ));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update signal');
      return false;
    }
  }, []);

  const actionSignal = useCallback(async (signalId: string, actionTaken: string): Promise<boolean> => {
    setError(null);
    try {
      await markSignalActioned(signalId, actionTaken);
      setSignals(prev => prev.map(s => 
        s.id === signalId ? { ...s, actionTaken, actionDate: new Date(), requiresAction: false } : s
      ));
      setActionableSignals(prev => prev.filter(s => s.id !== signalId));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark signal as actioned');
      return false;
    }
  }, []);

  const removeSignal = useCallback(async (signalId: string): Promise<boolean> => {
    setError(null);
    try {
      await deleteMarketSignal(signalId);
      setSignals(prev => prev.filter(s => s.id !== signalId));
      setActionableSignals(prev => prev.filter(s => s.id !== signalId));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete signal');
      return false;
    }
  }, []);

  // -------------------------------------------------------------------------
  // INTELLIGENCE ACTIONS
  // -------------------------------------------------------------------------

  const loadIntelligence = useCallback(async (filters?: IntelligenceFilters) => {
    if (!companyId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getIntelligenceItems(companyId, filters);
      setIntelligenceItems(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load intelligence items');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  const addIntelligence = useCallback(async (input: IntelligenceItemInput): Promise<IntelligenceItem | null> => {
    if (!user || !companyId) return null;
    setError(null);
    try {
      const item = await createIntelligenceItem(companyId, input, user.uid);
      setIntelligenceItems(prev => [item, ...prev]);
      return item;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create intelligence item');
      return null;
    }
  }, [companyId, user]);

  const editIntelligence = useCallback(async (itemId: string, updates: Partial<IntelligenceItemInput>): Promise<boolean> => {
    setError(null);
    try {
      await updateIntelligenceItem(itemId, updates);
      setIntelligenceItems(prev => prev.map(i => 
        i.id === itemId ? { ...i, ...updates } : i
      ));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update intelligence item');
      return false;
    }
  }, []);

  const removeIntelligence = useCallback(async (itemId: string): Promise<boolean> => {
    setError(null);
    try {
      await deleteIntelligenceItem(itemId);
      setIntelligenceItems(prev => prev.filter(i => i.id !== itemId));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete intelligence item');
      return false;
    }
  }, []);

  // -------------------------------------------------------------------------
  // SWOT ACTIONS
  // -------------------------------------------------------------------------

  const loadSWOTAnalyses = useCallback(async (targetId?: string) => {
    if (!companyId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getSWOTAnalyses(companyId, targetId);
      setSWOTAnalyses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load SWOT analyses');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  const addSWOTAnalysis = useCallback(async (input: SWOTAnalysisInput): Promise<SWOTAnalysis | null> => {
    if (!user || !companyId) return null;
    setError(null);
    try {
      const swot = await createSWOTAnalysis(companyId, input, user.uid);
      setSWOTAnalyses(prev => [swot, ...prev]);
      return swot;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create SWOT analysis');
      return null;
    }
  }, [companyId, user]);

  const editSWOTAnalysis = useCallback(async (swotId: string, updates: Partial<SWOTAnalysisInput>): Promise<boolean> => {
    setError(null);
    try {
      await updateSWOTAnalysis(swotId, updates);
      // Reload to get the updated data with proper IDs
      await loadSWOTAnalyses();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update SWOT analysis');
      return false;
    }
  }, [loadSWOTAnalyses]);

  const removeSWOTAnalysis = useCallback(async (swotId: string): Promise<boolean> => {
    setError(null);
    try {
      await deleteSWOTAnalysis(swotId);
      setSWOTAnalyses(prev => prev.filter(s => s.id !== swotId));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete SWOT analysis');
      return false;
    }
  }, []);

  // -------------------------------------------------------------------------
  // SUMMARY
  // -------------------------------------------------------------------------

  const loadSummary = useCallback(async () => {
    if (!companyId) return;
    try {
      const data = await getMarketIntelligenceSummary(companyId);
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load summary');
    }
  }, [companyId]);

  // -------------------------------------------------------------------------
  // AUTO-LOAD
  // -------------------------------------------------------------------------

  useEffect(() => {
    if (autoLoad && companyId) {
      loadCompetitors();
      loadSignals();
      loadActionableSignals();
      loadSummary();
    }
  }, [autoLoad, companyId, loadCompetitors, loadSignals, loadActionableSignals, loadSummary]);

  // -------------------------------------------------------------------------
  // RETURN
  // -------------------------------------------------------------------------

  return {
    // Data
    competitors,
    currentCompetitor,
    signals,
    actionableSignals,
    intelligenceItems,
    swotAnalyses,
    summary,
    
    // State
    isLoading,
    error,
    
    // Competitor Actions
    loadCompetitors,
    loadCompetitor,
    addCompetitor,
    editCompetitor,
    removeCompetitor,
    
    // Signal Actions
    loadSignals,
    loadActionableSignals,
    addSignal,
    editSignal,
    actionSignal,
    removeSignal,
    
    // Intelligence Actions
    loadIntelligence,
    addIntelligence,
    editIntelligence,
    removeIntelligence,
    
    // SWOT Actions
    loadSWOTAnalyses,
    addSWOTAnalysis,
    editSWOTAnalysis,
    removeSWOTAnalysis,
    
    // Summary
    loadSummary,
    
    // Utility
    clearError,
    setCurrentCompetitor,
  };
};
