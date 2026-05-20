/**
 * useParts Hook
 * Manage parts within a design item
 */

import { useState, useCallback } from 'react';
import {
  addPart,
  updatePart,
  deletePart,
  bulkDeleteParts,
  bulkAddParts,
  bulkUpdateParts,
  replaceAllParts,
} from '../services/partsService';
import type { PartEntry, DesignItem } from '../types';

interface UsePartsReturn {
  loading: boolean;
  error: Error | null;
  add: (partData: Omit<PartEntry, 'id' | 'createdAt' | 'updatedAt'>) => Promise<PartEntry>;
  update: (partId: string, updates: Partial<PartEntry>) => Promise<void>;
  remove: (partId: string) => Promise<void>;
  bulkDelete: (partIds: string[]) => Promise<void>;
  bulkAdd: (partsData: Omit<PartEntry, 'id' | 'createdAt' | 'updatedAt'>[]) => Promise<PartEntry[]>;
  bulkUpdate: (updates: Array<{ partId: string; changes: Partial<PartEntry> }>) => Promise<void>;
  replaceAll: (partsData: Omit<PartEntry, 'id' | 'createdAt' | 'updatedAt'>[]) => Promise<PartEntry[]>;
  clearError: () => void;
}

export function useParts(
  projectId: string,
  item: DesignItem | null,
  userId: string
): UsePartsReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const currentParts = (item as any)?.parts || [];

  const add = useCallback(
    async (partData: Omit<PartEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<PartEntry> => {
      if (!item) throw new Error('No design item');
      setLoading(true);
      setError(null);
      try {
        const part = await addPart(projectId, item.id, partData, currentParts, userId);
        return part;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to add part');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [projectId, item, currentParts, userId]
  );

  const update = useCallback(
    async (partId: string, updates: Partial<PartEntry>): Promise<void> => {
      if (!item) throw new Error('No design item');
      setLoading(true);
      setError(null);
      try {
        await updatePart(projectId, item.id, partId, updates, currentParts, userId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to update part');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [projectId, item, currentParts, userId]
  );

  const remove = useCallback(
    async (partId: string): Promise<void> => {
      if (!item) throw new Error('No design item');
      setLoading(true);
      setError(null);
      try {
        await deletePart(projectId, item.id, partId, currentParts, userId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to delete part');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [projectId, item, currentParts, userId]
  );

  const bulkDelete = useCallback(
    async (partIds: string[]): Promise<void> => {
      if (!item) throw new Error('No design item');
      setLoading(true);
      setError(null);
      try {
        await bulkDeleteParts(projectId, item.id, partIds, currentParts, userId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to delete parts');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [projectId, item, currentParts, userId]
  );

  const bulkAdd = useCallback(
    async (partsData: Omit<PartEntry, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<PartEntry[]> => {
      if (!item) throw new Error('No design item');
      setLoading(true);
      setError(null);
      try {
        const parts = await bulkAddParts(projectId, item.id, partsData, currentParts, userId);
        return parts;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to add parts');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [projectId, item, currentParts, userId]
  );

  const bulkUpdate = useCallback(
    async (updates: Array<{ partId: string; changes: Partial<PartEntry> }>): Promise<void> => {
      if (!item) throw new Error('No design item');
      setLoading(true);
      setError(null);
      try {
        await bulkUpdateParts(projectId, item.id, updates, currentParts, userId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to update parts');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [projectId, item, currentParts, userId]
  );

  const replaceAll = useCallback(
    async (partsData: Omit<PartEntry, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<PartEntry[]> => {
      if (!item) throw new Error('No design item');
      setLoading(true);
      setError(null);
      try {
        const parts = await replaceAllParts(projectId, item.id, partsData, userId);
        return parts;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to replace parts');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    [projectId, item, userId]
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    loading,
    error,
    add,
    update,
    remove,
    bulkDelete,
    bulkAdd,
    bulkUpdate,
    replaceAll,
    clearError,
  };
}
