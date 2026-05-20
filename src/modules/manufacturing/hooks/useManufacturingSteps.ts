/**
 * Hook for manufacturing step lifecycle management with real-time updates
 */

import { useState, useEffect, useCallback } from 'react';
import type {
  ManufacturingStep,
  StepMaterialConsumption,
  QualityEvent,
} from '../types';
import { manufacturingExecutionService } from '../services/manufacturingExecutionService';

interface UseManufacturingStepsResult {
  steps: ManufacturingStep[];
  isLoading: boolean;
  error: string | null;
  startStep: (stepId: string, operatorId: string, operatorName: string) => Promise<void>;
  pauseStep: (stepId: string, operatorId: string, reason?: string) => Promise<void>;
  resumeStep: (stepId: string, operatorId: string, operatorName: string) => Promise<void>;
  completeStep: (stepId: string, operatorId: string, operatorName: string, materials?: StepMaterialConsumption[]) => Promise<void>;
  skipStep: (stepId: string, userId: string, reason: string) => Promise<void>;
  recordQCResult: (
    stepId: string,
    result: 'pass' | 'fail' | 'conditional',
    inspectorId: string,
    inspectorName: string,
    notes?: string,
    defectDetails?: {
      defectType: QualityEvent['defectType'];
      defectSeverity: QualityEvent['defectSeverity'];
      defectDescription?: string;
      affectedQuantity?: number;
      resolution?: QualityEvent['resolution'];
      photos?: string[];
    },
  ) => Promise<string | undefined>;
  activeStep: ManufacturingStep | null;
  completedCount: number;
  totalCount: number;
  progressPercent: number;
}

export function useManufacturingSteps(
  orderId: string | null,
): UseManufacturingStepsResult {
  const [steps, setSteps] = useState<ManufacturingStep[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) {
      setSteps([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = manufacturingExecutionService.subscribeToOrderSteps(
      orderId,
      (data) => {
        setSteps(data);
        setIsLoading(false);
      },
    );

    return unsubscribe;
  }, [orderId]);

  const handleError = useCallback((err: unknown) => {
    const msg = err instanceof Error ? err.message : 'Operation failed';
    setError(msg);
    throw err;
  }, []);

  const startStep = useCallback(
    async (stepId: string, operatorId: string, operatorName: string) => {
      if (!orderId) return;
      try {
        await manufacturingExecutionService.startStep(orderId, stepId, operatorId, operatorName);
      } catch (err) {
        handleError(err);
      }
    },
    [orderId, handleError],
  );

  const pauseStep = useCallback(
    async (stepId: string, operatorId: string, reason?: string) => {
      if (!orderId) return;
      try {
        await manufacturingExecutionService.pauseStep(orderId, stepId, operatorId, reason);
      } catch (err) {
        handleError(err);
      }
    },
    [orderId, handleError],
  );

  const resumeStep = useCallback(
    async (stepId: string, operatorId: string, operatorName: string) => {
      if (!orderId) return;
      try {
        await manufacturingExecutionService.resumeStep(orderId, stepId, operatorId, operatorName);
      } catch (err) {
        handleError(err);
      }
    },
    [orderId, handleError],
  );

  const completeStep = useCallback(
    async (stepId: string, operatorId: string, operatorName: string, materials?: StepMaterialConsumption[]) => {
      if (!orderId) return;
      try {
        await manufacturingExecutionService.completeStep(orderId, stepId, operatorId, operatorName, materials);
      } catch (err) {
        handleError(err);
      }
    },
    [orderId, handleError],
  );

  const skipStep = useCallback(
    async (stepId: string, userId: string, reason: string) => {
      if (!orderId) return;
      try {
        await manufacturingExecutionService.skipStep(orderId, stepId, userId, reason);
      } catch (err) {
        handleError(err);
      }
    },
    [orderId, handleError],
  );

  const recordQCResult = useCallback(
    async (
      stepId: string,
      result: 'pass' | 'fail' | 'conditional',
      inspectorId: string,
      inspectorName: string,
      notes?: string,
      defectDetails?: {
        defectType: QualityEvent['defectType'];
        defectSeverity: QualityEvent['defectSeverity'];
        defectDescription?: string;
        affectedQuantity?: number;
        resolution?: QualityEvent['resolution'];
        photos?: string[];
      },
    ) => {
      if (!orderId) return undefined;
      try {
        return await manufacturingExecutionService.recordQCResult(
          orderId, stepId, result, inspectorId, inspectorName, notes, defectDetails,
        );
      } catch (err) {
        handleError(err);
        return undefined;
      }
    },
    [orderId, handleError],
  );

  const completedCount = steps.filter(s => s.status === 'completed' || s.status === 'skipped').length;
  const totalCount = steps.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  const activeStep = steps.find(s => s.status === 'in_progress' || s.status === 'paused') ?? null;

  return {
    steps,
    isLoading,
    error,
    startStep,
    pauseStep,
    resumeStep,
    completeStep,
    skipStep,
    recordQCResult,
    activeStep,
    completedCount,
    totalCount,
    progressPercent,
  };
}
