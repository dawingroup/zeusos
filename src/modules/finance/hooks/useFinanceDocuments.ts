// ============================================================================
// USE FINANCE DOCUMENTS HOOK
// ZeusOS v2.0 - Financial Management Module
// React hook for finance document library management
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import type {
  FinanceDocument,
  FinanceDocumentInput,
  FinanceDocumentFilter,
} from '../types/integrations.types';
import {
  createFinanceDocument,
  getFinanceDocuments,
  updateFinanceDocument,
  deleteFinanceDocument,
  subscribeToFinanceDocuments,
} from '../services/financeAdminService';

export interface UseFinanceDocumentsOptions {
  companyId: string;
  autoLoad?: boolean;
  subscribe?: boolean;
  initialFilter?: FinanceDocumentFilter;
}

export interface UseFinanceDocumentsReturn {
  documents: FinanceDocument[];
  loading: boolean;
  error: string | null;

  // CRUD
  create: (input: FinanceDocumentInput, userId: string, userName: string) => Promise<FinanceDocument>;
  update: (documentId: string, updates: Partial<FinanceDocumentInput> & { status?: string }) => Promise<void>;
  remove: (documentId: string) => Promise<void>;

  // Filter & Search
  filter: FinanceDocumentFilter;
  setFilter: (filter: FinanceDocumentFilter) => void;
  search: string;
  setSearch: (search: string) => void;
  refresh: () => Promise<void>;

  // Computed
  totalCount: number;
  categoryCounts: Record<string, number>;
}

export function useFinanceDocuments({
  companyId,
  autoLoad = true,
  subscribe = true,
  initialFilter,
}: UseFinanceDocumentsOptions): UseFinanceDocumentsReturn {
  const [documents, setDocuments] = useState<FinanceDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FinanceDocumentFilter>(initialFilter || {});
  const [search, setSearch] = useState('');

  // Load documents
  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const mergedFilter = { ...filter, search: search || filter.search };
      const data = await getFinanceDocuments(companyId, mergedFilter);
      setDocuments(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [companyId, filter, search]);

  // Create
  const create = useCallback(
    async (input: FinanceDocumentInput, userId: string, userName: string) => {
      setError(null);
      try {
        const doc = await createFinanceDocument(companyId, input, userId, userName);
        setDocuments((prev) => [doc, ...prev]);
        return doc;
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create document');
        throw err;
      }
    },
    [companyId]
  );

  // Update
  const update = useCallback(
    async (documentId: string, updates: Partial<FinanceDocumentInput> & { status?: string }) => {
      setError(null);
      try {
        await updateFinanceDocument(companyId, documentId, updates);
        setDocuments((prev) =>
          prev.map((d) =>
            d.id === documentId ? ({ ...d, ...updates } as FinanceDocument) : d
          )
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update document');
        throw err;
      }
    },
    [companyId]
  );

  // Remove
  const remove = useCallback(
    async (documentId: string) => {
      try {
        await deleteFinanceDocument(companyId, documentId);
        setDocuments((prev) => prev.filter((d) => d.id !== documentId));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete document');
      }
    },
    [companyId]
  );

  // Category counts
  const categoryCounts = documents.reduce(
    (acc, d) => {
      acc[d.category] = (acc[d.category] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  // Auto-load
  useEffect(() => {
    if (autoLoad && companyId) {
      refresh();
    }
  }, [autoLoad, companyId, refresh]);

  // Subscribe
  useEffect(() => {
    if (!subscribe || !companyId) return;

    const unsub = subscribeToFinanceDocuments(companyId, setDocuments);
    return () => unsub();
  }, [subscribe, companyId]);

  return {
    documents,
    loading,
    error,
    create,
    update,
    remove,
    filter,
    setFilter,
    search,
    setSearch,
    refresh,
    totalCount: documents.length,
    categoryCounts,
  };
}
