/**
 * useFirestore Hook
 * Generic Firestore operations hook
 */

import { useState, useEffect, useCallback } from 'react';
import { 
  subscribeToDocument, 
  subscribeToCollection,
  fetchDocument,
  fetchCollection,
  saveDocument,
  updateDocument,
  removeDocument,
  type QueryConstraint
} from '@/shared/services/firebase';

export interface UseDocumentReturn<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export interface UseCollectionReturn<T> {
  data: T[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook for real-time document subscription
 */
export function useDocument<T>(
  collectionPath: string,
  docId: string | null | undefined
): UseDocumentReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    if (!docId) return;
    try {
      setLoading(true);
      const result = await fetchDocument<T>(collectionPath, docId);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch document'));
    } finally {
      setLoading(false);
    }
  }, [collectionPath, docId]);

  useEffect(() => {
    if (!docId) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToDocument<T>(
      collectionPath,
      docId,
      (doc) => {
        setData(doc);
        setLoading(false);
        setError(null);
      }
    );

    return () => unsubscribe();
  }, [collectionPath, docId]);

  return { data, loading, error, refresh };
}

/**
 * Hook for real-time collection subscription
 */
export function useCollection<T>(
  collectionPath: string,
  constraints: QueryConstraint[] = []
): UseCollectionReturn<T> {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoading(true);
      const result = await fetchCollection<T>(collectionPath, constraints);
      setData(result);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch collection'));
    } finally {
      setLoading(false);
    }
  }, [collectionPath, JSON.stringify(constraints)]);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToCollection<T>(
      collectionPath,
      (docs) => {
        setData(docs);
        setLoading(false);
        setError(null);
      },
      constraints
    );

    return () => unsubscribe();
  }, [collectionPath, JSON.stringify(constraints)]);

  return { data, loading, error, refresh };
}

/**
 * Hook for Firestore mutations
 */
export function useFirestoreMutation<T extends Record<string, unknown>>(collectionPath: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const save = useCallback(async (docId: string, data: T): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      await saveDocument(collectionPath, docId, data);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to save document'));
      return false;
    } finally {
      setLoading(false);
    }
  }, [collectionPath]);

  const update = useCallback(async (docId: string, data: Partial<T>): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      await updateDocument(collectionPath, docId, data);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to update document'));
      return false;
    } finally {
      setLoading(false);
    }
  }, [collectionPath]);

  const remove = useCallback(async (docId: string): Promise<boolean> => {
    try {
      setLoading(true);
      setError(null);
      await removeDocument(collectionPath, docId);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to delete document'));
      return false;
    } finally {
      setLoading(false);
    }
  }, [collectionPath]);

  return { save, update, remove, loading, error };
}
