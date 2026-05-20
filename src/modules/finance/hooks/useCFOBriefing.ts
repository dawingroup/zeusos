// ============================================================================
// USE CFO BRIEFING HOOK
// React hook for AI-powered daily briefings and scenario analysis
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import type {
  CFOBriefing,
  ScenarioInput,
  ScenarioResult,
} from '../types/optimizer.types';
import { cfoBriefingService } from '../services/cfoBriefingService';

interface UseCFOBriefingOptions {
  companyId: string;
  autoLoad?: boolean;
}

interface UseCFOBriefingReturn {
  briefing: CFOBriefing | null;
  briefingHistory: CFOBriefing[];
  scenarioResults: ScenarioResult[];
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  generateBriefing: () => Promise<void>;
  runScenario: (scenario: ScenarioInput) => Promise<ScenarioResult>;
}

export function useCFOBriefing({
  companyId,
  autoLoad = true,
}: UseCFOBriefingOptions): UseCFOBriefingReturn {
  const [briefing, setBriefing] = useState<CFOBriefing | null>(null);
  const [briefingHistory, setBriefingHistory] = useState<CFOBriefing[]>([]);
  const [scenarioResults, setScenarioResults] = useState<ScenarioResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!companyId) return;
    setIsLoading(true);
    setError(null);

    try {
      const [latest, history, scenarios] = await Promise.all([
        cfoBriefingService.getDailyBriefing(companyId),
        cfoBriefingService.getBriefingHistory(companyId, 7),
        cfoBriefingService.getScenarioHistory(companyId, 5),
      ]);

      setBriefing(latest);
      setBriefingHistory(history);
      setScenarioResults(scenarios);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load briefing data');
    } finally {
      setIsLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    if (autoLoad) {
      loadAll();
    }
  }, [autoLoad, loadAll]);

  const generateBriefing = useCallback(async () => {
    setIsGenerating(true);
    setError(null);
    try {
      const newBriefing = await cfoBriefingService.generateBriefing(companyId);
      setBriefing(newBriefing);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate briefing');
    } finally {
      setIsGenerating(false);
    }
  }, [companyId, loadAll]);

  const runScenario = useCallback(async (scenario: ScenarioInput) => {
    setIsGenerating(true);
    setError(null);
    try {
      const result = await cfoBriefingService.runWhatIfScenario(companyId, scenario);
      setScenarioResults(prev => [result, ...prev]);
      return result;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Scenario analysis failed');
      throw err;
    } finally {
      setIsGenerating(false);
    }
  }, [companyId]);

  return {
    briefing,
    briefingHistory,
    scenarioResults,
    isLoading,
    isGenerating,
    error,
    refresh: loadAll,
    generateBriefing,
    runScenario,
  };
}
