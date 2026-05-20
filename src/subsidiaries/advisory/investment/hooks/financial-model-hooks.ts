/**
 * Financial Model React Hooks
 */

import { useState, useEffect, useCallback } from 'react';
import {
  FinancialModel,
  ModelAssumptions,
} from '../types/financial-model';
import { Scenario, ScenarioType, AssumptionOverride } from '../types/scenario';
import { SensitivityAnalysis, SensitivityVariable } from '../types/sensitivity';
import { financialModelService } from '../services/financial-model-service';

/**
 * Get single financial model
 */
export function useFinancialModel(modelId: string | undefined) {
  const [model, setModel] = useState<FinancialModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!modelId) {
      setModel(null);
      setLoading(false);
      return;
    }

    const fetchModel = async () => {
      try {
        setLoading(true);
        const result = await financialModelService.getFinancialModel(modelId);
        setModel(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch model'));
      } finally {
        setLoading(false);
      }
    };

    fetchModel();
  }, [modelId]);

  return { model, loading, error };
}

/**
 * Get all models for a deal
 */
export function useDealModels(dealId: string | undefined) {
  const [models, setModels] = useState<FinancialModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!dealId) {
      setModels([]);
      setLoading(false);
      return;
    }

    const fetchModels = async () => {
      try {
        setLoading(true);
        const result = await financialModelService.getDealModels(dealId);
        setModels(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch models'));
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
  }, [dealId]);

  return { models, loading, error };
}

/**
 * Get latest approved model
 */
export function useLatestApprovedModel(dealId: string | undefined) {
  const [model, setModel] = useState<FinancialModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!dealId) {
      setModel(null);
      setLoading(false);
      return;
    }

    const fetchModel = async () => {
      try {
        setLoading(true);
        const result = await financialModelService.getLatestApprovedModel(dealId);
        setModel(result);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch approved model'));
      } finally {
        setLoading(false);
      }
    };

    fetchModel();
  }, [dealId]);

  return { model, loading, error };
}

/**
 * Create financial model
 */
export function useCreateFinancialModel() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const create = useCallback(
    async (
      model: Omit<FinancialModel, 'id' | 'createdAt' | 'updatedAt' | 'cashFlows' | 'cashFlowSummary' | 'equityReturns' | 'outputs'>,
      userId: string
    ): Promise<FinancialModel> => {
      try {
        setLoading(true);
        setError(null);
        const result = await financialModelService.createFinancialModel(model, userId);
        return result;
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to create model');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { create, loading, error };
}

/**
 * Update financial model
 */
export function useUpdateFinancialModel() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const update = useCallback(
    async (
      modelId: string,
      updates: Partial<FinancialModel>,
      userId: string
    ): Promise<FinancialModel> => {
      try {
        setLoading(true);
        setError(null);
        const result = await financialModelService.updateFinancialModel(modelId, updates, userId);
        return result;
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to update model');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { update, loading, error };
}

/**
 * Create new model version
 */
export function useCreateModelVersion() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createVersion = useCallback(
    async (sourceModelId: string, versionNotes: string, userId: string): Promise<FinancialModel> => {
      try {
        setLoading(true);
        setError(null);
        const result = await financialModelService.createModelVersion(sourceModelId, versionNotes, userId);
        return result;
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to create version');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { createVersion, loading, error };
}

/**
 * Submit model for approval
 */
export function useSubmitModelForApproval() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const submit = useCallback(
    async (modelId: string, userId: string): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        await financialModelService.submitModelForApproval(modelId, userId);
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to submit model');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { submit, loading, error };
}

/**
 * Approve model
 */
export function useApproveModel() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const approve = useCallback(
    async (modelId: string, userId: string): Promise<void> => {
      try {
        setLoading(true);
        setError(null);
        await financialModelService.approveModel(modelId, userId);
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to approve model');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { approve, loading, error };
}

/**
 * Create scenario
 */
export function useCreateScenario() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createScenario = useCallback(
    async (
      modelId: string,
      scenarioType: ScenarioType,
      overrides: AssumptionOverride[],
      userId: string
    ): Promise<Scenario> => {
      try {
        setLoading(true);
        setError(null);
        const result = await financialModelService.createScenario(modelId, scenarioType, overrides, userId);
        return result;
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to create scenario');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { createScenario, loading, error };
}

/**
 * Run sensitivity analysis
 */
export function useRunSensitivityAnalysis() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const runAnalysis = useCallback(
    async (
      modelId: string,
      variables: SensitivityVariable[],
      type: 'one_way' | 'two_way' | 'tornado',
      userId: string
    ): Promise<SensitivityAnalysis> => {
      try {
        setLoading(true);
        setError(null);
        const result = await financialModelService.runSensitivityAnalysis(modelId, variables, type, userId);
        return result;
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to run sensitivity analysis');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { runAnalysis, loading, error };
}

/**
 * Live model calculations (for real-time updates while editing)
 */
export function useLiveModelCalculations(model: FinancialModel | null) {
  const [calculations, setCalculations] = useState<{
    cashFlows: FinancialModel['cashFlows'];
    returns: FinancialModel['equityReturns'];
    debtMetrics: FinancialModel['debtMetrics'];
    outputs: FinancialModel['outputs'];
  } | null>(null);
  
  const [isCalculating, setIsCalculating] = useState(false);
  
  const recalculate = useCallback((updatedAssumptions: ModelAssumptions) => {
    if (!model) return;
    
    setIsCalculating(true);
    
    // Use setTimeout to avoid blocking UI
    setTimeout(() => {
      try {
        const result = financialModelService.calculateModelOutputs(
          updatedAssumptions,
          model.investmentStructure
        );
        setCalculations({
          cashFlows: result.cashFlows,
          returns: result.equityReturns,
          debtMetrics: result.debtMetrics,
          outputs: result.outputs,
        });
      } catch (error) {
        console.error('Calculation error:', error);
      } finally {
        setIsCalculating(false);
      }
    }, 0);
  }, [model]);
  
  return { calculations, isCalculating, recalculate };
}

/**
 * Compare scenarios
 */
export function useScenarioComparison(modelId: string | undefined) {
  const { model } = useFinancialModel(modelId);
  
  const comparison = model?.scenarioComparison || null;
  const scenarios = model?.scenarios || [];
  const baseCase = model?.baseCase || null;
  
  return {
    comparison,
    scenarios,
    baseCase,
    hasMultipleScenarios: scenarios.length > 0,
  };
}

/**
 * Format model metrics for display
 */
export function useFormattedMetrics(model: FinancialModel | null) {
  if (!model) return null;
  
  const formatPercent = (value: number) => `${(value * 100).toFixed(2)}%`;
  const formatCurrency = (value: number, currency = 'USD') => 
    new Intl.NumberFormat('en-US', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
  const formatMultiple = (value: number) => `${value.toFixed(2)}x`;
  const formatYears = (value: number) => `${value.toFixed(1)} years`;
  
  return {
    projectIRR: formatPercent(model.outputs.projectIRR),
    equityIRR: model.outputs.equityIRR ? formatPercent(model.outputs.equityIRR) : 'N/A',
    npv: formatCurrency(model.outputs.npv),
    moic: model.outputs.moic ? formatMultiple(model.outputs.moic) : 'N/A',
    paybackPeriod: model.outputs.paybackPeriod ? formatYears(model.outputs.paybackPeriod) : 'N/A',
    minDSCR: model.outputs.minDSCR ? formatMultiple(model.outputs.minDSCR) : 'N/A',
    averageDSCR: model.outputs.averageDSCR ? formatMultiple(model.outputs.averageDSCR) : 'N/A',
  };
}
