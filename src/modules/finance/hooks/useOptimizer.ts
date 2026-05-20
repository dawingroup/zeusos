// ============================================================================
// USE OPTIMIZER HOOK
// Main hook for the Cash Flow Optimizer — loads projections, queue, spend plan
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { where, orderBy, limit } from 'firebase/firestore';
import type {
  CashFlowProjection,
  ExpenditureItem,
  SpendPlan,
  OptimizerConfig,
  OptimizerRun,
} from '../types/optimizer.types';
import { subscribeToCollection } from '@/shared/services/firebase/firestore';
import { optimizerService } from '../services/optimizerService';
import { dataIngestionService } from '../services/dataIngestionService';
import { formatDate } from '../services/optimizerEngine';

interface UseOptimizerOptions {
  companyId: string;
  subsidiaryId?: string;
  autoLoad?: boolean;
}

interface UseOptimizerReturn {
  // Data
  projection: CashFlowProjection | null;
  expenditureQueue: ExpenditureItem[];
  todaysSpendPlan: SpendPlan | null;
  config: OptimizerConfig | null;
  recentRuns: OptimizerRun[];

  // Computed
  queueByTier: Record<string, ExpenditureItem[]>;
  criticalCount: number;
  totalPendingAmount: number;

  // State
  isLoading: boolean;
  error: string | null;

  // Actions
  refresh: () => Promise<void>;
  generatePlan: (bankBalance: number, savingsBalance: number) => Promise<SpendPlan>;
  approveItem: (planId: string, expenditureId: string) => Promise<void>;
  deferItem: (expenditureId: string, reason: string) => Promise<void>;
  runIngestion: () => Promise<void>;
  rescoreAll: () => Promise<void>;
  updateConfig: (updates: Partial<OptimizerConfig>) => Promise<void>;
}

export function useOptimizer({
  companyId,
  subsidiaryId,
  autoLoad = true,
}: UseOptimizerOptions): UseOptimizerReturn {
  const [projection, setProjection] = useState<CashFlowProjection | null>(null);
  const [expenditureQueue, setExpenditureQueue] = useState<ExpenditureItem[]>([]);
  const [todaysSpendPlan, setTodaysSpendPlan] = useState<SpendPlan | null>(null);
  const [config, setConfig] = useState<OptimizerConfig | null>(null);
  const [recentRuns, setRecentRuns] = useState<OptimizerRun[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    if (!companyId) return;
    setIsLoading(true);
    setError(null);

    try {
      const [proj, queue, plan, cfg, runs] = await Promise.all([
        optimizerService.getLatestProjection(companyId),
        optimizerService.getExpenditureQueue(companyId, {
          status: 'pending',
          subsidiaryId,
        }),
        optimizerService.getSpendPlan(companyId, formatDate(new Date())),
        optimizerService.getConfig(companyId),
        optimizerService.getRecentRuns(companyId, 5),
      ]);

      setProjection(proj);
      setExpenditureQueue(queue);
      setTodaysSpendPlan(plan);
      setConfig(cfg);
      setRecentRuns(runs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load optimizer data');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, subsidiaryId]);

  useEffect(() => {
    if (autoLoad) {
      loadAll();
    }
  }, [autoLoad, loadAll]);

  // Real-time spend plan subscription
  useEffect(() => {
    if (!companyId || !autoLoad) return;

    const todayStr = formatDate(new Date());
    const collectionPath = `companies/${companyId}/spend_plans`;

    const unsubscribe = subscribeToCollection<SpendPlan>(
      collectionPath,
      (plans) => {
        if (plans.length > 0) {
          // Take the most recently generated plan for today
          setTodaysSpendPlan(plans[0]);
        }
      },
      [
        where('date', '==', todayStr),
        where('status', 'in', ['draft', 'active']),
        orderBy('generatedAt', 'desc'),
        limit(1),
      ]
    );

    return () => unsubscribe();
  }, [companyId, autoLoad]);

  // Computed
  const queueByTier = expenditureQueue.reduce((acc, item) => {
    const tier = item.priorityTier;
    if (!acc[tier]) acc[tier] = [];
    acc[tier].push(item);
    return acc;
  }, {} as Record<string, ExpenditureItem[]>);

  const criticalCount = queueByTier['CRITICAL']?.length || 0;
  const totalPendingAmount = expenditureQueue.reduce((sum, item) => sum + item.amountUGX, 0);

  // Actions
  const generatePlan = useCallback(async (bankBalance: number, savingsBalance: number) => {
    setIsLoading(true);
    try {
      const plan = await optimizerService.generateAndSaveSpendPlan(
        companyId,
        subsidiaryId || 'dawin-finishes',
        bankBalance,
        savingsBalance,
        [] // Receipts would come from QBO data
      );
      setTodaysSpendPlan(plan);
      return plan;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate plan');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, [companyId, subsidiaryId]);

  const approveItem = useCallback(async (planId: string, expenditureId: string) => {
    await optimizerService.approveSpendPlanItem(companyId, planId, expenditureId, 'user');
    await loadAll();
  }, [companyId, loadAll]);

  const deferItem = useCallback(async (expenditureId: string, reason: string) => {
    await optimizerService.deferSpendPlanItem(companyId, expenditureId, reason, 'user');
    await loadAll();
  }, [companyId, loadAll]);

  const runIngestion = useCallback(async () => {
    setIsLoading(true);
    try {
      await dataIngestionService.runFullIngestion(companyId);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Ingestion failed');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, loadAll]);

  const rescoreAll = useCallback(async () => {
    setIsLoading(true);
    try {
      await optimizerService.rescoreAllExpenditures(companyId);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Rescoring failed');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, loadAll]);

  const updateConfig = useCallback(async (updates: Partial<OptimizerConfig>) => {
    await optimizerService.updateConfig(companyId, updates, 'user');
    const newConfig = await optimizerService.getConfig(companyId);
    setConfig(newConfig);
  }, [companyId]);

  return {
    projection,
    expenditureQueue,
    todaysSpendPlan,
    config,
    recentRuns,
    queueByTier,
    criticalCount,
    totalPendingAmount,
    isLoading,
    error,
    refresh: loadAll,
    generatePlan,
    approveItem,
    deferItem,
    runIngestion,
    rescoreAll,
    updateConfig,
  };
}
