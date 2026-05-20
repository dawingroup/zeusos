/**
 * Material Hooks
 * 
 * React hooks for material management.
 */

import { useState, useEffect, useCallback } from 'react';
import { materialService } from '../services/material-service';
import type {
  Material,
  ProjectMaterial,
  MaterialTransfer,
  MaterialCategoryExtended,
  CreateMaterialInput,
  CreateProjectMaterialInput
} from '../types/material';
import type { BOQMoney } from '../types/boq';

// ============================================================================
// MATERIAL LIBRARY HOOKS
// ============================================================================

/**
 * Hook for fetching a single material
 */
export function useMaterial(materialId: string | undefined) {
  const [material, setMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchMaterial = useCallback(async () => {
    if (!materialId) {
      setMaterial(null);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const data = await materialService.getMaterial(materialId);
      setMaterial(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch material'));
    } finally {
      setLoading(false);
    }
  }, [materialId]);
  
  useEffect(() => {
    fetchMaterial();
  }, [fetchMaterial]);
  
  return { material, loading, error, refetch: fetchMaterial };
}

/**
 * Hook for fetching all materials
 */
export function useMaterials() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchMaterials = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await materialService.getAllMaterials();
      setMaterials(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch materials'));
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);
  
  return { materials, loading, error, refetch: fetchMaterials };
}

/**
 * Hook for fetching materials by category
 */
export function useMaterialsByCategory(category: MaterialCategoryExtended | undefined) {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchMaterials = useCallback(async () => {
    if (!category) {
      setMaterials([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const data = await materialService.getMaterialsByCategory(category);
      setMaterials(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch materials'));
    } finally {
      setLoading(false);
    }
  }, [category]);
  
  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);
  
  return { materials, loading, error, refetch: fetchMaterials };
}

/**
 * Hook for searching materials
 */
export function useMaterialSearch(searchQuery: string) {
  const [results, setResults] = useState<Material[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([]);
      return;
    }
    
    const searchMaterials = async () => {
      try {
        setLoading(true);
        setError(null);
        const data = await materialService.searchMaterials(searchQuery);
        setResults(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to search materials'));
      } finally {
        setLoading(false);
      }
    };
    
    const debounceTimer = setTimeout(searchMaterials, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchQuery]);
  
  return { results, loading, error };
}

/**
 * Hook for material mutations
 */
export function useMaterialMutations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const createMaterial = useCallback(async (input: CreateMaterialInput, userId: string) => {
    try {
      setLoading(true);
      setError(null);
      const id = await materialService.createMaterial(input, userId);
      return id;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create material');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const updateMaterial = useCallback(async (
    materialId: string,
    updates: Partial<Omit<Material, 'id' | 'audit'>>,
    userId: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      await materialService.updateMaterial(materialId, updates, userId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update material');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const updateMaterialRate = useCallback(async (
    materialId: string,
    newRate: BOQMoney,
    source: 'standard' | 'purchase' | 'quotation' | 'estimate',
    userId: string,
    supplierId?: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      await materialService.updateMaterialRate(materialId, newRate, source, userId, supplierId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update material rate');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const deactivateMaterial = useCallback(async (materialId: string, userId: string) => {
    try {
      setLoading(true);
      setError(null);
      await materialService.deactivateMaterial(materialId, userId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to deactivate material');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  return {
    loading,
    error,
    createMaterial,
    updateMaterial,
    updateMaterialRate,
    deactivateMaterial
  };
}

// ============================================================================
// PROJECT MATERIAL HOOKS
// ============================================================================

/**
 * Hook for fetching project materials
 */
export function useProjectMaterials(projectId: string | undefined) {
  const [materials, setMaterials] = useState<ProjectMaterial[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchMaterials = useCallback(async () => {
    if (!projectId) {
      setMaterials([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const data = await materialService.getProjectMaterials(projectId);
      setMaterials(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch project materials'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);
  
  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);
  
  return { materials, loading, error, refetch: fetchMaterials };
}

/**
 * Hook for project material mutations
 */
export function useProjectMaterialMutations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const addProjectMaterial = useCallback(async (
    input: CreateProjectMaterialInput,
    userId: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      const id = await materialService.addProjectMaterial(input, userId);
      return id;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to add project material');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const updateQuantities = useCallback(async (
    projectMaterialId: string,
    quantities: Partial<Pick<ProjectMaterial, 
      'requisitionedQuantity' | 'orderedQuantity' | 'deliveredQuantity' | 'usedQuantity' | 'wasteQuantity'
    >>,
    userId: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      await materialService.updateProjectMaterialQuantities(projectMaterialId, quantities, userId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update quantities');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const updateActualCost = useCallback(async (
    projectMaterialId: string,
    actualRate: BOQMoney,
    userId: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      await materialService.updateProjectMaterialActualCost(projectMaterialId, actualRate, userId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update actual cost');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  return {
    loading,
    error,
    addProjectMaterial,
    updateQuantities,
    updateActualCost
  };
}

// ============================================================================
// TRANSFER HOOKS
// ============================================================================

/**
 * Hook for fetching project transfers
 */
export function useProjectTransfers(projectId: string | undefined) {
  const [transfers, setTransfers] = useState<MaterialTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchTransfers = useCallback(async () => {
    if (!projectId) {
      setTransfers([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const data = await materialService.getTransfersForProject(projectId);
      setTransfers(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch transfers'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);
  
  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);
  
  return { transfers, loading, error, refetch: fetchTransfers };
}

/**
 * Hook for transfer mutations
 */
export function useTransferMutations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const createTransfer = useCallback(async (
    transfer: Omit<MaterialTransfer, 'id' | 'status' | 'audit'>,
    userId: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      const id = await materialService.createTransfer(transfer, userId);
      return id;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create transfer');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const approveTransfer = useCallback(async (transferId: string, userId: string) => {
    try {
      setLoading(true);
      setError(null);
      await materialService.approveTransfer(transferId, userId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to approve transfer');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const receiveTransfer = useCallback(async (
    transferId: string,
    receivedQuantities: { materialId: string; receivedQuantity: number }[],
    userId: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      await materialService.receiveTransfer(transferId, receivedQuantities, userId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to receive transfer');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  return {
    loading,
    error,
    createTransfer,
    approveTransfer,
    receiveTransfer
  };
}
