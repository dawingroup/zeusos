/**
 * useComplianceDocuments Hook
 * Manages compliance document state with CRUD, file upload,
 * checklist tracking, and status changes with history.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  getComplianceDocuments,
  createComplianceDocument,
  updateComplianceDocument,
  deleteComplianceDocument,
  uploadDocumentFile,
  scanAndUpdateStatuses,
  ensureTemplatesExist,
  toggleChecklistItem,
  changeDocumentStatus,
} from '../services/complianceDocumentService';
import type {
  ComplianceDocument,
  ComplianceDocumentInput,
  ComplianceDocumentStatus,
  DocumentFilters,
} from '../types';

interface UseComplianceDocumentsReturn {
  documents: ComplianceDocument[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  create: (input: Partial<ComplianceDocumentInput>) => Promise<ComplianceDocument>;
  update: (id: string, updates: Partial<ComplianceDocument>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  uploadFile: (documentId: string, file: File) => Promise<{ fileUrl: string; storagePath: string }>;
  scanStatuses: () => Promise<void>;
  toggleChecklist: (docId: string, itemId: string) => Promise<ComplianceDocument>;
  changeStatus: (docId: string, newStatus: ComplianceDocumentStatus) => Promise<void>;
}

export function useComplianceDocuments(
  companyId: string,
  filters?: DocumentFilters
): UseComplianceDocumentsReturn {
  const [documents, setDocuments] = useState<ComplianceDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      await ensureTemplatesExist(companyId);
      const docs = await getComplianceDocuments(companyId, filters);
      setDocuments(docs);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [companyId, filters?.status, filters?.category, filters?.regulatoryBody, filters?.search]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const create = useCallback(
    async (input: Partial<ComplianceDocumentInput>) => {
      const doc = await createComplianceDocument({ ...input, companyId });
      await refresh();
      return doc;
    },
    [companyId, refresh]
  );

  const update = useCallback(
    async (id: string, updates: Partial<ComplianceDocument>) => {
      await updateComplianceDocument(id, updates);
      await refresh();
    },
    [refresh]
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteComplianceDocument(id);
      await refresh();
    },
    [refresh]
  );

  const uploadFileFn = useCallback(
    async (documentId: string, file: File) => {
      const existing = documents.find(d => d.id === documentId);
      const result = await uploadDocumentFile(
        documentId,
        companyId,
        existing?.category || 'business',
        existing?.documentType || 'general',
        file
      );
      await refresh();
      return result;
    },
    [companyId, documents, refresh]
  );

  const scanStatuses = useCallback(async () => {
    if (!companyId) return;
    await scanAndUpdateStatuses(companyId);
    await refresh();
  }, [companyId, refresh]);

  const toggleChecklistFn = useCallback(
    async (docId: string, itemId: string) => {
      const updated = await toggleChecklistItem(docId, itemId, 'current_user');
      setDocuments(prev =>
        prev.map(d => (d.id === docId ? updated : d))
      );
      return updated;
    },
    []
  );

  const changeStatusFn = useCallback(
    async (docId: string, newStatus: ComplianceDocumentStatus) => {
      await changeDocumentStatus(docId, newStatus, 'current_user');
      await refresh();
    },
    [refresh]
  );

  return {
    documents,
    loading,
    error,
    refresh,
    create,
    update,
    remove,
    uploadFile: uploadFileFn,
    scanStatuses,
    toggleChecklist: toggleChecklistFn,
    changeStatus: changeStatusFn,
  };
}
