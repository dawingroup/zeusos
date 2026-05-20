/**
 * BOQ Hooks
 * 
 * React hooks for BOQ management.
 */

import { useState, useEffect, useCallback } from 'react';
import { boqService } from '../services/boq-service';
import type {
  BOQDocument,
  BOQVariation,
  BOQDocumentStatus,
  CreateBOQInput,
  CreateSectionInput,
  CreateItemInput
} from '../types/boq';

// ============================================================================
// BOQ DOCUMENT HOOKS
// ============================================================================

/**
 * Hook for fetching a single BOQ
 */
export function useBOQ(boqId: string | undefined) {
  const [boq, setBOQ] = useState<BOQDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchBOQ = useCallback(async () => {
    if (!boqId) {
      setBOQ(null);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const data = await boqService.getBOQ(boqId);
      setBOQ(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch BOQ'));
    } finally {
      setLoading(false);
    }
  }, [boqId]);
  
  useEffect(() => {
    fetchBOQ();
  }, [fetchBOQ]);
  
  return { boq, loading, error, refetch: fetchBOQ };
}

/**
 * Hook for fetching BOQs for a project
 */
export function useProjectBOQs(projectId: string | undefined) {
  const [boqs, setBOQs] = useState<BOQDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchBOQs = useCallback(async () => {
    if (!projectId) {
      setBOQs([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const data = await boqService.getBOQsForProject(projectId);
      setBOQs(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch BOQs'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);
  
  useEffect(() => {
    fetchBOQs();
  }, [fetchBOQs]);
  
  return { boqs, loading, error, refetch: fetchBOQs };
}

/**
 * Hook for BOQ mutations
 */
export function useBOQMutations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const createBOQ = useCallback(async (input: CreateBOQInput, userId: string) => {
    try {
      setLoading(true);
      setError(null);
      const id = await boqService.createBOQ(input, userId);
      return id;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create BOQ');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const updateBOQStatus = useCallback(async (
    boqId: string,
    status: BOQDocumentStatus,
    userId: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      await boqService.updateBOQStatus(boqId, status, userId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update BOQ status');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const approveBOQ = useCallback(async (
    boqId: string,
    userId: string,
    notes?: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      await boqService.approveBOQ(boqId, userId, notes);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to approve BOQ');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  return {
    loading,
    error,
    createBOQ,
    updateBOQStatus,
    approveBOQ
  };
}

// ============================================================================
// SECTION HOOKS
// ============================================================================

/**
 * Hook for section mutations
 */
export function useSectionMutations(boqId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const addSection = useCallback(async (input: CreateSectionInput, userId: string) => {
    try {
      setLoading(true);
      setError(null);
      const id = await boqService.addSection(boqId, input, userId);
      return id;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to add section');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [boqId]);
  
  const updateSection = useCallback(async (
    sectionId: string,
    updates: Partial<CreateSectionInput>,
    userId: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      await boqService.updateSection(boqId, sectionId, updates, userId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update section');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [boqId]);
  
  const deleteSection = useCallback(async (sectionId: string, userId: string) => {
    try {
      setLoading(true);
      setError(null);
      await boqService.deleteSection(boqId, sectionId, userId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to delete section');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [boqId]);
  
  return {
    loading,
    error,
    addSection,
    updateSection,
    deleteSection
  };
}

// ============================================================================
// ITEM HOOKS
// ============================================================================

/**
 * Hook for item mutations
 */
export function useItemMutations(boqId: string) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const addItem = useCallback(async (
    sectionId: string,
    input: CreateItemInput,
    userId: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      const id = await boqService.addItem(boqId, sectionId, input, userId);
      return id;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to add item');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [boqId]);
  
  const updateItem = useCallback(async (
    sectionId: string,
    itemId: string,
    updates: Partial<CreateItemInput>,
    userId: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      await boqService.updateItem(boqId, sectionId, itemId, updates, userId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update item');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [boqId]);
  
  const deleteItem = useCallback(async (
    sectionId: string,
    itemId: string,
    userId: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      await boqService.deleteItem(boqId, sectionId, itemId, userId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to delete item');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [boqId]);
  
  const bulkAddItems = useCallback(async (
    items: Array<{ sectionId: string; item: CreateItemInput }>,
    userId: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      const ids = await boqService.bulkAddItems(boqId, items, userId);
      return ids;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to bulk add items');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, [boqId]);
  
  return {
    loading,
    error,
    addItem,
    updateItem,
    deleteItem,
    bulkAddItems
  };
}

// ============================================================================
// VARIATION HOOKS
// ============================================================================

/**
 * Hook for fetching BOQ variations
 */
export function useBOQVariations(boqId: string | undefined) {
  const [variations, setVariations] = useState<BOQVariation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchVariations = useCallback(async () => {
    if (!boqId) {
      setVariations([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const data = await boqService.getVariationsForBOQ(boqId);
      setVariations(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch variations'));
    } finally {
      setLoading(false);
    }
  }, [boqId]);
  
  useEffect(() => {
    fetchVariations();
  }, [fetchVariations]);
  
  return { variations, loading, error, refetch: fetchVariations };
}

/**
 * Hook for variation mutations
 */
export function useVariationMutations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const createVariation = useCallback(async (
    originalBoqId: string,
    variation: Omit<BOQVariation, 'id' | 'originalBoqId' | 'status' | 'audit'>,
    userId: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      const id = await boqService.createVariation(originalBoqId, variation, userId);
      return id;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create variation');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const submitVariation = useCallback(async (variationId: string, userId: string) => {
    try {
      setLoading(true);
      setError(null);
      await boqService.submitVariation(variationId, userId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to submit variation');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const approveAndApplyVariation = useCallback(async (
    variationId: string,
    userId: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      await boqService.approveAndApplyVariation(variationId, userId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to approve variation');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const rejectVariation = useCallback(async (
    variationId: string,
    userId: string,
    reason: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      await boqService.rejectVariation(variationId, userId, reason);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to reject variation');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  return {
    loading,
    error,
    createVariation,
    submitVariation,
    approveAndApplyVariation,
    rejectVariation
  };
}
