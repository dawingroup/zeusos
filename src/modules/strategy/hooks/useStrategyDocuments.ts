// ============================================================================
// USE STRATEGY DOCUMENTS HOOK - DawinOS CEO Strategy Command
// React hook for managing strategy documents list
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../../shared/hooks/useAuth';
import { strategyDocumentService } from '../services/strategyDocument.service';
import {
  StrategyDocument,
  StrategyDocumentFilters,
  CreateStrategyDocumentInput,
  UpdateStrategyDocumentInput,
} from '../types/strategy.types';
import {
  StrategyDocumentType,
  StrategyScope,
} from '../constants/strategy.constants';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------
export interface UseStrategyDocumentsOptions {
  companyId: string;
  filters?: StrategyDocumentFilters;
  autoFetch?: boolean;
}

export interface UseStrategyDocumentsReturn {
  documents: StrategyDocument[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  createDocument: (input: CreateStrategyDocumentInput) => Promise<StrategyDocument>;
  updateDocument: (id: string, input: UpdateStrategyDocumentInput) => Promise<StrategyDocument>;
  deleteDocument: (id: string) => Promise<void>;
  submitForApproval: (id: string) => Promise<StrategyDocument>;
  approveDocument: (id: string) => Promise<StrategyDocument>;
  activateDocument: (id: string) => Promise<StrategyDocument>;
  archiveDocument: (id: string) => Promise<StrategyDocument>;
  getActiveGroupStrategy: () => Promise<StrategyDocument | null>;
  // Computed
  activeDocuments: StrategyDocument[];
  draftDocuments: StrategyDocument[];
  documentsByType: Record<StrategyDocumentType, StrategyDocument[]>;
  documentsByScope: Record<StrategyScope, StrategyDocument[]>;
}

// ----------------------------------------------------------------------------
// Hook Implementation
// ----------------------------------------------------------------------------
export function useStrategyDocuments(
  options: UseStrategyDocumentsOptions
): UseStrategyDocumentsReturn {
  const { user } = useAuth();
  const { companyId, filters, autoFetch = true } = options;

  const [documents, setDocuments] = useState<StrategyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // --------------------------------------------------------------------------
  // Fetch Documents
  // --------------------------------------------------------------------------
  const refresh = useCallback(async () => {
    if (!companyId) return;

    setLoading(true);
    setError(null);

    try {
      const result = await strategyDocumentService.getDocuments(companyId, filters);
      setDocuments(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch strategy documents'));
    } finally {
      setLoading(false);
    }
  }, [companyId, JSON.stringify(filters)]);

  useEffect(() => {
    if (autoFetch) {
      refresh();
    }
  }, [refresh, autoFetch]);

  // --------------------------------------------------------------------------
  // CRUD Operations
  // --------------------------------------------------------------------------
  const createDocument = useCallback(
    async (input: CreateStrategyDocumentInput): Promise<StrategyDocument> => {
      if (!companyId || !user?.uid) {
        throw new Error('Company or user not available');
      }
      const doc = await strategyDocumentService.createDocument(companyId, input, user.uid);
      setDocuments((prev) => [doc, ...prev]);
      return doc;
    },
    [companyId, user?.uid]
  );

  const updateDocument = useCallback(
    async (id: string, input: UpdateStrategyDocumentInput): Promise<StrategyDocument> => {
      if (!companyId || !user?.uid) {
        throw new Error('Company or user not available');
      }
      const updated = await strategyDocumentService.updateDocument(
        companyId,
        id,
        input,
        user.uid
      );
      setDocuments((prev) => prev.map((d) => (d.id === id ? updated : d)));
      return updated;
    },
    [companyId, user?.uid]
  );

  const deleteDocument = useCallback(
    async (id: string): Promise<void> => {
      if (!companyId) {
        throw new Error('Company not available');
      }
      await strategyDocumentService.deleteDocument(companyId, id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    },
    [companyId]
  );

  // --------------------------------------------------------------------------
  // Workflow Operations
  // --------------------------------------------------------------------------
  const submitForApproval = useCallback(
    async (id: string): Promise<StrategyDocument> => {
      if (!companyId || !user?.uid) {
        throw new Error('Company or user not available');
      }
      const updated = await strategyDocumentService.submitForApproval(companyId, id, user.uid);
      setDocuments((prev) => prev.map((d) => (d.id === id ? updated : d)));
      return updated;
    },
    [companyId, user?.uid]
  );

  const approveDocument = useCallback(
    async (id: string): Promise<StrategyDocument> => {
      if (!companyId || !user?.uid) {
        throw new Error('Company or user not available');
      }
      const updated = await strategyDocumentService.approveDocument(
        companyId,
        id,
        user.uid,
        user.displayName || undefined
      );
      setDocuments((prev) => prev.map((d) => (d.id === id ? updated : d)));
      return updated;
    },
    [companyId, user?.uid, user?.displayName]
  );

  const activateDocument = useCallback(
    async (id: string): Promise<StrategyDocument> => {
      if (!companyId || !user?.uid) {
        throw new Error('Company or user not available');
      }
      const updated = await strategyDocumentService.activateDocument(companyId, id, user.uid);
      // Refresh to get updated statuses of superseded documents
      await refresh();
      return updated;
    },
    [companyId, user?.uid, refresh]
  );

  const archiveDocument = useCallback(
    async (id: string): Promise<StrategyDocument> => {
      if (!companyId || !user?.uid) {
        throw new Error('Company or user not available');
      }
      const updated = await strategyDocumentService.archiveDocument(companyId, id, user.uid);
      setDocuments((prev) => prev.map((d) => (d.id === id ? updated : d)));
      return updated;
    },
    [companyId, user?.uid]
  );

  const getActiveGroupStrategy = useCallback(async (): Promise<StrategyDocument | null> => {
    if (!companyId) {
      return null;
    }
    return strategyDocumentService.getActiveGroupStrategy(companyId);
  }, [companyId]);

  // --------------------------------------------------------------------------
  // Computed Values
  // --------------------------------------------------------------------------
  const activeDocuments = useMemo(
    () => documents.filter((d) => d.status === 'active'),
    [documents]
  );

  const draftDocuments = useMemo(
    () => documents.filter((d) => d.status === 'draft'),
    [documents]
  );

  const documentsByType = useMemo(() => {
    const byType: Record<string, StrategyDocument[]> = {};
    documents.forEach((doc) => {
      if (!byType[doc.type]) {
        byType[doc.type] = [];
      }
      byType[doc.type].push(doc);
    });
    return byType as Record<StrategyDocumentType, StrategyDocument[]>;
  }, [documents]);

  const documentsByScope = useMemo(() => {
    const byScope: Record<string, StrategyDocument[]> = {};
    documents.forEach((doc) => {
      if (!byScope[doc.scope]) {
        byScope[doc.scope] = [];
      }
      byScope[doc.scope].push(doc);
    });
    return byScope as Record<StrategyScope, StrategyDocument[]>;
  }, [documents]);

  return {
    documents,
    loading,
    error,
    refresh,
    createDocument,
    updateDocument,
    deleteDocument,
    submitForApproval,
    approveDocument,
    activateDocument,
    archiveDocument,
    getActiveGroupStrategy,
    activeDocuments,
    draftDocuments,
    documentsByType,
    documentsByScope,
  };
}

// ----------------------------------------------------------------------------
// ADDITIONAL HOOKS
// ----------------------------------------------------------------------------

/**
 * Hook for fetching strategy documents by subsidiary
 */
export function useSubsidiaryStrategies(options: {
  companyId: string;
  subsidiaryId: string;
  autoFetch?: boolean;
}) {
  return useStrategyDocuments({
    companyId: options.companyId,
    filters: {
      scope: 'subsidiary',
      scopeEntityId: options.subsidiaryId,
    },
    autoFetch: options.autoFetch,
  });
}

/**
 * Hook for fetching active strategies only
 */
export function useActiveStrategies(options: {
  companyId: string;
  scope?: StrategyScope;
  autoFetch?: boolean;
}) {
  return useStrategyDocuments({
    companyId: options.companyId,
    filters: {
      activeOnly: true,
      scope: options.scope,
    },
    autoFetch: options.autoFetch,
  });
}

/**
 * Hook for fetching strategies by fiscal year
 */
export function useFiscalYearStrategies(options: {
  companyId: string;
  fiscalYear: string;
  autoFetch?: boolean;
}) {
  return useStrategyDocuments({
    companyId: options.companyId,
    filters: {
      fiscalYear: options.fiscalYear,
    },
    autoFetch: options.autoFetch,
  });
}
