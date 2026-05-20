/**
 * usePredictions Hook
 * Manage AI predictions for entities
 */

import { useState, useCallback } from 'react';
import { predictiveAnalyticsService } from '../services/predictive-analytics';
import {
  AIPrediction,
  ProjectHealthAnalysis,
  DealScoring,
  LinkableEntityType,
} from '../types/ai-extensions';

interface UsePredictionsReturn {
  predictions: AIPrediction[];
  isLoading: boolean;
  error: Error | null;
  generatePrediction: (
    entityId: string,
    entityData: Record<string, any>,
    historicalData?: Record<string, any>[]
  ) => Promise<AIPrediction | null>;
  refresh: (entityType: LinkableEntityType, entityId: string) => Promise<void>;
}

export function usePredictions(): UsePredictionsReturn {
  const [predictions, setPredictions] = useState<AIPrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const generatePrediction = useCallback(async (
    entityId: string,
    entityData: Record<string, any>,
    historicalData: Record<string, any>[] = []
  ): Promise<AIPrediction | null> => {
    setIsLoading(true);
    setError(null);
    try {
      const prediction = await predictiveAnalyticsService.predictProjectCompletion(
        entityId,
        entityData,
        historicalData
      );
      setPredictions(prev => [prediction, ...prev]);
      return prediction;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const refresh = useCallback(async (
    entityType: LinkableEntityType,
    entityId: string
  ) => {
    setIsLoading(true);
    try {
      const fetched = await predictiveAnalyticsService.getPredictions(entityType, entityId);
      setPredictions(fetched);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    predictions,
    isLoading,
    error,
    generatePrediction,
    refresh,
  };
}

/**
 * Hook for project health analysis
 */
export function useProjectHealth(
  projectId: string,
  projectData: Record<string, any> | null,
  milestones: Record<string, any>[],
  payments: Record<string, any>[]
): {
  health: ProjectHealthAnalysis | null;
  isAnalyzing: boolean;
  analyze: () => Promise<void>;
} {
  const [health, setHealth] = useState<ProjectHealthAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const analyze = useCallback(async () => {
    if (!projectData) return;

    setIsAnalyzing(true);
    try {
      const analysis = await predictiveAnalyticsService.analyzeProjectHealth(
        projectId,
        projectData,
        milestones,
        payments
      );
      setHealth(analysis);
    } catch (error) {
      console.error('Error analyzing project health:', error);
    } finally {
      setIsAnalyzing(false);
    }
  }, [projectId, projectData, milestones, payments]);

  return { health, isAnalyzing, analyze };
}

/**
 * Hook for deal scoring
 */
export function useDealScoring(
  dealId: string,
  dealData: Record<string, any> | null,
  financials: Record<string, any>,
  comparables: Record<string, any>[]
): {
  scoring: DealScoring | null;
  isScoring: boolean;
  score: () => Promise<void>;
} {
  const [scoring, setScoring] = useState<DealScoring | null>(null);
  const [isScoring, setIsScoring] = useState(false);

  const score = useCallback(async () => {
    if (!dealData) return;

    setIsScoring(true);
    try {
      const result = await predictiveAnalyticsService.scoreDeal(
        dealId,
        dealData,
        financials,
        comparables
      );
      setScoring(result);
    } catch (error) {
      console.error('Error scoring deal:', error);
    } finally {
      setIsScoring(false);
    }
  }, [dealId, dealData, financials, comparables]);

  return { scoring, isScoring, score };
}

/**
 * Hook for budget variance prediction
 */
export function useBudgetPrediction(
  entityId: string,
  entityType: LinkableEntityType,
  budgetData: Record<string, any> | null,
  spendingHistory: Record<string, any>[]
): {
  prediction: AIPrediction | null;
  isPredicting: boolean;
  predict: () => Promise<void>;
} {
  const [prediction, setPrediction] = useState<AIPrediction | null>(null);
  const [isPredicting, setIsPredicting] = useState(false);

  const predict = useCallback(async () => {
    if (!budgetData) return;

    setIsPredicting(true);
    try {
      const result = await predictiveAnalyticsService.predictBudgetVariance(
        entityId,
        entityType,
        budgetData,
        spendingHistory
      );
      setPrediction(result);
    } catch (error) {
      console.error('Error predicting budget variance:', error);
    } finally {
      setIsPredicting(false);
    }
  }, [entityId, entityType, budgetData, spendingHistory]);

  return { prediction, isPredicting, predict };
}
