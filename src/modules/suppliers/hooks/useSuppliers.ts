/**
 * Unified Supplier Hooks
 *
 * React hooks for supplier management with subsidiary filtering.
 *
 * Migrated from: src/subsidiaries/advisory/matflow/hooks/supplier-hooks.ts
 */

import { useState, useEffect, useCallback } from 'react';
import type { Supplier, SupplierStatus, CreateSupplierInput, SubsidiaryId } from '../types/supplier';
import { supplierService } from '../services/supplierService';

// ============================================================================
// USE SUPPLIER
// ============================================================================

export interface UseSupplierReturn {
  supplier: Supplier | null;
  loading: boolean;
  error: string | null;
  updateSupplier: (updates: Partial<Supplier>) => Promise<void>;
  deactivate: (reason: string) => Promise<void>;
  reactivate: () => Promise<void>;
}

export const useSupplier = (supplierId: string | null, userId: string): UseSupplierReturn => {
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supplierId) {
      setSupplier(null);
      return;
    }

    setLoading(true);

    const unsubscribe = supplierService.subscribeToSupplier(supplierId, (updatedSupplier) => {
      setSupplier(updatedSupplier);
      setLoading(false);
    });

    return unsubscribe;
  }, [supplierId]);

  const updateSupplier = useCallback(
    async (updates: Partial<Supplier>) => {
      if (!supplierId) return;

      setError(null);
      try {
        await supplierService.updateSupplier(supplierId, updates, userId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update');
        throw err;
      }
    },
    [supplierId, userId]
  );

  const deactivate = useCallback(
    async (reason: string) => {
      if (!supplierId) return;

      setError(null);
      try {
        await supplierService.deactivateSupplier(supplierId, userId, reason);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to deactivate');
        throw err;
      }
    },
    [supplierId, userId]
  );

  const reactivate = useCallback(async () => {
    if (!supplierId) return;

    setError(null);
    try {
      await supplierService.reactivateSupplier(supplierId, userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reactivate');
      throw err;
    }
  }, [supplierId, userId]);

  return {
    supplier,
    loading,
    error,
    updateSupplier,
    deactivate,
    reactivate,
  };
};

// ============================================================================
// USE SUPPLIERS
// ============================================================================

export interface UseSuppliersReturn {
  suppliers: Supplier[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export interface UseSuppliersOptions {
  status?: SupplierStatus;
  category?: string;
  minRating?: number;
  subsidiaryId?: SubsidiaryId;
}

export const useSuppliers = (options?: UseSuppliersOptions): UseSuppliersReturn => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const results = await supplierService.getSuppliers({
        status: options?.status,
        category: options?.category,
        minRating: options?.minRating,
        subsidiaryId: options?.subsidiaryId,
      });
      setSuppliers(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch suppliers');
    } finally {
      setLoading(false);
    }
  }, [options?.status, options?.category, options?.minRating, options?.subsidiaryId]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  return {
    suppliers,
    loading,
    error,
    refresh: fetchSuppliers,
  };
};

// ============================================================================
// USE ACTIVE SUPPLIERS
// ============================================================================

export const useActiveSuppliers = (subsidiaryId?: SubsidiaryId): UseSuppliersReturn => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);

    const unsubscribe = supplierService.subscribeToSuppliers(
      (updatedSuppliers) => {
        setSuppliers(updatedSuppliers);
        setLoading(false);
      },
      'active',
      subsidiaryId
    );

    return unsubscribe;
  }, [subsidiaryId]);

  const refresh = useCallback(() => {
    setLoading(true);
  }, []);

  return {
    suppliers,
    loading,
    error,
    refresh,
  };
};

// ============================================================================
// USE SUPPLIERS BY CATEGORY
// ============================================================================

export const useSuppliersByCategory = (
  category: string,
  subsidiaryId?: SubsidiaryId
): UseSuppliersReturn => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSuppliers = useCallback(async () => {
    if (!category) {
      setSuppliers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const results = await supplierService.getSuppliersByCategory(category, subsidiaryId);
      setSuppliers(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch suppliers');
    } finally {
      setLoading(false);
    }
  }, [category, subsidiaryId]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  return {
    suppliers,
    loading,
    error,
    refresh: fetchSuppliers,
  };
};

// ============================================================================
// USE SUPPLIERS BY MATERIAL
// ============================================================================

export const useSuppliersByMaterial = (
  materialId: string,
  subsidiaryId?: SubsidiaryId
): UseSuppliersReturn => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSuppliers = useCallback(async () => {
    if (!materialId) {
      setSuppliers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const results = await supplierService.getSuppliersByMaterial(materialId, subsidiaryId);
      setSuppliers(results);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch suppliers');
    } finally {
      setLoading(false);
    }
  }, [materialId, subsidiaryId]);

  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);

  return {
    suppliers,
    loading,
    error,
    refresh: fetchSuppliers,
  };
};

// ============================================================================
// USE SUPPLIER SEARCH
// ============================================================================

export interface UseSupplierSearchReturn {
  results: Supplier[];
  searching: boolean;
  search: (term: string) => Promise<void>;
  clear: () => void;
}

export const useSupplierSearch = (subsidiaryId?: SubsidiaryId): UseSupplierSearchReturn => {
  const [results, setResults] = useState<Supplier[]>([]);
  const [searching, setSearching] = useState(false);

  const search = useCallback(
    async (term: string) => {
      if (!term || term.length < 2) {
        setResults([]);
        return;
      }

      setSearching(true);

      try {
        const searchResults = await supplierService.searchSuppliers(term, subsidiaryId);
        setResults(searchResults);
      } catch (err) {
        console.error('Supplier search error:', err);
        setResults([]);
      } finally {
        setSearching(false);
      }
    },
    [subsidiaryId]
  );

  const clear = useCallback(() => {
    setResults([]);
  }, []);

  return {
    results,
    searching,
    search,
    clear,
  };
};

// ============================================================================
// USE CREATE SUPPLIER
// ============================================================================

export interface UseCreateSupplierReturn {
  creating: boolean;
  error: string | null;
  createSupplier: (input: CreateSupplierInput) => Promise<Supplier>;
}

export const useCreateSupplier = (): UseCreateSupplierReturn => {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const createSupplier = useCallback(async (input: CreateSupplierInput) => {
    setCreating(true);
    setError(null);

    try {
      const supplier = await supplierService.createSupplier(input);
      return supplier;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create supplier');
      throw err;
    } finally {
      setCreating(false);
    }
  }, []);

  return {
    creating,
    error,
    createSupplier,
  };
};

// ============================================================================
// USE SUPPLIER PERFORMANCE
// ============================================================================

export interface UseSupplierPerformanceReturn {
  performance: {
    supplier: Supplier;
    rating: number;
    recommendations: string[];
  } | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export const useSupplierPerformance = (supplierId: string | null): UseSupplierPerformanceReturn => {
  const [performance, setPerformance] = useState<{
    supplier: Supplier;
    rating: number;
    recommendations: string[];
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPerformance = useCallback(async () => {
    if (!supplierId) {
      setPerformance(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const report = await supplierService.getSupplierPerformanceReport(supplierId);
      setPerformance(report);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch performance');
    } finally {
      setLoading(false);
    }
  }, [supplierId]);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  return {
    performance,
    loading,
    error,
    refresh: fetchPerformance,
  };
};

// ============================================================================
// USE MATERIAL RATES
// ============================================================================

export interface UseMaterialRatesReturn {
  addRate: (
    materialId: string,
    materialName: string,
    unitPrice: number,
    unit: string,
    currency?: string
  ) => Promise<void>;
  updateRate: (materialId: string, newPrice: number) => Promise<void>;
  removeRate: (materialId: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export const useMaterialRates = (supplierId: string | null, userId: string): UseMaterialRatesReturn => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addRate = useCallback(
    async (
      materialId: string,
      materialName: string,
      unitPrice: number,
      unit: string,
      currency: string = 'UGX'
    ) => {
      if (!supplierId) return;

      setLoading(true);
      setError(null);

      try {
        await supplierService.addMaterialRate(
          supplierId,
          {
            materialId,
            materialName,
            unitPrice,
            unit,
            currency,
          },
          userId
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add rate');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [supplierId, userId]
  );

  const updateRate = useCallback(
    async (materialId: string, newPrice: number) => {
      if (!supplierId) return;

      setLoading(true);
      setError(null);

      try {
        await supplierService.updateMaterialRate(supplierId, materialId, newPrice, userId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update rate');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [supplierId, userId]
  );

  const removeRate = useCallback(
    async (materialId: string) => {
      if (!supplierId) return;

      setLoading(true);
      setError(null);

      try {
        await supplierService.removeMaterialRate(supplierId, materialId, userId);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove rate');
        throw err;
      } finally {
        setLoading(false);
      }
    },
    [supplierId, userId]
  );

  return {
    addRate,
    updateRate,
    removeRate,
    loading,
    error,
  };
};

// ============================================================================
// DEFAULT EXPORT
// ============================================================================

export default {
  useSupplier,
  useSuppliers,
  useActiveSuppliers,
  useSuppliersByCategory,
  useSuppliersByMaterial,
  useSupplierSearch,
  useCreateSupplier,
  useSupplierPerformance,
  useMaterialRates,
};
