// ============================================================================
// USE STRATEGY DOCUMENT HOOK - DawinOS CEO Strategy Command
// React hook for managing a single strategy document with pillars and objectives
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../../shared/hooks/useAuth';
import { strategyDocumentService } from '../services/strategyDocument.service';
import {
  StrategyDocument,
  StrategyVersion,
  StrategicPillar,
  StrategicObjective,
  PillarMetric,
  StrategyRisk,
  StrategySummary,
  UpdateStrategyDocumentInput,
  CreatePillarInput,
  UpdatePillarInput,
  CreateObjectiveInput,
  UpdateObjectiveInput,
  CreateMetricInput,
  UpdateMetricInput,
  CreateRiskInput,
  UpdateRiskInput,
} from '../types/strategy.types';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------
export interface UseStrategyDocumentOptions {
  companyId: string;
  documentId: string;
  autoFetch?: boolean;
}

export interface UseStrategyDocumentReturn {
  document: StrategyDocument | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  // Document operations
  updateDocument: (input: UpdateStrategyDocumentInput) => Promise<StrategyDocument>;
  submitForApproval: () => Promise<StrategyDocument>;
  approveDocument: () => Promise<StrategyDocument>;
  rejectDocument: (reason: string) => Promise<StrategyDocument>;
  activateDocument: () => Promise<StrategyDocument>;
  archiveDocument: () => Promise<StrategyDocument>;
  // Pillar operations
  addPillar: (input: CreatePillarInput) => Promise<StrategicPillar>;
  updatePillar: (pillarId: string, input: UpdatePillarInput) => Promise<StrategicPillar>;
  removePillar: (pillarId: string) => Promise<void>;
  reorderPillars: (pillarIds: string[]) => Promise<void>;
  // Objective operations
  addObjective: (input: CreateObjectiveInput) => Promise<StrategicObjective>;
  updateObjective: (pillarId: string, objectiveId: string, input: UpdateObjectiveInput) => Promise<StrategicObjective>;
  removeObjective: (pillarId: string, objectiveId: string) => Promise<void>;
  // Metric operations
  addMetric: (input: CreateMetricInput) => Promise<PillarMetric>;
  updateMetric: (pillarId: string, metricId: string, input: UpdateMetricInput) => Promise<PillarMetric>;
  removeMetric: (pillarId: string, metricId: string) => Promise<void>;
  // Risk operations
  addRisk: (input: CreateRiskInput) => Promise<StrategyRisk>;
  updateRisk: (riskId: string, input: UpdateRiskInput) => Promise<StrategyRisk>;
  removeRisk: (riskId: string) => Promise<void>;
  // Version operations
  getVersionHistory: () => Promise<StrategyVersion[]>;
  restoreVersion: (versionId: string) => Promise<StrategyDocument>;
  // Summary
  getSummary: () => Promise<StrategySummary>;
}

// ----------------------------------------------------------------------------
// Hook Implementation
// ----------------------------------------------------------------------------
export function useStrategyDocument(
  options: UseStrategyDocumentOptions
): UseStrategyDocumentReturn {
  const { user } = useAuth();
  const { companyId, documentId, autoFetch = true } = options;

  const [document, setDocument] = useState<StrategyDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // --------------------------------------------------------------------------
  // Fetch Document
  // --------------------------------------------------------------------------
  const refresh = useCallback(async () => {
    if (!companyId || !documentId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await strategyDocumentService.getDocument(companyId, documentId);
      setDocument(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch strategy document'));
    } finally {
      setLoading(false);
    }
  }, [companyId, documentId]);

  useEffect(() => {
    if (autoFetch) {
      refresh();
    }
  }, [refresh, autoFetch]);

  // --------------------------------------------------------------------------
  // Document Operations
  // --------------------------------------------------------------------------
  const updateDocument = useCallback(
    async (input: UpdateStrategyDocumentInput): Promise<StrategyDocument> => {
      if (!companyId || !documentId || !user?.uid) {
        throw new Error('Company, document, or user not available');
      }
      const updated = await strategyDocumentService.updateDocument(
        companyId,
        documentId,
        input,
        user.uid
      );
      setDocument(updated);
      return updated;
    },
    [companyId, documentId, user?.uid]
  );

  const submitForApproval = useCallback(async (): Promise<StrategyDocument> => {
    if (!companyId || !documentId || !user?.uid) {
      throw new Error('Company, document, or user not available');
    }
    const updated = await strategyDocumentService.submitForApproval(
      companyId,
      documentId,
      user.uid
    );
    setDocument(updated);
    return updated;
  }, [companyId, documentId, user?.uid]);

  const approveDocument = useCallback(async (): Promise<StrategyDocument> => {
    if (!companyId || !documentId || !user?.uid) {
      throw new Error('Company, document, or user not available');
    }
    const updated = await strategyDocumentService.approveDocument(
      companyId,
      documentId,
      user.uid,
      user.displayName || undefined
    );
    setDocument(updated);
    return updated;
  }, [companyId, documentId, user?.uid, user?.displayName]);

  const rejectDocument = useCallback(
    async (reason: string): Promise<StrategyDocument> => {
      if (!companyId || !documentId || !user?.uid) {
        throw new Error('Company, document, or user not available');
      }
      const updated = await strategyDocumentService.rejectDocument(
        companyId,
        documentId,
        user.uid,
        reason
      );
      setDocument(updated);
      return updated;
    },
    [companyId, documentId, user?.uid]
  );

  const activateDocument = useCallback(async (): Promise<StrategyDocument> => {
    if (!companyId || !documentId || !user?.uid) {
      throw new Error('Company, document, or user not available');
    }
    const updated = await strategyDocumentService.activateDocument(
      companyId,
      documentId,
      user.uid
    );
    setDocument(updated);
    return updated;
  }, [companyId, documentId, user?.uid]);

  const archiveDocument = useCallback(async (): Promise<StrategyDocument> => {
    if (!companyId || !documentId || !user?.uid) {
      throw new Error('Company, document, or user not available');
    }
    const updated = await strategyDocumentService.archiveDocument(
      companyId,
      documentId,
      user.uid
    );
    setDocument(updated);
    return updated;
  }, [companyId, documentId, user?.uid]);

  // --------------------------------------------------------------------------
  // Pillar Operations
  // --------------------------------------------------------------------------
  const addPillar = useCallback(
    async (input: CreatePillarInput): Promise<StrategicPillar> => {
      if (!companyId || !documentId || !user?.uid) {
        throw new Error('Company, document, or user not available');
      }
      const pillar = await strategyDocumentService.addPillar(
        companyId,
        documentId,
        input,
        user.uid
      );
      await refresh();
      return pillar;
    },
    [companyId, documentId, user?.uid, refresh]
  );

  const updatePillar = useCallback(
    async (pillarId: string, input: UpdatePillarInput): Promise<StrategicPillar> => {
      if (!companyId || !documentId || !user?.uid) {
        throw new Error('Company, document, or user not available');
      }
      const pillar = await strategyDocumentService.updatePillar(
        companyId,
        documentId,
        pillarId,
        input,
        user.uid
      );
      await refresh();
      return pillar;
    },
    [companyId, documentId, user?.uid, refresh]
  );

  const removePillar = useCallback(
    async (pillarId: string): Promise<void> => {
      if (!companyId || !documentId || !user?.uid) {
        throw new Error('Company, document, or user not available');
      }
      await strategyDocumentService.removePillar(companyId, documentId, pillarId, user.uid);
      await refresh();
    },
    [companyId, documentId, user?.uid, refresh]
  );

  const reorderPillars = useCallback(
    async (pillarIds: string[]): Promise<void> => {
      if (!companyId || !documentId || !user?.uid) {
        throw new Error('Company, document, or user not available');
      }
      await strategyDocumentService.reorderPillars(
        companyId,
        documentId,
        pillarIds,
        user.uid
      );
      await refresh();
    },
    [companyId, documentId, user?.uid, refresh]
  );

  // --------------------------------------------------------------------------
  // Objective Operations
  // --------------------------------------------------------------------------
  const addObjective = useCallback(
    async (input: CreateObjectiveInput): Promise<StrategicObjective> => {
      if (!companyId || !documentId || !user?.uid) {
        throw new Error('Company, document, or user not available');
      }
      const objective = await strategyDocumentService.addObjective(
        companyId,
        documentId,
        input,
        user.uid
      );
      await refresh();
      return objective;
    },
    [companyId, documentId, user?.uid, refresh]
  );

  const updateObjective = useCallback(
    async (
      pillarId: string,
      objectiveId: string,
      input: UpdateObjectiveInput
    ): Promise<StrategicObjective> => {
      if (!companyId || !documentId || !user?.uid) {
        throw new Error('Company, document, or user not available');
      }
      const objective = await strategyDocumentService.updateObjective(
        companyId,
        documentId,
        pillarId,
        objectiveId,
        input,
        user.uid
      );
      await refresh();
      return objective;
    },
    [companyId, documentId, user?.uid, refresh]
  );

  const removeObjective = useCallback(
    async (pillarId: string, objectiveId: string): Promise<void> => {
      if (!companyId || !documentId || !user?.uid) {
        throw new Error('Company, document, or user not available');
      }
      await strategyDocumentService.removeObjective(
        companyId,
        documentId,
        pillarId,
        objectiveId,
        user.uid
      );
      await refresh();
    },
    [companyId, documentId, user?.uid, refresh]
  );

  // --------------------------------------------------------------------------
  // Metric Operations
  // --------------------------------------------------------------------------
  const addMetric = useCallback(
    async (input: CreateMetricInput): Promise<PillarMetric> => {
      if (!companyId || !documentId || !user?.uid) {
        throw new Error('Company, document, or user not available');
      }
      const metric = await strategyDocumentService.addMetric(
        companyId,
        documentId,
        input,
        user.uid
      );
      await refresh();
      return metric;
    },
    [companyId, documentId, user?.uid, refresh]
  );

  const updateMetric = useCallback(
    async (
      pillarId: string,
      metricId: string,
      input: UpdateMetricInput
    ): Promise<PillarMetric> => {
      if (!companyId || !documentId || !user?.uid) {
        throw new Error('Company, document, or user not available');
      }
      const metric = await strategyDocumentService.updateMetric(
        companyId,
        documentId,
        pillarId,
        metricId,
        input,
        user.uid
      );
      await refresh();
      return metric;
    },
    [companyId, documentId, user?.uid, refresh]
  );

  const removeMetric = useCallback(
    async (pillarId: string, metricId: string): Promise<void> => {
      if (!companyId || !documentId || !user?.uid) {
        throw new Error('Company, document, or user not available');
      }
      await strategyDocumentService.removeMetric(
        companyId,
        documentId,
        pillarId,
        metricId,
        user.uid
      );
      await refresh();
    },
    [companyId, documentId, user?.uid, refresh]
  );

  // --------------------------------------------------------------------------
  // Risk Operations
  // --------------------------------------------------------------------------
  const addRisk = useCallback(
    async (input: CreateRiskInput): Promise<StrategyRisk> => {
      if (!companyId || !documentId || !user?.uid) {
        throw new Error('Company, document, or user not available');
      }
      const risk = await strategyDocumentService.addRisk(
        companyId,
        documentId,
        input,
        user.uid
      );
      await refresh();
      return risk;
    },
    [companyId, documentId, user?.uid, refresh]
  );

  const updateRisk = useCallback(
    async (riskId: string, input: UpdateRiskInput): Promise<StrategyRisk> => {
      if (!companyId || !documentId || !user?.uid) {
        throw new Error('Company, document, or user not available');
      }
      const risk = await strategyDocumentService.updateRisk(
        companyId,
        documentId,
        riskId,
        input,
        user.uid
      );
      await refresh();
      return risk;
    },
    [companyId, documentId, user?.uid, refresh]
  );

  const removeRisk = useCallback(
    async (riskId: string): Promise<void> => {
      if (!companyId || !documentId || !user?.uid) {
        throw new Error('Company, document, or user not available');
      }
      await strategyDocumentService.removeRisk(companyId, documentId, riskId, user.uid);
      await refresh();
    },
    [companyId, documentId, user?.uid, refresh]
  );

  // --------------------------------------------------------------------------
  // Version Operations
  // --------------------------------------------------------------------------
  const getVersionHistory = useCallback(async (): Promise<StrategyVersion[]> => {
    if (!companyId || !documentId) {
      throw new Error('Company or document not available');
    }
    return strategyDocumentService.getVersionHistory(companyId, documentId);
  }, [companyId, documentId]);

  const restoreVersion = useCallback(
    async (versionId: string): Promise<StrategyDocument> => {
      if (!companyId || !documentId || !user?.uid) {
        throw new Error('Company, document, or user not available');
      }
      const restored = await strategyDocumentService.restoreVersion(
        companyId,
        documentId,
        versionId,
        user.uid
      );
      setDocument(restored);
      return restored;
    },
    [companyId, documentId, user?.uid]
  );

  // --------------------------------------------------------------------------
  // Summary
  // --------------------------------------------------------------------------
  const getSummary = useCallback(async (): Promise<StrategySummary> => {
    if (!companyId || !documentId) {
      throw new Error('Company or document not available');
    }
    return strategyDocumentService.getStrategySummary(companyId, documentId);
  }, [companyId, documentId]);

  return {
    document,
    loading,
    error,
    refresh,
    updateDocument,
    submitForApproval,
    approveDocument,
    rejectDocument,
    activateDocument,
    archiveDocument,
    addPillar,
    updatePillar,
    removePillar,
    reorderPillars,
    addObjective,
    updateObjective,
    removeObjective,
    addMetric,
    updateMetric,
    removeMetric,
    addRisk,
    updateRisk,
    removeRisk,
    getVersionHistory,
    restoreVersion,
    getSummary,
  };
}

// ----------------------------------------------------------------------------
// ADDITIONAL HOOKS
// ----------------------------------------------------------------------------

/**
 * Hook for managing strategy alignments
 */
export function useStrategyAlignments(options: {
  companyId: string;
  strategyDocumentId?: string;
  pillarId?: string;
  alignedEntityId?: string;
}) {
  const { user } = useAuth();
  const [alignments, setAlignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!options.companyId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await strategyDocumentService.getAlignments(options.companyId, {
        strategyDocumentId: options.strategyDocumentId,
        pillarId: options.pillarId,
        alignedEntityId: options.alignedEntityId,
      });
      setAlignments(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch alignments'));
    } finally {
      setLoading(false);
    }
  }, [
    options.companyId,
    options.strategyDocumentId,
    options.pillarId,
    options.alignedEntityId,
  ]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const createAlignment = useCallback(
    async (input: any) => {
      if (!options.companyId || !user?.uid) {
        throw new Error('Company or user not available');
      }
      const alignment = await strategyDocumentService.createAlignment(
        options.companyId,
        input,
        user.uid
      );
      setAlignments((prev) => [...prev, alignment]);
      return alignment;
    },
    [options.companyId, user?.uid]
  );

  const deleteAlignment = useCallback(
    async (alignmentId: string) => {
      if (!options.companyId) {
        throw new Error('Company not available');
      }
      await strategyDocumentService.deleteAlignment(options.companyId, alignmentId);
      setAlignments((prev) => prev.filter((a) => a.id !== alignmentId));
    },
    [options.companyId]
  );

  return {
    alignments,
    loading,
    error,
    refresh,
    createAlignment,
    deleteAlignment,
  };
}

/**
 * Hook for strategy version history
 */
export function useStrategyVersions(options: {
  companyId: string;
  documentId: string;
}) {
  const [versions, setVersions] = useState<StrategyVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!options.companyId || !options.documentId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await strategyDocumentService.getVersionHistory(
        options.companyId,
        options.documentId
      );
      setVersions(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch versions'));
    } finally {
      setLoading(false);
    }
  }, [options.companyId, options.documentId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    versions,
    loading,
    error,
    refresh,
  };
}
