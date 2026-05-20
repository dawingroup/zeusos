// ============================================================================
// USE COMPETITOR HOOK
// DawinOS v2.0 - Market Intelligence Module
// React hook for Competitor Analysis operations
// ============================================================================

import { useState, useCallback } from 'react';
import {
  competitorService,
  swotService,
  competitiveMoveService,
  winLossService,
  competitorAnalyticsService,
} from '../services/competitorService';
import {
  Competitor,
  SWOTAnalysis,
  CompetitiveMove,
  WinLossRecord,
  CompetitorAnalytics,
  CompetitorFormInput,
  SWOTFormInput,
  CompetitiveMoveFormInput,
  WinLossFormInput,
  CompetitorFilters,
  MoveFilters,
  WinLossFilters,
} from '../types/competitor.types';
import { ThreatLevel } from '../constants/competitor.constants';

interface UseCompetitorState {
  competitors: Competitor[];
  selectedCompetitor: Competitor | null;
  swotAnalyses: SWOTAnalysis[];
  competitiveMoves: CompetitiveMove[];
  winLossRecords: WinLossRecord[];
  analytics: CompetitorAnalytics | null;
  isLoading: boolean;
  error: string | null;
}

interface UseCompetitorReturn extends UseCompetitorState {
  // Competitor operations
  loadCompetitors: (filters?: CompetitorFilters) => Promise<void>;
  loadCompetitor: (id: string) => Promise<void>;
  createCompetitor: (input: CompetitorFormInput, userId: string) => Promise<string>;
  updateCompetitor: (id: string, updates: Partial<CompetitorFormInput>) => Promise<void>;
  deleteCompetitor: (id: string) => Promise<void>;
  searchCompetitors: (term: string) => Promise<Competitor[]>;
  updateThreatLevel: (id: string, level: ThreatLevel, reason: string, userId: string) => Promise<void>;
  
  // SWOT operations
  loadSWOTAnalyses: (competitorId: string) => Promise<void>;
  createSWOT: (input: SWOTFormInput, userId: string) => Promise<string>;
  approveSWOT: (id: string, userId: string) => Promise<void>;
  
  // Competitive move operations
  loadMoves: (filters?: MoveFilters) => Promise<void>;
  createMove: (input: CompetitiveMoveFormInput, userId: string) => Promise<string>;
  updateMoveStatus: (id: string, status: CompetitiveMove['status'], response?: string) => Promise<void>;
  
  // Win/Loss operations
  loadWinLossRecords: (filters?: WinLossFilters) => Promise<void>;
  createWinLossRecord: (input: WinLossFormInput, userId: string) => Promise<string>;
  
  // Analytics
  loadAnalytics: (periodDays?: number) => Promise<void>;
  
  // Utilities
  clearError: () => void;
  clearSelection: () => void;
  setSelectedCompetitor: (competitor: Competitor | null) => void;
}

export function useCompetitor(): UseCompetitorReturn {
  const [state, setState] = useState<UseCompetitorState>({
    competitors: [],
    selectedCompetitor: null,
    swotAnalyses: [],
    competitiveMoves: [],
    winLossRecords: [],
    analytics: null,
    isLoading: false,
    error: null,
  });
  
  const setLoading = (isLoading: boolean) => {
    setState(prev => ({ ...prev, isLoading }));
  };
  
  const setError = (error: string | null) => {
    setState(prev => ({ ...prev, error, isLoading: false }));
  };
  
  // --------------------------------------------------------------------------
  // COMPETITOR OPERATIONS
  // --------------------------------------------------------------------------
  
  const loadCompetitors = useCallback(async (filters?: CompetitorFilters) => {
    setLoading(true);
    try {
      const competitors = await competitorService.getCompetitors(filters);
      setState(prev => ({ ...prev, competitors, isLoading: false }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load competitors');
    }
  }, []);
  
  const loadCompetitor = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const competitor = await competitorService.getCompetitor(id);
      setState(prev => ({ ...prev, selectedCompetitor: competitor, isLoading: false }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load competitor');
    }
  }, []);
  
  const createCompetitor = useCallback(async (
    input: CompetitorFormInput,
    userId: string
  ): Promise<string> => {
    setLoading(true);
    try {
      const id = await competitorService.createCompetitor(input, userId);
      const competitors = await competitorService.getCompetitors();
      setState(prev => ({ ...prev, competitors, isLoading: false }));
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create competitor');
      throw err;
    }
  }, []);
  
  const updateCompetitor = useCallback(async (
    id: string,
    updates: Partial<CompetitorFormInput>
  ) => {
    setLoading(true);
    try {
      await competitorService.updateCompetitor(id, updates);
      const competitors = await competitorService.getCompetitors();
      setState(prev => ({ ...prev, competitors, isLoading: false }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update competitor');
      throw err;
    }
  }, []);
  
  const deleteCompetitor = useCallback(async (id: string) => {
    setLoading(true);
    try {
      await competitorService.deleteCompetitor(id);
      setState(prev => ({
        ...prev,
        competitors: prev.competitors.filter(c => c.id !== id),
        selectedCompetitor: prev.selectedCompetitor?.id === id ? null : prev.selectedCompetitor,
        isLoading: false,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete competitor');
      throw err;
    }
  }, []);
  
  const searchCompetitors = useCallback(async (term: string): Promise<Competitor[]> => {
    try {
      return await competitorService.searchCompetitors(term);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      return [];
    }
  }, []);
  
  const updateThreatLevel = useCallback(async (
    id: string,
    level: ThreatLevel,
    reason: string,
    userId: string
  ) => {
    setLoading(true);
    try {
      await competitorService.updateThreatLevel(id, level, reason, userId);
      const competitors = await competitorService.getCompetitors();
      setState(prev => ({ ...prev, competitors, isLoading: false }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update threat level');
      throw err;
    }
  }, []);
  
  // --------------------------------------------------------------------------
  // SWOT OPERATIONS
  // --------------------------------------------------------------------------
  
  const loadSWOTAnalyses = useCallback(async (competitorId: string) => {
    setLoading(true);
    try {
      const analyses = await swotService.getSWOTAnalyses(competitorId);
      setState(prev => ({ ...prev, swotAnalyses: analyses, isLoading: false }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load SWOT analyses');
    }
  }, []);
  
  const createSWOT = useCallback(async (
    input: SWOTFormInput,
    userId: string
  ): Promise<string> => {
    setLoading(true);
    try {
      const id = await swotService.createSWOTAnalysis(input, userId);
      const analyses = await swotService.getSWOTAnalyses(input.competitorId);
      setState(prev => ({ ...prev, swotAnalyses: analyses, isLoading: false }));
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create SWOT analysis');
      throw err;
    }
  }, []);
  
  const approveSWOT = useCallback(async (id: string, userId: string) => {
    setLoading(true);
    try {
      await swotService.approveSWOT(id, userId);
      const analysis = await swotService.getSWOTAnalysis(id);
      if (analysis) {
        const analyses = await swotService.getSWOTAnalyses(analysis.competitorId);
        setState(prev => ({ ...prev, swotAnalyses: analyses, isLoading: false }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve SWOT');
      throw err;
    }
  }, []);
  
  // --------------------------------------------------------------------------
  // COMPETITIVE MOVE OPERATIONS
  // --------------------------------------------------------------------------
  
  const loadMoves = useCallback(async (filters?: MoveFilters) => {
    setLoading(true);
    try {
      const moves = await competitiveMoveService.getMoves(filters);
      setState(prev => ({ ...prev, competitiveMoves: moves, isLoading: false }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load competitive moves');
    }
  }, []);
  
  const createMove = useCallback(async (
    input: CompetitiveMoveFormInput,
    userId: string
  ): Promise<string> => {
    setLoading(true);
    try {
      const id = await competitiveMoveService.createMove(input, userId);
      const moves = await competitiveMoveService.getMoves();
      setState(prev => ({ ...prev, competitiveMoves: moves, isLoading: false }));
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create competitive move');
      throw err;
    }
  }, []);
  
  const updateMoveStatus = useCallback(async (
    id: string,
    status: CompetitiveMove['status'],
    response?: string
  ) => {
    setLoading(true);
    try {
      await competitiveMoveService.updateMoveStatus(id, status, response);
      const moves = await competitiveMoveService.getMoves();
      setState(prev => ({ ...prev, competitiveMoves: moves, isLoading: false }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update move status');
      throw err;
    }
  }, []);
  
  // --------------------------------------------------------------------------
  // WIN/LOSS OPERATIONS
  // --------------------------------------------------------------------------
  
  const loadWinLossRecords = useCallback(async (filters?: WinLossFilters) => {
    setLoading(true);
    try {
      const records = await winLossService.getRecords(filters);
      setState(prev => ({ ...prev, winLossRecords: records, isLoading: false }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load win/loss records');
    }
  }, []);
  
  const createWinLossRecord = useCallback(async (
    input: WinLossFormInput,
    userId: string
  ): Promise<string> => {
    setLoading(true);
    try {
      const id = await winLossService.createRecord(input, userId);
      const records = await winLossService.getRecords();
      setState(prev => ({ ...prev, winLossRecords: records, isLoading: false }));
      return id;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create win/loss record');
      throw err;
    }
  }, []);
  
  // --------------------------------------------------------------------------
  // ANALYTICS
  // --------------------------------------------------------------------------
  
  const loadAnalytics = useCallback(async (periodDays = 90) => {
    setLoading(true);
    try {
      const analytics = await competitorAnalyticsService.getAnalytics(periodDays);
      setState(prev => ({ ...prev, analytics, isLoading: false }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    }
  }, []);
  
  // --------------------------------------------------------------------------
  // UTILITIES
  // --------------------------------------------------------------------------
  
  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }));
  }, []);
  
  const clearSelection = useCallback(() => {
    setState(prev => ({ ...prev, selectedCompetitor: null }));
  }, []);
  
  const setSelectedCompetitor = useCallback((competitor: Competitor | null) => {
    setState(prev => ({ ...prev, selectedCompetitor: competitor }));
  }, []);
  
  return {
    ...state,
    loadCompetitors,
    loadCompetitor,
    createCompetitor,
    updateCompetitor,
    deleteCompetitor,
    searchCompetitors,
    updateThreatLevel,
    loadSWOTAnalyses,
    createSWOT,
    approveSWOT,
    loadMoves,
    createMove,
    updateMoveStatus,
    loadWinLossRecords,
    createWinLossRecord,
    loadAnalytics,
    clearError,
    clearSelection,
    setSelectedCompetitor,
  };
}
