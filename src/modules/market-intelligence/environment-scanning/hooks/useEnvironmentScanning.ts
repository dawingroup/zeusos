// ============================================================================
// ENVIRONMENT SCANNING HOOK
// DawinOS v2.0 - Market Intelligence Module
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import {
  PESTELAnalysis,
  PESTELFactor,
  EnvironmentSignal,
  RegulatoryItem,
  Scenario,
  EarlyWarningAlert,
  AlertTrigger,
  TrackedIndicator,
  EnvironmentScanningAnalytics,
  PESTELAnalysisFilters,
  SignalFilters,
  RegulatoryFilters,
  ScenarioFilters,
  AlertFilters,
} from '../types/scanning.types';
import { SignalStatus } from '../constants/scanning.constants';
import { scanningService } from '../services/scanningService';

// ----------------------------------------------------------------------------
// HOOK IMPLEMENTATION
// ----------------------------------------------------------------------------

export function useEnvironmentScanning() {
  // PESTEL State
  const [pestelAnalyses, setPestelAnalyses] = useState<PESTELAnalysis[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<PESTELAnalysis | null>(null);
  const [pestelLoading, setPestelLoading] = useState(false);
  const [pestelError, setPestelError] = useState<string | null>(null);
  
  // Signal State
  const [signals, setSignals] = useState<EnvironmentSignal[]>([]);
  const [selectedSignal, setSelectedSignal] = useState<EnvironmentSignal | null>(null);
  const [signalLoading, setSignalLoading] = useState(false);
  const [signalError, setSignalError] = useState<string | null>(null);
  
  // Regulatory State
  const [regulations, setRegulations] = useState<RegulatoryItem[]>([]);
  const [selectedRegulation, setSelectedRegulation] = useState<RegulatoryItem | null>(null);
  const [regulatoryLoading, setRegulatoryLoading] = useState(false);
  const [regulatoryError, setRegulatoryError] = useState<string | null>(null);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<RegulatoryItem[]>([]);
  
  // Scenario State
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<Scenario | null>(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [scenarioError, setScenarioError] = useState<string | null>(null);
  
  // Early Warning State
  const [alerts, setAlerts] = useState<EarlyWarningAlert[]>([]);
  const [triggers, setTriggers] = useState<AlertTrigger[]>([]);
  const [alertLoading, setAlertLoading] = useState(false);
  const [alertError, setAlertError] = useState<string | null>(null);
  
  // Indicator State
  const [indicators, setIndicators] = useState<TrackedIndicator[]>([]);
  const [indicatorLoading, setIndicatorLoading] = useState(false);
  const [indicatorError, setIndicatorError] = useState<string | null>(null);
  
  // Analytics State
  const [analytics, setAnalytics] = useState<EnvironmentScanningAnalytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // -------------------------------------------------------------------------
  // PESTEL Operations
  // -------------------------------------------------------------------------

  const loadPESTELAnalyses = useCallback(async (filters?: PESTELAnalysisFilters) => {
    setPestelLoading(true);
    setPestelError(null);
    try {
      const data = await scanningService.getPESTELAnalyses(filters);
      setPestelAnalyses(data);
    } catch (error) {
      setPestelError(error instanceof Error ? error.message : 'Failed to load PESTEL analyses');
    } finally {
      setPestelLoading(false);
    }
  }, []);

  const loadPESTELAnalysis = useCallback(async (id: string) => {
    setPestelLoading(true);
    setPestelError(null);
    try {
      const data = await scanningService.getPESTELAnalysis(id);
      setSelectedAnalysis(data);
    } catch (error) {
      setPestelError(error instanceof Error ? error.message : 'Failed to load PESTEL analysis');
    } finally {
      setPestelLoading(false);
    }
  }, []);

  const createPESTELAnalysis = useCallback(async (
    data: Omit<PESTELAnalysis, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'status'>,
    userId: string
  ): Promise<PESTELAnalysis> => {
    const analysis = await scanningService.createPESTELAnalysis(data, userId);
    setPestelAnalyses(prev => [analysis, ...prev]);
    return analysis;
  }, []);

  const addPESTELFactor = useCallback(async (
    analysisId: string,
    factor: Omit<PESTELFactor, 'id' | 'lastUpdated'>
  ): Promise<PESTELFactor> => {
    const newFactor = await scanningService.addPESTELFactor(analysisId, factor);
    if (selectedAnalysis?.id === analysisId) {
      await loadPESTELAnalysis(analysisId);
    }
    return newFactor;
  }, [selectedAnalysis?.id, loadPESTELAnalysis]);

  const updatePESTELStatus = useCallback(async (
    id: string,
    status: PESTELAnalysis['status'],
    reviewedBy?: string
  ) => {
    await scanningService.updatePESTELAnalysisStatus(id, status, reviewedBy);
    await loadPESTELAnalyses();
    if (selectedAnalysis?.id === id) {
      await loadPESTELAnalysis(id);
    }
  }, [loadPESTELAnalyses, selectedAnalysis?.id, loadPESTELAnalysis]);

  const generatePESTELSummary = useCallback(async (analysisId: string) => {
    await scanningService.generatePESTELSummary(analysisId);
    if (selectedAnalysis?.id === analysisId) {
      await loadPESTELAnalysis(analysisId);
    }
  }, [selectedAnalysis?.id, loadPESTELAnalysis]);

  // -------------------------------------------------------------------------
  // Signal Operations
  // -------------------------------------------------------------------------

  const loadSignals = useCallback(async (filters?: SignalFilters) => {
    setSignalLoading(true);
    setSignalError(null);
    try {
      const data = await scanningService.getSignals(filters);
      setSignals(data);
    } catch (error) {
      setSignalError(error instanceof Error ? error.message : 'Failed to load signals');
    } finally {
      setSignalLoading(false);
    }
  }, []);

  const loadSignal = useCallback(async (id: string) => {
    setSignalLoading(true);
    setSignalError(null);
    try {
      const data = await scanningService.getSignal(id);
      setSelectedSignal(data);
    } catch (error) {
      setSignalError(error instanceof Error ? error.message : 'Failed to load signal');
    } finally {
      setSignalLoading(false);
    }
  }, []);

  const createSignal = useCallback(async (
    data: Omit<EnvironmentSignal, 'id' | 'detectedAt' | 'updatedAt' | 'status' | 'statusHistory'>,
    userId: string
  ): Promise<EnvironmentSignal> => {
    const signal = await scanningService.createSignal(data, userId);
    setSignals(prev => [signal, ...prev]);
    return signal;
  }, []);

  const updateSignalStatus = useCallback(async (
    id: string,
    newStatus: SignalStatus,
    userId: string,
    reason: string
  ) => {
    await scanningService.updateSignalStatus(id, newStatus, userId, reason);
    await loadSignals();
    if (selectedSignal?.id === id) {
      await loadSignal(id);
    }
  }, [loadSignals, selectedSignal?.id, loadSignal]);

  const addSignalActionItem = useCallback(async (
    signalId: string,
    actionItem: Omit<EnvironmentSignal['actionItems'][0], 'id'>
  ) => {
    await scanningService.addSignalActionItem(signalId, actionItem);
    if (selectedSignal?.id === signalId) {
      await loadSignal(signalId);
    }
  }, [selectedSignal?.id, loadSignal]);

  // -------------------------------------------------------------------------
  // Regulatory Operations
  // -------------------------------------------------------------------------

  const loadRegulations = useCallback(async (filters?: RegulatoryFilters) => {
    setRegulatoryLoading(true);
    setRegulatoryError(null);
    try {
      const data = await scanningService.getRegulatoryItems(filters);
      setRegulations(data);
    } catch (error) {
      setRegulatoryError(error instanceof Error ? error.message : 'Failed to load regulations');
    } finally {
      setRegulatoryLoading(false);
    }
  }, []);

  const loadRegulation = useCallback(async (id: string) => {
    setRegulatoryLoading(true);
    setRegulatoryError(null);
    try {
      const data = await scanningService.getRegulatoryItem(id);
      setSelectedRegulation(data);
    } catch (error) {
      setRegulatoryError(error instanceof Error ? error.message : 'Failed to load regulation');
    } finally {
      setRegulatoryLoading(false);
    }
  }, []);

  const createRegulation = useCallback(async (
    data: Omit<RegulatoryItem, 'id' | 'trackedAt' | 'updatedAt' | 'statusHistory'>,
    userId: string
  ): Promise<RegulatoryItem> => {
    const regulation = await scanningService.createRegulatoryItem(data, userId);
    setRegulations(prev => [regulation, ...prev]);
    return regulation;
  }, []);

  const updateRegulatoryStatus = useCallback(async (
    id: string,
    newStatus: RegulatoryItem['status'],
    userId: string,
    notes?: string
  ) => {
    await scanningService.updateRegulatoryStatus(id, newStatus, userId, notes);
    await loadRegulations();
    if (selectedRegulation?.id === id) {
      await loadRegulation(id);
    }
  }, [loadRegulations, selectedRegulation?.id, loadRegulation]);

  const updateComplianceStatus = useCallback(async (
    id: string,
    complianceData: Partial<RegulatoryItem['compliance']>
  ) => {
    await scanningService.updateComplianceStatus(id, complianceData);
    if (selectedRegulation?.id === id) {
      await loadRegulation(id);
    }
  }, [selectedRegulation?.id, loadRegulation]);

  const loadUpcomingDeadlines = useCallback(async (daysAhead: number = 90) => {
    try {
      const data = await scanningService.getUpcomingDeadlines(daysAhead);
      setUpcomingDeadlines(data);
    } catch (error) {
      setRegulatoryError(error instanceof Error ? error.message : 'Failed to load deadlines');
    }
  }, []);

  // -------------------------------------------------------------------------
  // Scenario Operations
  // -------------------------------------------------------------------------

  const loadScenarios = useCallback(async (filters?: ScenarioFilters) => {
    setScenarioLoading(true);
    setScenarioError(null);
    try {
      const data = await scanningService.getScenarios(filters);
      setScenarios(data);
    } catch (error) {
      setScenarioError(error instanceof Error ? error.message : 'Failed to load scenarios');
    } finally {
      setScenarioLoading(false);
    }
  }, []);

  const loadScenario = useCallback(async (id: string) => {
    setScenarioLoading(true);
    setScenarioError(null);
    try {
      const data = await scanningService.getScenario(id);
      setSelectedScenario(data);
    } catch (error) {
      setScenarioError(error instanceof Error ? error.message : 'Failed to load scenario');
    } finally {
      setScenarioLoading(false);
    }
  }, []);

  const createScenario = useCallback(async (
    data: Omit<Scenario, 'id' | 'createdAt' | 'updatedAt' | 'status'>,
    userId: string
  ): Promise<Scenario> => {
    const scenario = await scanningService.createScenario(data, userId);
    setScenarios(prev => [scenario, ...prev]);
    return scenario;
  }, []);

  const updateScenario = useCallback(async (id: string, data: Partial<Scenario>) => {
    await scanningService.updateScenario(id, data);
    if (selectedScenario?.id === id) {
      await loadScenario(id);
    }
  }, [selectedScenario?.id, loadScenario]);

  const updateScenarioStatus = useCallback(async (
    id: string,
    status: Scenario['status'],
    approvedBy?: string
  ) => {
    await scanningService.updateScenarioStatus(id, status, approvedBy);
    await loadScenarios();
    if (selectedScenario?.id === id) {
      await loadScenario(id);
    }
  }, [loadScenarios, selectedScenario?.id, loadScenario]);

  const updateSignpostStatus = useCallback(async (
    scenarioId: string,
    signpostId: string,
    currentValue: number
  ) => {
    await scanningService.updateSignpostStatus(scenarioId, signpostId, currentValue);
    if (selectedScenario?.id === scenarioId) {
      await loadScenario(scenarioId);
    }
  }, [selectedScenario?.id, loadScenario]);

  // -------------------------------------------------------------------------
  // Early Warning Operations
  // -------------------------------------------------------------------------

  const loadAlerts = useCallback(async (filters?: AlertFilters) => {
    setAlertLoading(true);
    setAlertError(null);
    try {
      const data = await scanningService.getAlerts(filters);
      setAlerts(data);
    } catch (error) {
      setAlertError(error instanceof Error ? error.message : 'Failed to load alerts');
    } finally {
      setAlertLoading(false);
    }
  }, []);

  const loadTriggers = useCallback(async () => {
    try {
      const data = await scanningService.getActiveTriggers();
      setTriggers(data);
    } catch (error) {
      setAlertError(error instanceof Error ? error.message : 'Failed to load triggers');
    }
  }, []);

  const createTrigger = useCallback(async (
    data: Omit<AlertTrigger, 'id' | 'createdAt' | 'updatedAt'>,
    userId: string
  ): Promise<AlertTrigger> => {
    const trigger = await scanningService.createAlertTrigger(data, userId);
    setTriggers(prev => [...prev, trigger]);
    return trigger;
  }, []);

  const createAlert = useCallback(async (
    data: Omit<EarlyWarningAlert, 'id' | 'createdAt' | 'notificationsSent' | 'status'>
  ): Promise<EarlyWarningAlert> => {
    const alert = await scanningService.createAlert(data);
    setAlerts(prev => [alert, ...prev]);
    return alert;
  }, []);

  const acknowledgeAlert = useCallback(async (id: string, userId: string) => {
    await scanningService.acknowledgeAlert(id, userId);
    await loadAlerts();
  }, [loadAlerts]);

  const resolveAlert = useCallback(async (id: string, userId: string, resolution: string) => {
    await scanningService.resolveAlert(id, userId, resolution);
    await loadAlerts();
  }, [loadAlerts]);

  // -------------------------------------------------------------------------
  // Indicator Operations
  // -------------------------------------------------------------------------

  const loadIndicators = useCallback(async () => {
    setIndicatorLoading(true);
    setIndicatorError(null);
    try {
      const data = await scanningService.getTrackedIndicators();
      setIndicators(data);
    } catch (error) {
      setIndicatorError(error instanceof Error ? error.message : 'Failed to load indicators');
    } finally {
      setIndicatorLoading(false);
    }
  }, []);

  const trackIndicator = useCallback(async (
    data: Omit<TrackedIndicator, 'id' | 'lastUpdated' | 'trend' | 'changePercent' | 'alertStatus'>
  ): Promise<TrackedIndicator> => {
    const indicator = await scanningService.trackIndicator(data);
    setIndicators(prev => [...prev, indicator]);
    return indicator;
  }, []);

  const updateIndicatorValue = useCallback(async (
    id: string,
    value: number,
    source?: string
  ) => {
    await scanningService.updateIndicatorValue(id, value, source);
    await loadIndicators();
  }, [loadIndicators]);

  // -------------------------------------------------------------------------
  // Analytics
  // -------------------------------------------------------------------------

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    try {
      const data = await scanningService.getEnvironmentScanningAnalytics();
      setAnalytics(data);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setAnalyticsLoading(false);
    }
  }, []);

  // -------------------------------------------------------------------------
  // Refresh All
  // -------------------------------------------------------------------------

  const refreshAll = useCallback(async () => {
    await Promise.all([
      loadPESTELAnalyses(),
      loadSignals(),
      loadRegulations(),
      loadScenarios(),
      loadAlerts(),
      loadTriggers(),
      loadIndicators(),
      loadAnalytics(),
    ]);
  }, [
    loadPESTELAnalyses,
    loadSignals,
    loadRegulations,
    loadScenarios,
    loadAlerts,
    loadTriggers,
    loadIndicators,
    loadAnalytics,
  ]);

  // -------------------------------------------------------------------------
  // Initial Load
  // -------------------------------------------------------------------------

  useEffect(() => {
    refreshAll();
  }, []);

  // -------------------------------------------------------------------------
  // Return
  // -------------------------------------------------------------------------

  return {
    // PESTEL
    pestelAnalyses,
    selectedAnalysis,
    pestelLoading,
    pestelError,
    loadPESTELAnalyses,
    loadPESTELAnalysis,
    createPESTELAnalysis,
    addPESTELFactor,
    updatePESTELStatus,
    generatePESTELSummary,
    setSelectedAnalysis,
    
    // Signals
    signals,
    selectedSignal,
    signalLoading,
    signalError,
    loadSignals,
    loadSignal,
    createSignal,
    updateSignalStatus,
    addSignalActionItem,
    setSelectedSignal,
    
    // Regulatory
    regulations,
    selectedRegulation,
    regulatoryLoading,
    regulatoryError,
    upcomingDeadlines,
    loadRegulations,
    loadRegulation,
    createRegulation,
    updateRegulatoryStatus,
    updateComplianceStatus,
    loadUpcomingDeadlines,
    setSelectedRegulation,
    
    // Scenarios
    scenarios,
    selectedScenario,
    scenarioLoading,
    scenarioError,
    loadScenarios,
    loadScenario,
    createScenario,
    updateScenario,
    updateScenarioStatus,
    updateSignpostStatus,
    setSelectedScenario,
    
    // Early Warning
    alerts,
    triggers,
    alertLoading,
    alertError,
    loadAlerts,
    loadTriggers,
    createTrigger,
    createAlert,
    acknowledgeAlert,
    resolveAlert,
    
    // Indicators
    indicators,
    indicatorLoading,
    indicatorError,
    loadIndicators,
    trackIndicator,
    updateIndicatorValue,
    
    // Analytics
    analytics,
    analyticsLoading,
    loadAnalytics,
    
    // Utilities
    refreshAll,
  };
}

export default useEnvironmentScanning;
