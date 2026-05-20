// ============================================================================
// MARKET RESEARCH HOOK
// DawinOS v2.0 - Market Intelligence Module
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  IndustryTrend,
  PESTLEFactor,
  PESTLEAnalysis,
  ResearchReport,
  MarketIndicatorValue,
  ResearchSource,
  MarketResearchSummary,
  TrendFilters,
  ResearchReportFilters,
} from '../types/research.types';
import {
  createTrend,
  getTrend,
  getTrends,
  updateTrend,
  deleteTrend,
  createPESTLEFactor,
  getPESTLEFactors,
  updatePESTLEFactor,
  deletePESTLEFactor,
  generatePESTLEAnalysis,
  createResearchReport,
  getResearchReport,
  getResearchReports,
  updateResearchReport,
  updateResearchReportStatus,
  deleteResearchReport,
  recordIndicator,
  getIndicators,
  getLatestIndicators,
  deleteIndicator,
  createResearchSource,
  getResearchSources,
  updateResearchSource,
  recordSourceUsage,
  deleteResearchSource,
  getMarketResearchSummary,
} from '../services/researchService';
import {
  IndustryTrendInput,
  IndustryTrendUpdate,
  PESTLEFactorInput,
  PESTLEFactorUpdate,
  ResearchReportInput,
  MarketIndicatorInput,
  ResearchSourceInput,
} from '../schemas/research.schemas';
import { ResearchReportStatus } from '../constants/research.constants';
import { PESTLECategory } from '../constants/market.constants';
import { useAuth } from '@/core/hooks/useAuth';

// ============================================================================
// TYPES
// ============================================================================

interface UseMarketResearchOptions {
  companyId: string;
  autoLoad?: boolean;
}

interface UseMarketResearchReturn {
  // Data
  trends: IndustryTrend[];
  currentTrend: IndustryTrend | null;
  pestleFactors: PESTLEFactor[];
  pestleAnalysis: PESTLEAnalysis | null;
  reports: ResearchReport[];
  currentReport: ResearchReport | null;
  indicators: MarketIndicatorValue[];
  sources: ResearchSource[];
  summary: MarketResearchSummary | null;
  
  // State
  isLoading: boolean;
  error: string | null;
  
  // Trend Operations
  loadTrends: (filters?: TrendFilters) => Promise<void>;
  loadTrendById: (trendId: string) => Promise<IndustryTrend | null>;
  addTrend: (input: IndustryTrendInput) => Promise<IndustryTrend | null>;
  editTrend: (trendId: string, updates: IndustryTrendUpdate) => Promise<boolean>;
  removeTrend: (trendId: string) => Promise<boolean>;
  setCurrentTrend: (trend: IndustryTrend | null) => void;
  
  // PESTLE Operations
  loadPESTLEFactors: (category?: PESTLECategory) => Promise<void>;
  addPESTLEFactor: (input: PESTLEFactorInput) => Promise<PESTLEFactor | null>;
  editPESTLEFactor: (factorId: string, updates: PESTLEFactorUpdate) => Promise<boolean>;
  removePESTLEFactor: (factorId: string) => Promise<boolean>;
  generatePESTLE: (title: string) => Promise<PESTLEAnalysis | null>;
  
  // Report Operations
  loadReports: (filters?: ResearchReportFilters) => Promise<void>;
  loadReportById: (reportId: string) => Promise<ResearchReport | null>;
  addReport: (input: ResearchReportInput) => Promise<ResearchReport | null>;
  editReport: (reportId: string, updates: Partial<ResearchReportInput>) => Promise<boolean>;
  changeReportStatus: (reportId: string, status: ResearchReportStatus) => Promise<boolean>;
  removeReport: (reportId: string) => Promise<boolean>;
  setCurrentReport: (report: ResearchReport | null) => void;
  
  // Indicator Operations
  loadIndicators: (indicatorId?: string) => Promise<void>;
  addIndicator: (input: MarketIndicatorInput) => Promise<MarketIndicatorValue | null>;
  removeIndicator: (indicatorId: string) => Promise<boolean>;
  
  // Source Operations
  loadSources: () => Promise<void>;
  addSource: (input: ResearchSourceInput) => Promise<ResearchSource | null>;
  editSource: (sourceId: string, updates: Partial<ResearchSourceInput>) => Promise<boolean>;
  trackSourceUsage: (sourceId: string) => Promise<void>;
  removeSource: (sourceId: string) => Promise<boolean>;
  
  // Summary
  loadSummary: () => Promise<void>;
  
  // Utility
  clearError: () => void;
}

// ============================================================================
// HOOK
// ============================================================================

export const useMarketResearch = ({
  companyId,
  autoLoad = true,
}: UseMarketResearchOptions): UseMarketResearchReturn => {
  const { user } = useAuth();
  
  // Data State
  const [trends, setTrends] = useState<IndustryTrend[]>([]);
  const [currentTrend, setCurrentTrend] = useState<IndustryTrend | null>(null);
  const [pestleFactors, setPESTLEFactors] = useState<PESTLEFactor[]>([]);
  const [pestleAnalysis, setPESTLEAnalysis] = useState<PESTLEAnalysis | null>(null);
  const [reports, setReports] = useState<ResearchReport[]>([]);
  const [currentReport, setCurrentReport] = useState<ResearchReport | null>(null);
  const [indicators, setIndicators] = useState<MarketIndicatorValue[]>([]);
  const [sources, setSources] = useState<ResearchSource[]>([]);
  const [summary, setSummary] = useState<MarketResearchSummary | null>(null);
  
  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => setError(null), []);

  // =========================================================================
  // TREND OPERATIONS
  // =========================================================================

  const loadTrends = useCallback(async (filters?: TrendFilters) => {
    if (!companyId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getTrends(companyId, filters);
      setTrends(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trends');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  const loadTrendById = useCallback(async (trendId: string): Promise<IndustryTrend | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getTrend(trendId);
      if (data) setCurrentTrend(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load trend');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addTrend = useCallback(async (input: IndustryTrendInput): Promise<IndustryTrend | null> => {
    if (!user || !companyId) return null;
    setError(null);
    try {
      const trend = await createTrend(companyId, input, user.uid);
      setTrends(prev => [trend, ...prev]);
      return trend;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create trend');
      return null;
    }
  }, [companyId, user]);

  const editTrend = useCallback(async (trendId: string, updates: IndustryTrendUpdate): Promise<boolean> => {
    setError(null);
    try {
      await updateTrend(trendId, updates);
      setTrends(prev => prev.map(t => t.id === trendId ? { ...t, ...updates } : t));
      if (currentTrend?.id === trendId) {
        setCurrentTrend(prev => prev ? { ...prev, ...updates } : null);
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update trend');
      return false;
    }
  }, [currentTrend?.id]);

  const removeTrend = useCallback(async (trendId: string): Promise<boolean> => {
    setError(null);
    try {
      await deleteTrend(trendId);
      setTrends(prev => prev.filter(t => t.id !== trendId));
      if (currentTrend?.id === trendId) setCurrentTrend(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete trend');
      return false;
    }
  }, [currentTrend?.id]);

  // =========================================================================
  // PESTLE OPERATIONS
  // =========================================================================

  const loadPESTLEFactors = useCallback(async (category?: PESTLECategory) => {
    if (!companyId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getPESTLEFactors(companyId, category);
      setPESTLEFactors(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load PESTLE factors');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  const addPESTLEFactor = useCallback(async (input: PESTLEFactorInput): Promise<PESTLEFactor | null> => {
    if (!user || !companyId) return null;
    setError(null);
    try {
      const factor = await createPESTLEFactor(companyId, input, user.uid);
      setPESTLEFactors(prev => [factor, ...prev]);
      return factor;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create PESTLE factor');
      return null;
    }
  }, [companyId, user]);

  const editPESTLEFactor = useCallback(async (factorId: string, updates: PESTLEFactorUpdate): Promise<boolean> => {
    setError(null);
    try {
      await updatePESTLEFactor(factorId, updates);
      setPESTLEFactors(prev => prev.map(f => f.id === factorId ? { ...f, ...updates } : f));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update PESTLE factor');
      return false;
    }
  }, []);

  const removePESTLEFactor = useCallback(async (factorId: string): Promise<boolean> => {
    setError(null);
    try {
      await deletePESTLEFactor(factorId);
      setPESTLEFactors(prev => prev.filter(f => f.id !== factorId));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete PESTLE factor');
      return false;
    }
  }, []);

  const generatePESTLE = useCallback(async (title: string): Promise<PESTLEAnalysis | null> => {
    if (!user || !companyId) return null;
    setIsLoading(true);
    setError(null);
    try {
      const analysis = await generatePESTLEAnalysis(companyId, title, user.uid);
      setPESTLEAnalysis(analysis);
      return analysis;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate PESTLE analysis');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [companyId, user]);

  // =========================================================================
  // REPORT OPERATIONS
  // =========================================================================

  const loadReports = useCallback(async (filters?: ResearchReportFilters) => {
    if (!companyId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = await getResearchReports(companyId, filters);
      setReports(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  const loadReportById = useCallback(async (reportId: string): Promise<ResearchReport | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getResearchReport(reportId);
      if (data) setCurrentReport(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load report');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const addReport = useCallback(async (input: ResearchReportInput): Promise<ResearchReport | null> => {
    if (!user || !companyId) return null;
    setError(null);
    try {
      const report = await createResearchReport(companyId, input, user.uid);
      setReports(prev => [report, ...prev]);
      return report;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create report');
      return null;
    }
  }, [companyId, user]);

  const editReport = useCallback(async (reportId: string, updates: Partial<ResearchReportInput>): Promise<boolean> => {
    setError(null);
    try {
      await updateResearchReport(reportId, updates);
      // Reload to get updated data with proper structure
      await loadReports();
      if (currentReport?.id === reportId) {
        const updated = await getResearchReport(reportId);
        setCurrentReport(updated);
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update report');
      return false;
    }
  }, [currentReport?.id, loadReports]);

  const changeReportStatus = useCallback(async (reportId: string, status: ResearchReportStatus): Promise<boolean> => {
    setError(null);
    try {
      await updateResearchReportStatus(reportId, status, user?.uid);
      setReports(prev => prev.map(r => r.id === reportId ? { ...r, status } : r));
      if (currentReport?.id === reportId) {
        setCurrentReport(prev => prev ? { ...prev, status } : null);
      }
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update report status');
      return false;
    }
  }, [currentReport?.id, user?.uid]);

  const removeReport = useCallback(async (reportId: string): Promise<boolean> => {
    setError(null);
    try {
      await deleteResearchReport(reportId);
      setReports(prev => prev.filter(r => r.id !== reportId));
      if (currentReport?.id === reportId) setCurrentReport(null);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete report');
      return false;
    }
  }, [currentReport?.id]);

  // =========================================================================
  // INDICATOR OPERATIONS
  // =========================================================================

  const loadIndicators = useCallback(async (indicatorId?: string) => {
    if (!companyId) return;
    setIsLoading(true);
    setError(null);
    try {
      const data = indicatorId
        ? await getIndicators(companyId, indicatorId)
        : await getLatestIndicators(companyId);
      setIndicators(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load indicators');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  const addIndicator = useCallback(async (input: MarketIndicatorInput): Promise<MarketIndicatorValue | null> => {
    if (!user || !companyId) return null;
    setError(null);
    try {
      const indicator = await recordIndicator(companyId, input, user.uid);
      setIndicators(prev => [indicator, ...prev]);
      return indicator;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record indicator');
      return null;
    }
  }, [companyId, user]);

  const removeIndicator = useCallback(async (indicatorId: string): Promise<boolean> => {
    setError(null);
    try {
      await deleteIndicator(indicatorId);
      setIndicators(prev => prev.filter(i => i.id !== indicatorId));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete indicator');
      return false;
    }
  }, []);

  // =========================================================================
  // SOURCE OPERATIONS
  // =========================================================================

  const loadSources = useCallback(async () => {
    if (!companyId) return;
    setError(null);
    try {
      const data = await getResearchSources(companyId);
      setSources(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sources');
    }
  }, [companyId]);

  const addSource = useCallback(async (input: ResearchSourceInput): Promise<ResearchSource | null> => {
    if (!user || !companyId) return null;
    setError(null);
    try {
      const source = await createResearchSource(companyId, input, user.uid);
      setSources(prev => [source, ...prev]);
      return source;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create source');
      return null;
    }
  }, [companyId, user]);

  const editSource = useCallback(async (sourceId: string, updates: Partial<ResearchSourceInput>): Promise<boolean> => {
    setError(null);
    try {
      await updateResearchSource(sourceId, updates);
      setSources(prev => prev.map(s => s.id === sourceId ? { ...s, ...updates } : s));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update source');
      return false;
    }
  }, []);

  const trackSourceUsage = useCallback(async (sourceId: string): Promise<void> => {
    try {
      await recordSourceUsage(sourceId);
      setSources(prev => prev.map(s => 
        s.id === sourceId 
          ? { ...s, usageCount: s.usageCount + 1, lastAccessed: new Date() }
          : s
      ));
    } catch (err) {
      console.error('Failed to track source usage:', err);
    }
  }, []);

  const removeSource = useCallback(async (sourceId: string): Promise<boolean> => {
    setError(null);
    try {
      await deleteResearchSource(sourceId);
      setSources(prev => prev.filter(s => s.id !== sourceId));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete source');
      return false;
    }
  }, []);

  // =========================================================================
  // SUMMARY
  // =========================================================================

  const loadSummary = useCallback(async () => {
    if (!companyId) return;
    setError(null);
    try {
      const data = await getMarketResearchSummary(companyId);
      setSummary(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load summary');
    }
  }, [companyId]);

  // =========================================================================
  // AUTO-LOAD
  // =========================================================================

  useEffect(() => {
    if (autoLoad && companyId) {
      loadTrends();
      loadPESTLEFactors();
      loadReports();
      loadIndicators();
      loadSources();
      loadSummary();
    }
  }, [autoLoad, companyId, loadTrends, loadPESTLEFactors, loadReports, loadIndicators, loadSources, loadSummary]);

  // =========================================================================
  // RETURN
  // =========================================================================

  return {
    // Data
    trends,
    currentTrend,
    pestleFactors,
    pestleAnalysis,
    reports,
    currentReport,
    indicators,
    sources,
    summary,
    
    // State
    isLoading,
    error,
    
    // Trend Operations
    loadTrends,
    loadTrendById,
    addTrend,
    editTrend,
    removeTrend,
    setCurrentTrend,
    
    // PESTLE Operations
    loadPESTLEFactors,
    addPESTLEFactor,
    editPESTLEFactor,
    removePESTLEFactor,
    generatePESTLE,
    
    // Report Operations
    loadReports,
    loadReportById,
    addReport,
    editReport,
    changeReportStatus,
    removeReport,
    setCurrentReport,
    
    // Indicator Operations
    loadIndicators,
    addIndicator,
    removeIndicator,
    
    // Source Operations
    loadSources,
    addSource,
    editSource,
    trackSourceUsage,
    removeSource,
    
    // Summary
    loadSummary,
    
    // Utility
    clearError,
  };
};
