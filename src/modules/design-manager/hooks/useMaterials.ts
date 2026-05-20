/**
 * useMaterials Hook
 * Subscribe to materials with filtering options
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  subscribeToGlobalMaterials,
  subscribeToCustomerMaterials,
  subscribeToProjectMaterials,
  getMaterialsForProject,
  createGlobalMaterial,
  createCustomerMaterial,
  createProjectMaterial,
  updateMaterial,
  deleteMaterial,
} from '../services/materialService';
import type {
  MaterialListItem,
  MaterialFormData,
  MaterialTier,
  MaterialCategory,
  ResolvedMaterial,
} from '../types/materials';

interface UseMaterialsOptions {
  tier: MaterialTier;
  scopeId?: string; // customerId or projectId
  category?: MaterialCategory;
}

interface UseMaterialsReturn {
  materials: MaterialListItem[];
  loading: boolean;
  error: Error | null;
  filteredMaterials: MaterialListItem[];
}

/**
 * Hook to subscribe to materials at a specific tier
 */
export function useMaterials(options: UseMaterialsOptions): UseMaterialsReturn {
  const [materials, setMaterials] = useState<MaterialListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { tier, scopeId, category } = options;

  useEffect(() => {
    setLoading(true);
    setError(null);

    let unsubscribe: () => void;

    const handleData = (data: MaterialListItem[]) => {
      setMaterials(data);
      setLoading(false);
    };

    const handleError = (err: Error) => {
      setError(err);
      setLoading(false);
    };

    switch (tier) {
      case 'global':
        unsubscribe = subscribeToGlobalMaterials(handleData, handleError, { category });
        break;
      case 'customer':
        if (scopeId) {
          unsubscribe = subscribeToCustomerMaterials(scopeId, handleData, handleError);
        } else {
          setLoading(false);
          unsubscribe = () => {};
        }
        break;
      case 'project':
        if (scopeId) {
          unsubscribe = subscribeToProjectMaterials(scopeId, handleData, handleError);
        } else {
          setLoading(false);
          unsubscribe = () => {};
        }
        break;
      default:
        setLoading(false);
        unsubscribe = () => {};
    }

    return () => unsubscribe();
  }, [tier, scopeId, category]);

  const filteredMaterials = useMemo(() => {
    if (!category) return materials;
    return materials.filter((m) => m.category === category);
  }, [materials, category]);

  return { materials, loading, error, filteredMaterials };
}

interface UseProjectMaterialsReturn {
  materials: ResolvedMaterial[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Hook to get merged materials for a project (all tiers resolved)
 */
export function useProjectMaterials(
  projectId: string,
  customerId?: string
): UseProjectMaterialsReturn {
  const [materials, setMaterials] = useState<ResolvedMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const loadMaterials = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resolved = await getMaterialsForProject(projectId, customerId);
      setMaterials(resolved);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load materials'));
    } finally {
      setLoading(false);
    }
  }, [projectId, customerId]);

  useEffect(() => {
    loadMaterials();
  }, [loadMaterials]);

  return { materials, loading, error, refresh: loadMaterials };
}

interface UseMaterialMutationsReturn {
  creating: boolean;
  updating: boolean;
  deleting: boolean;
  error: Error | null;
  createMaterial: (data: MaterialFormData) => Promise<string>;
  updateMaterial: (materialId: string, data: Partial<MaterialFormData>) => Promise<void>;
  deleteMaterial: (materialId: string) => Promise<void>;
  clearError: () => void;
}

/**
 * Hook for material CRUD mutations
 */
export function useMaterialMutations(
  tier: MaterialTier,
  scopeId: string | undefined,
  userId: string
): UseMaterialMutationsReturn {
  const [creating, setCreating] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const handleCreate = useCallback(
    async (data: MaterialFormData): Promise<string> => {
      setCreating(true);
      setError(null);
      try {
        let id: string;
        switch (tier) {
          case 'global':
            id = await createGlobalMaterial(data, userId);
            break;
          case 'customer':
            if (!scopeId) throw new Error('customerId required');
            id = await createCustomerMaterial(scopeId, data, userId);
            break;
          case 'project':
            if (!scopeId) throw new Error('projectId required');
            id = await createProjectMaterial(scopeId, data, userId);
            break;
          default:
            throw new Error('Invalid tier');
        }
        return id;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to create material');
        setError(error);
        throw error;
      } finally {
        setCreating(false);
      }
    },
    [tier, scopeId, userId]
  );

  const handleUpdate = useCallback(
    async (materialId: string, data: Partial<MaterialFormData>): Promise<void> => {
      setUpdating(true);
      setError(null);
      try {
        await updateMaterial(materialId, tier, scopeId, data, userId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to update material');
        setError(error);
        throw error;
      } finally {
        setUpdating(false);
      }
    },
    [tier, scopeId, userId]
  );

  const handleDelete = useCallback(
    async (materialId: string): Promise<void> => {
      setDeleting(true);
      setError(null);
      try {
        await deleteMaterial(materialId, tier, scopeId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to delete material');
        setError(error);
        throw error;
      } finally {
        setDeleting(false);
      }
    },
    [tier, scopeId]
  );

  const clearError = useCallback(() => setError(null), []);

  return {
    creating,
    updating,
    deleting,
    error,
    createMaterial: handleCreate,
    updateMaterial: handleUpdate,
    deleteMaterial: handleDelete,
    clearError,
  };
}
