/**
 * useControlBOQ Hook
 * 
 * Hook for fetching and managing Control BOQ items.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Firestore, collection, onSnapshot } from 'firebase/firestore';
import {
  getProjectBOQItems,
  getControlBOQ,
  getAvailableBOQItems,
} from '../services/control-boq';
import type { ControlBOQItem, ControlBOQ } from '../types/boq';
import { getAvailableQuantity, groupByBill, groupBySection, calculateBOQSummary } from '../types/boq';

// ─────────────────────────────────────────────────────────────────
// useProjectBOQItems
// ─────────────────────────────────────────────────────────────────

interface UseProjectBOQItemsOptions {
  realtime?: boolean;
  onlyAvailable?: boolean;
}

interface UseProjectBOQItemsReturn {
  items: ControlBOQItem[];
  availableItems: ControlBOQItem[];
  byBill: Record<string, ControlBOQItem[]>;
  bySection: Record<string, ControlBOQItem[]>;
  summary: ReturnType<typeof calculateBOQSummary>;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useProjectBOQItems(
  db: Firestore,
  projectId: string | null,
  options: UseProjectBOQItemsOptions = {}
): UseProjectBOQItemsReturn {
  const [items, setItems] = useState<ControlBOQItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const { realtime = false, onlyAvailable = false } = options;
  
  const fetchItems = useCallback(async () => {
    if (!projectId) {
      setItems([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const fetchedItems = onlyAvailable
        ? await getAvailableBOQItems(db, projectId)
        : await getProjectBOQItems(db, projectId);
      
      setItems(fetchedItems);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch BOQ items'));
    } finally {
      setLoading(false);
    }
  }, [db, projectId, onlyAvailable]);
  
  useEffect(() => {
    if (!realtime) {
      fetchItems();
      return;
    }
    
    if (!projectId) {
      setItems([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    
    // Use collection without ordering to avoid index issues
    const collRef = collection(db, `projects/${projectId}/boq_items`);
    
    const unsubscribe = onSnapshot(
      collRef,
      (snapshot) => {
        let fetchedItems = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as ControlBOQItem[];
        
        // Sort in memory
        fetchedItems.sort((a, b) => (a.hierarchyPath || '').localeCompare(b.hierarchyPath || ''));
        
        if (onlyAvailable) {
          fetchedItems = fetchedItems.filter(item => getAvailableQuantity(item) > 0);
        }
        
        setItems(fetchedItems);
        setLoading(false);
      },
      (err) => {
        console.error('BOQ items subscription error:', err);
        setError(err);
        setLoading(false);
      }
    );
    
    return () => unsubscribe();
  }, [db, projectId, realtime, onlyAvailable, fetchItems]);
  
  const availableItems = useMemo(() => {
    return items.filter(item => getAvailableQuantity(item) > 0);
  }, [items]);
  
  const byBill = useMemo(() => groupByBill(items), [items]);
  const bySection = useMemo(() => groupBySection(items), [items]);
  const summary = useMemo(() => calculateBOQSummary(items), [items]);
  
  return {
    items,
    availableItems,
    byBill,
    bySection,
    summary,
    loading,
    error,
    refresh: fetchItems,
  };
}

// ─────────────────────────────────────────────────────────────────
// useControlBOQ
// ─────────────────────────────────────────────────────────────────

interface UseControlBOQReturn {
  controlBOQ: ControlBOQ | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export function useControlBOQ(
  db: Firestore,
  projectId: string | null
): UseControlBOQReturn {
  const [controlBOQ, setControlBOQ] = useState<ControlBOQ | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  const fetchControlBOQ = useCallback(async () => {
    if (!projectId) {
      setControlBOQ(null);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const boq = await getControlBOQ(db, projectId);
      setControlBOQ(boq);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch Control BOQ'));
    } finally {
      setLoading(false);
    }
  }, [db, projectId]);
  
  useEffect(() => {
    fetchControlBOQ();
  }, [fetchControlBOQ]);
  
  return {
    controlBOQ,
    loading,
    error,
    refresh: fetchControlBOQ,
  };
}

// ─────────────────────────────────────────────────────────────────
// useBOQItemSelection
// ─────────────────────────────────────────────────────────────────

export interface SelectedBOQItem {
  item: ControlBOQItem;
  quantityRequested: number;
  notes?: string;
}

interface UseBOQItemSelectionReturn {
  selectedItems: SelectedBOQItem[];
  selectedIds: Set<string>;
  totalAmount: number;
  totalItems: number;
  selectItem: (item: ControlBOQItem, quantity?: number) => void;
  deselectItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  updateNotes: (itemId: string, notes: string) => void;
  clearSelection: () => void;
  isSelected: (itemId: string) => boolean;
  getSelectedQuantity: (itemId: string) => number;
}

export function useBOQItemSelection(): UseBOQItemSelectionReturn {
  const [selectedItems, setSelectedItems] = useState<SelectedBOQItem[]>([]);
  
  const selectedIds = useMemo(() => {
    return new Set(selectedItems.map(s => s.item.id));
  }, [selectedItems]);
  
  const totalAmount = useMemo(() => {
    return selectedItems.reduce(
      (sum, s) => sum + (s.quantityRequested * s.item.rate),
      0
    );
  }, [selectedItems]);
  
  const totalItems = selectedItems.length;
  
  const selectItem = useCallback((item: ControlBOQItem, quantity?: number) => {
    const availableQty = getAvailableQuantity(item);
    const requestedQty = quantity ?? availableQty;
    
    setSelectedItems(prev => {
      const existing = prev.find(s => s.item.id === item.id);
      if (existing) {
        return prev.map(s =>
          s.item.id === item.id
            ? { ...s, quantityRequested: Math.min(requestedQty, availableQty) }
            : s
        );
      }
      return [...prev, {
        item,
        quantityRequested: Math.min(requestedQty, availableQty),
      }];
    });
  }, []);
  
  const deselectItem = useCallback((itemId: string) => {
    setSelectedItems(prev => prev.filter(s => s.item.id !== itemId));
  }, []);
  
  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    setSelectedItems(prev =>
      prev.map(s => {
        if (s.item.id !== itemId) return s;
        const availableQty = getAvailableQuantity(s.item);
        return {
          ...s,
          quantityRequested: Math.min(Math.max(0, quantity), availableQty),
        };
      })
    );
  }, []);
  
  const updateNotes = useCallback((itemId: string, notes: string) => {
    setSelectedItems(prev =>
      prev.map(s => s.item.id === itemId ? { ...s, notes } : s)
    );
  }, []);
  
  const clearSelection = useCallback(() => {
    setSelectedItems([]);
  }, []);
  
  const isSelected = useCallback((itemId: string) => {
    return selectedIds.has(itemId);
  }, [selectedIds]);
  
  const getSelectedQuantity = useCallback((itemId: string) => {
    const selected = selectedItems.find(s => s.item.id === itemId);
    return selected?.quantityRequested ?? 0;
  }, [selectedItems]);
  
  return {
    selectedItems,
    selectedIds,
    totalAmount,
    totalItems,
    selectItem,
    deselectItem,
    updateQuantity,
    updateNotes,
    clearSelection,
    isSelected,
    getSelectedQuantity,
  };
}
