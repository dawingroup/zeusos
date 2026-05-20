/**
 * DOCUMENT HOOKS
 * 
 * React hooks for consuming document service functionality.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { documentService } from './document-service';
import {
  Document,
  DocumentVersion,
  DocumentActivity,
  DocumentFolder,
  DocumentFilters,
  DocumentSort,
  DocumentUploadRequest,
  BatchUploadRequest,
  UploadProgress,
  UploadResult,
  BatchUploadResult,
  DocumentStatus,
  DocumentAccessLevel,
  CreateShareLinkRequest,
  DocumentShareLink,
} from './document-types';

// ============================================================================
// Single Document Hook
// ============================================================================

interface UseDocumentOptions {
  realtime?: boolean;
}

interface UseDocumentResult {
  document: Document | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch a single document
 */
export function useDocument(
  engagementId: string | undefined,
  documentId: string | undefined,
  options: UseDocumentOptions = {}
): UseDocumentResult {
  const { realtime = false } = options;
  const [document, setDocument] = useState<Document | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchDocument = useCallback(async () => {
    if (!engagementId || !documentId) {
      setDocument(null);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const doc = await documentService.getDocument(documentId, engagementId);
      setDocument(doc);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch document'));
    } finally {
      setLoading(false);
    }
  }, [engagementId, documentId]);
  
  useEffect(() => {
    if (!engagementId || !documentId) {
      setDocument(null);
      setLoading(false);
      return;
    }
    
    if (realtime) {
      setLoading(true);
      const unsubscribe = documentService.subscribeToDocument(
        engagementId,
        documentId,
        (doc) => {
          setDocument(doc);
          setLoading(false);
        }
      );
      return () => unsubscribe();
    } else {
      fetchDocument();
    }
  }, [engagementId, documentId, realtime, fetchDocument]);
  
  return { document, loading, error, refetch: fetchDocument };
}

// ============================================================================
// Document List Hook
// ============================================================================

interface UseDocumentsOptions {
  sort?: DocumentSort;
  pageSize?: number;
  realtime?: boolean;
}

interface UseDocumentsResult {
  documents: Document[];
  loading: boolean;
  error: Error | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch documents with filters
 */
export function useDocuments(
  filters: DocumentFilters,
  options: UseDocumentsOptions = {}
): UseDocumentsResult {
  const { 
    sort = { field: 'uploadedAt', direction: 'desc' },
    pageSize = 20,
    realtime = false,
  } = options;
  
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [cursor, setCursor] = useState<string | undefined>();
  
  const filtersKey = JSON.stringify(filters);
  const sortKey = JSON.stringify(sort);

  const fetchDocuments = useCallback(async (loadMore = false) => {
    if (!filters.engagementId) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    try {
      if (!loadMore) {
        setLoading(true);
        setCursor(undefined);
      }
      setError(null);
      
      const result = await documentService.listDocuments(
        filters,
        sort,
        pageSize,
        loadMore ? cursor : undefined
      );
      
      if (loadMore) {
        setDocuments((prev) => [...prev, ...result.documents]);
      } else {
        setDocuments(result.documents);
      }
      
      setHasMore(result.hasMore);
      setCursor(result.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch documents'));
    } finally {
      setLoading(false);
    }
  }, [filtersKey, sortKey, pageSize, cursor]);
  
  useEffect(() => {
    if (!filters.engagementId) {
      setDocuments([]);
      setLoading(false);
      return;
    }

    if (realtime) {
      setLoading(true);
      const unsubscribe = documentService.subscribeToDocuments(
        filters.engagementId,
        filters,
        (docs) => {
          setDocuments(docs);
          setLoading(false);
        }
      );
      return () => unsubscribe();
    } else {
      fetchDocuments();
    }
  }, [filters.engagementId, filtersKey, realtime]);
  
  const loadMore = useCallback(async () => {
    if (hasMore && !loading) {
      await fetchDocuments(true);
    }
  }, [hasMore, loading, fetchDocuments]);
  
  return {
    documents,
    loading,
    error,
    hasMore,
    loadMore,
    refetch: () => fetchDocuments(false),
  };
}

// ============================================================================
// Entity Documents Hook
// ============================================================================

/**
 * Hook to fetch documents for a specific entity
 */
export function useEntityDocuments(
  engagementId: string | undefined,
  entityType: string | undefined,
  entityId: string | undefined
): UseDocumentsResult {
  const filters = useMemo(() => ({
    engagementId,
    entityType,
    entityId,
    isLatest: true,
  }), [engagementId, entityType, entityId]);
  
  return useDocuments(filters, { realtime: true });
}

// ============================================================================
// Document Upload Hook
// ============================================================================

interface UseDocumentUploadResult {
  upload: (request: DocumentUploadRequest) => Promise<UploadResult>;
  uploadBatch: (request: BatchUploadRequest) => Promise<BatchUploadResult>;
  progress: Record<string, UploadProgress>;
  uploading: boolean;
  error: Error | null;
}

/**
 * Hook for document uploads
 */
export function useDocumentUpload(): UseDocumentUploadResult {
  const [progress, setProgress] = useState<Record<string, UploadProgress>>({});
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const upload = useCallback(async (request: DocumentUploadRequest): Promise<UploadResult> => {
    try {
      setUploading(true);
      setError(null);
      
      const result = await documentService.uploadDocument(request, (prog) => {
        setProgress((prev) => ({
          ...prev,
          [request.file.name]: prog,
        }));
      });
      
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Upload failed');
      setError(error);
      return { success: false, error: error.message };
    } finally {
      setUploading(false);
    }
  }, []);
  
  const uploadBatch = useCallback(async (request: BatchUploadRequest): Promise<BatchUploadResult> => {
    try {
      setUploading(true);
      setError(null);
      
      const result = await documentService.uploadDocuments(request, (fileName, prog) => {
        setProgress((prev) => ({
          ...prev,
          [fileName]: prog,
        }));
      });
      
      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Batch upload failed');
      setError(error);
      return {
        total: request.files.length,
        successful: 0,
        failed: request.files.length,
        results: request.files.map((f) => ({
          fileName: f.name,
          success: false,
          error: error.message,
        })),
      };
    } finally {
      setUploading(false);
    }
  }, []);
  
  return { upload, uploadBatch, progress, uploading, error };
}

// ============================================================================
// Document Mutations Hook
// ============================================================================

interface UseDocumentMutationsResult {
  updateDocument: (
    engagementId: string,
    documentId: string,
    updates: Partial<Document>
  ) => Promise<Document>;
  updateStatus: (
    engagementId: string,
    documentId: string,
    status: DocumentStatus,
    comments?: string
  ) => Promise<Document>;
  archiveDocument: (engagementId: string, documentId: string) => Promise<void>;
  restoreDocument: (engagementId: string, documentId: string) => Promise<void>;
  deleteDocument: (engagementId: string, documentId: string) => Promise<void>;
  createNewVersion: (
    engagementId: string,
    previousDocumentId: string,
    file: File,
    options?: { versionLabel?: string; changeDescription?: string }
  ) => Promise<UploadResult>;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook for document mutations
 */
export function useDocumentMutations(): UseDocumentMutationsResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const updateDocument = useCallback(async (
    engagementId: string,
    documentId: string,
    updates: Partial<Document>
  ): Promise<Document> => {
    try {
      setLoading(true);
      setError(null);
      return await documentService.updateDocument(engagementId, documentId, updates);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Update failed');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const updateStatus = useCallback(async (
    engagementId: string,
    documentId: string,
    status: DocumentStatus,
    comments?: string
  ): Promise<Document> => {
    try {
      setLoading(true);
      setError(null);
      return await documentService.updateDocumentStatus(engagementId, documentId, status, comments);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Status update failed');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const archiveDocument = useCallback(async (
    engagementId: string,
    documentId: string
  ): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      await documentService.archiveDocument(engagementId, documentId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Archive failed');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const restoreDocument = useCallback(async (
    engagementId: string,
    documentId: string
  ): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      await documentService.restoreDocument(engagementId, documentId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Restore failed');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const deleteDocument = useCallback(async (
    engagementId: string,
    documentId: string
  ): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      await documentService.deleteDocument(engagementId, documentId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Delete failed');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const createNewVersion = useCallback(async (
    engagementId: string,
    previousDocumentId: string,
    file: File,
    options?: { versionLabel?: string; changeDescription?: string }
  ): Promise<UploadResult> => {
    try {
      setLoading(true);
      setError(null);
      return await documentService.createNewVersion(engagementId, previousDocumentId, file, options);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Version creation failed');
      setError(error);
      return { success: false, error: error.message };
    } finally {
      setLoading(false);
    }
  }, []);
  
  return {
    updateDocument,
    updateStatus,
    archiveDocument,
    restoreDocument,
    deleteDocument,
    createNewVersion,
    loading,
    error,
  };
}

// ============================================================================
// Version History Hook
// ============================================================================

interface UseVersionHistoryResult {
  versions: DocumentVersion[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch document version history
 */
export function useVersionHistory(
  engagementId: string | undefined,
  documentId: string | undefined
): UseVersionHistoryResult {
  const [versions, setVersions] = useState<DocumentVersion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchVersions = useCallback(async () => {
    if (!engagementId || !documentId) {
      setVersions([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const result = await documentService.getVersionHistory(engagementId, documentId);
      setVersions(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch versions'));
    } finally {
      setLoading(false);
    }
  }, [engagementId, documentId]);
  
  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);
  
  return { versions, loading, error, refetch: fetchVersions };
}

// ============================================================================
// Document Activity Hook
// ============================================================================

interface UseDocumentActivityResult {
  activities: DocumentActivity[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to fetch document activity log
 */
export function useDocumentActivity(
  engagementId: string | undefined,
  documentId: string | undefined,
  limitCount: number = 50
): UseDocumentActivityResult {
  const [activities, setActivities] = useState<DocumentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchActivity = useCallback(async () => {
    if (!engagementId || !documentId) {
      setActivities([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const result = await documentService.getDocumentActivity(engagementId, documentId, limitCount);
      setActivities(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch activity'));
    } finally {
      setLoading(false);
    }
  }, [engagementId, documentId, limitCount]);
  
  useEffect(() => {
    fetchActivity();
  }, [fetchActivity]);
  
  return { activities, loading, error, refetch: fetchActivity };
}

// ============================================================================
// Folder Hooks
// ============================================================================

interface UseFoldersResult {
  folders: DocumentFolder[];
  loading: boolean;
  error: Error | null;
  createFolder: (name: string, options?: {
    parentId?: string;
    description?: string;
    color?: string;
  }) => Promise<DocumentFolder>;
  deleteFolder: (folderId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * Hook for folder management
 */
export function useFolders(
  engagementId: string | undefined,
  parentId?: string
): UseFoldersResult {
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchFolders = useCallback(async () => {
    if (!engagementId) {
      setFolders([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const result = await documentService.listFolders(engagementId, parentId);
      setFolders(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch folders'));
    } finally {
      setLoading(false);
    }
  }, [engagementId, parentId]);
  
  useEffect(() => {
    fetchFolders();
  }, [fetchFolders]);
  
  const createFolder = useCallback(async (
    name: string,
    options?: { parentId?: string; description?: string; color?: string }
  ): Promise<DocumentFolder> => {
    if (!engagementId) throw new Error('Engagement ID required');
    
    const folder = await documentService.createFolder(engagementId, name, options);
    await fetchFolders();
    return folder;
  }, [engagementId, fetchFolders]);
  
  const deleteFolder = useCallback(async (folderId: string): Promise<void> => {
    if (!engagementId) throw new Error('Engagement ID required');
    
    await documentService.deleteFolder(engagementId, folderId);
    await fetchFolders();
  }, [engagementId, fetchFolders]);
  
  return { folders, loading, error, createFolder, deleteFolder, refetch: fetchFolders };
}

// ============================================================================
// Share Link Hooks
// ============================================================================

interface UseShareLinkResult {
  createShareLink: (
    engagementId: string,
    request: CreateShareLinkRequest
  ) => Promise<DocumentShareLink>;
  revokeShareLink: (engagementId: string, shareLinkId: string) => Promise<void>;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook for share link management
 */
export function useShareLink(): UseShareLinkResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const createShareLink = useCallback(async (
    engagementId: string,
    request: CreateShareLinkRequest
  ): Promise<DocumentShareLink> => {
    try {
      setLoading(true);
      setError(null);
      return await documentService.createShareLink(engagementId, request);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create share link');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const revokeShareLink = useCallback(async (
    engagementId: string,
    shareLinkId: string
  ): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      await documentService.revokeShareLink(engagementId, shareLinkId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to revoke share link');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  return { createShareLink, revokeShareLink, loading, error };
}

// ============================================================================
// Document Search Hook
// ============================================================================

interface UseDocumentSearchResult {
  results: Document[];
  search: (term: string) => Promise<void>;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook for document search
 */
export function useDocumentSearch(engagementId: string | undefined): UseDocumentSearchResult {
  const [results, setResults] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const search = useCallback(async (term: string): Promise<void> => {
    if (!engagementId || !term.trim()) {
      setResults([]);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const docs = await documentService.searchDocuments(engagementId, term);
      setResults(docs);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Search failed'));
    } finally {
      setLoading(false);
    }
  }, [engagementId]);
  
  return { results, search, loading, error };
}

// ============================================================================
// Document Access Hook
// ============================================================================

interface UseDocumentAccessResult {
  updateAccess: (
    engagementId: string,
    documentId: string,
    accessLevel: DocumentAccessLevel,
    allowedUsers?: string[],
    allowedRoles?: string[]
  ) => Promise<void>;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook for managing document access
 */
export function useDocumentAccess(): UseDocumentAccessResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const updateAccess = useCallback(async (
    engagementId: string,
    documentId: string,
    accessLevel: DocumentAccessLevel,
    allowedUsers?: string[],
    allowedRoles?: string[]
  ): Promise<void> => {
    try {
      setLoading(true);
      setError(null);
      await documentService.updateDocumentAccess(
        engagementId,
        documentId,
        accessLevel,
        allowedUsers,
        allowedRoles
      );
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update access');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  return { updateAccess, loading, error };
}

// ============================================================================
// Document Stats Hook
// ============================================================================

interface DocumentStats {
  total: number;
  byCategory: Record<string, number>;
  byStatus: Record<string, number>;
  totalSize: number;
}

interface UseDocumentStatsResult {
  stats: DocumentStats;
  loading: boolean;
}

/**
 * Hook to get document statistics
 */
export function useDocumentStats(documents: Document[]): UseDocumentStatsResult {
  const stats = useMemo(() => {
    const byCategory: Record<string, number> = {};
    const byStatus: Record<string, number> = {};
    let totalSize = 0;

    for (const doc of documents) {
      byCategory[doc.category] = (byCategory[doc.category] || 0) + 1;
      byStatus[doc.status] = (byStatus[doc.status] || 0) + 1;
      totalSize += doc.fileSize;
    }

    return {
      total: documents.length,
      byCategory,
      byStatus,
      totalSize,
    };
  }, [documents]);

  return { stats, loading: false };
}
