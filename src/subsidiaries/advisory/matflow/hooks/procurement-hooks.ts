/**
 * Procurement Hooks
 * 
 * React hooks for procurement and supplier management.
 */

import { useState, useEffect, useCallback } from 'react';
import { procurementService } from '../services/procurement-service';
import type {
  ProcurementEntry,
  PurchaseOrder,
  CreateProcurementInput,
  UpdateProcurementInput,
  QualityCheckInput
} from '../types/procurement';
import type {
  Supplier,
  SupplierQuotation,
  CreateSupplierInput,
  UpdateSupplierInput
} from '../types/supplier';

// ============================================================================
// PROCUREMENT ENTRY HOOKS
// ============================================================================

/**
 * Hook for fetching project procurement entries
 */
export function useProjectProcurement(projectId: string | undefined) {
  const [entries, setEntries] = useState<ProcurementEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchEntries = useCallback(async () => {
    if (!projectId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const data = await procurementService.getProjectProcurementEntries(projectId);
      setEntries(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch procurement entries'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);
  
  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);
  
  return { entries, loading, error, refetch: fetchEntries };
}

/**
 * Hook for fetching material procurement entries
 */
export function useMaterialProcurement(projectId: string | undefined, materialId: string | undefined) {
  const [entries, setEntries] = useState<ProcurementEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchEntries = useCallback(async () => {
    if (!projectId || !materialId) {
      setEntries([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const data = await procurementService.getMaterialProcurementEntries(projectId, materialId);
      setEntries(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch procurement entries'));
    } finally {
      setLoading(false);
    }
  }, [projectId, materialId]);
  
  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);
  
  return { entries, loading, error, refetch: fetchEntries };
}

/**
 * Hook for procurement entry mutations
 */
export function useProcurementMutations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const createEntry = useCallback(async (
    projectId: string,
    input: CreateProcurementInput,
    userId: string,
    userName: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      const id = await procurementService.createProcurementEntry(projectId, input, userId, userName);
      return id;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create procurement entry');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const updateEntry = useCallback(async (
    entryId: string,
    updates: UpdateProcurementInput,
    userId: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      await procurementService.updateProcurementEntry(entryId, updates, userId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update procurement entry');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const qualityCheck = useCallback(async (
    entryId: string,
    input: QualityCheckInput,
    userId: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      await procurementService.qualityCheckDelivery(entryId, input, userId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to complete quality check');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const confirmEntry = useCallback(async (entryId: string, userId: string) => {
    try {
      setLoading(true);
      setError(null);
      await procurementService.confirmProcurementEntry(entryId, userId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to confirm entry');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  return {
    loading,
    error,
    createEntry,
    updateEntry,
    qualityCheck,
    confirmEntry
  };
}

// ============================================================================
// PURCHASE ORDER HOOKS
// ============================================================================

/**
 * Hook for fetching a single purchase order
 */
export function usePurchaseOrder(poId: string | undefined) {
  const [purchaseOrder, setPurchaseOrder] = useState<PurchaseOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchPO = useCallback(async () => {
    if (!poId) {
      setPurchaseOrder(null);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const data = await procurementService.getPurchaseOrder(poId);
      setPurchaseOrder(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch purchase order'));
    } finally {
      setLoading(false);
    }
  }, [poId]);
  
  useEffect(() => {
    fetchPO();
  }, [fetchPO]);
  
  return { purchaseOrder, loading, error, refetch: fetchPO };
}

/**
 * Hook for fetching project purchase orders
 */
export function useProjectPurchaseOrders(projectId: string | undefined) {
  const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchPOs = useCallback(async () => {
    if (!projectId) {
      setPurchaseOrders([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const data = await procurementService.getProjectPurchaseOrders(projectId);
      setPurchaseOrders(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch purchase orders'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);
  
  useEffect(() => {
    fetchPOs();
  }, [fetchPOs]);
  
  return { purchaseOrders, loading, error, refetch: fetchPOs };
}

/**
 * Hook for purchase order mutations
 */
export function usePurchaseOrderMutations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const createPO = useCallback(async (
    po: Omit<PurchaseOrder, 'id' | 'orderNumber' | 'status' | 'createdAt' | 'createdBy' | 'updatedAt'>,
    userId: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      const id = await procurementService.createPurchaseOrder(po, userId);
      return id;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create purchase order');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const submitPO = useCallback(async (poId: string, userId: string) => {
    try {
      setLoading(true);
      setError(null);
      await procurementService.submitPurchaseOrder(poId, userId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to submit purchase order');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const approvePO = useCallback(async (poId: string, userId: string) => {
    try {
      setLoading(true);
      setError(null);
      await procurementService.approvePurchaseOrder(poId, userId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to approve purchase order');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  return {
    loading,
    error,
    createPO,
    submitPO,
    approvePO
  };
}

// ============================================================================
// SUPPLIER HOOKS
// ============================================================================

/**
 * Hook for fetching a single supplier
 */
export function useSupplier(supplierId: string | undefined) {
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchSupplier = useCallback(async () => {
    if (!supplierId) {
      setSupplier(null);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const data = await procurementService.getSupplier(supplierId);
      setSupplier(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch supplier'));
    } finally {
      setLoading(false);
    }
  }, [supplierId]);
  
  useEffect(() => {
    fetchSupplier();
  }, [fetchSupplier]);
  
  return { supplier, loading, error, refetch: fetchSupplier };
}

/**
 * Hook for fetching active suppliers
 */
export function useActiveSuppliers() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchSuppliers = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await procurementService.getActiveSuppliers();
      setSuppliers(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch suppliers'));
    } finally {
      setLoading(false);
    }
  }, []);
  
  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);
  
  return { suppliers, loading, error, refetch: fetchSuppliers };
}

/**
 * Hook for fetching suppliers by category
 */
export function useSuppliersByCategory(category: string | undefined) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchSuppliers = useCallback(async () => {
    if (!category) {
      setSuppliers([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const data = await procurementService.getSuppliersByCategory(category);
      setSuppliers(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch suppliers'));
    } finally {
      setLoading(false);
    }
  }, [category]);
  
  useEffect(() => {
    fetchSuppliers();
  }, [fetchSuppliers]);
  
  return { suppliers, loading, error, refetch: fetchSuppliers };
}

/**
 * Hook for supplier mutations
 */
export function useSupplierMutations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const createSupplier = useCallback(async (input: CreateSupplierInput, userId: string) => {
    try {
      setLoading(true);
      setError(null);
      const id = await procurementService.createSupplier(input, userId);
      return id;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create supplier');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const updateSupplier = useCallback(async (
    supplierId: string,
    updates: UpdateSupplierInput,
    userId: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      await procurementService.updateSupplier(supplierId, updates, userId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to update supplier');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const activateSupplier = useCallback(async (supplierId: string, userId: string) => {
    try {
      setLoading(true);
      setError(null);
      await procurementService.activateSupplier(supplierId, userId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to activate supplier');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const blacklistSupplier = useCallback(async (
    supplierId: string,
    reason: string,
    userId: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      await procurementService.blacklistSupplier(supplierId, reason, userId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to blacklist supplier');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  return {
    loading,
    error,
    createSupplier,
    updateSupplier,
    activateSupplier,
    blacklistSupplier
  };
}

// ============================================================================
// QUOTATION HOOKS
// ============================================================================

/**
 * Hook for fetching project quotations
 */
export function useProjectQuotations(projectId: string | undefined) {
  const [quotations, setQuotations] = useState<SupplierQuotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchQuotations = useCallback(async () => {
    if (!projectId) {
      setQuotations([]);
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const data = await procurementService.getProjectQuotations(projectId);
      setQuotations(data);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch quotations'));
    } finally {
      setLoading(false);
    }
  }, [projectId]);
  
  useEffect(() => {
    fetchQuotations();
  }, [fetchQuotations]);
  
  return { quotations, loading, error, refetch: fetchQuotations };
}

/**
 * Hook for quotation mutations
 */
export function useQuotationMutations() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const createQuotation = useCallback(async (
    quotation: Omit<SupplierQuotation, 'id' | 'status' | 'audit'>,
    userId: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      const id = await procurementService.createQuotation(quotation, userId);
      return id;
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to create quotation');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const acceptQuotation = useCallback(async (quotationId: string, userId: string) => {
    try {
      setLoading(true);
      setError(null);
      await procurementService.acceptQuotation(quotationId, userId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to accept quotation');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  const rejectQuotation = useCallback(async (
    quotationId: string,
    reason: string,
    userId: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      await procurementService.rejectQuotation(quotationId, reason, userId);
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Failed to reject quotation');
      setError(error);
      throw error;
    } finally {
      setLoading(false);
    }
  }, []);
  
  return {
    loading,
    error,
    createQuotation,
    acceptQuotation,
    rejectQuotation
  };
}
