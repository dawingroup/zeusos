/**
 * BOQ Hooks for Delivery Module
 * Hooks for fetching and managing Control BOQ items
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  doc,
  getDoc,
  onSnapshot,
  Firestore,
} from 'firebase/firestore';
import {
  ControlBOQItem,
  BOQItemStatus,
  getAvailableQuantity,
  groupByBill,
  groupBySection,
} from '../types/control-boq';

const BOQ_ITEMS_PATH = 'boq_items';

// ─────────────────────────────────────────────────────────────────
// HOOK: useProjectBOQItems
// ─────────────────────────────────────────────────────────────────

interface UseProjectBOQItemsOptions {
  realtime?: boolean;
  statusFilter?: BOQItemStatus[];
  onlyAvailable?: boolean;
}

interface UseProjectBOQItemsReturn {
  items: ControlBOQItem[];
  availableItems: ControlBOQItem[];
  byBill: Record<string, ControlBOQItem[]>;
  bySection: Record<string, ControlBOQItem[]>;
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

  const { realtime = false, statusFilter, onlyAvailable = false } = options;

  const fetchItems = useCallback(async () => {
    if (!projectId) {
      setItems([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let q = query(
        collection(db, BOQ_ITEMS_PATH),
        where('projectId', '==', projectId),
        orderBy('hierarchyPath', 'asc')
      );

      if (statusFilter && statusFilter.length > 0) {
        q = query(q, where('status', 'in', statusFilter));
      }

      const snapshot = await getDocs(q);
      let fetchedItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as ControlBOQItem[];

      if (onlyAvailable) {
        fetchedItems = fetchedItems.filter(item => getAvailableQuantity(item) > 0);
      }

      setItems(fetchedItems);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch BOQ items'));
    } finally {
      setLoading(false);
    }
  }, [db, projectId, statusFilter, onlyAvailable]);

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

    const q = query(
      collection(db, BOQ_ITEMS_PATH),
      where('projectId', '==', projectId),
      orderBy('hierarchyPath', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        let fetchedItems = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as ControlBOQItem[];

        if (statusFilter && statusFilter.length > 0) {
          fetchedItems = fetchedItems.filter(item => statusFilter.includes(item.status));
        }

        if (onlyAvailable) {
          fetchedItems = fetchedItems.filter(item => getAvailableQuantity(item) > 0);
        }

        setItems(fetchedItems);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [db, projectId, realtime, statusFilter, onlyAvailable, fetchItems]);

  const availableItems = useMemo(() => {
    return items.filter(item => getAvailableQuantity(item) > 0);
  }, [items]);

  const byBill = useMemo(() => groupByBill(items), [items]);
  const bySection = useMemo(() => groupBySection(items), [items]);

  return {
    items,
    availableItems,
    byBill,
    bySection,
    loading,
    error,
    refresh: fetchItems,
  };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useBOQItem
// ─────────────────────────────────────────────────────────────────

interface UseBOQItemReturn {
  item: ControlBOQItem | null;
  loading: boolean;
  error: Error | null;
}

export function useBOQItem(
  db: Firestore,
  itemId: string | null
): UseBOQItemReturn {
  const [item, setItem] = useState<ControlBOQItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!itemId) {
      setItem(null);
      setLoading(false);
      return;
    }

    const fetchItem = async () => {
      setLoading(true);
      setError(null);

      try {
        const docRef = doc(db, BOQ_ITEMS_PATH, itemId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          setItem({ id: docSnap.id, ...docSnap.data() } as ControlBOQItem);
        } else {
          setItem(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch BOQ item'));
      } finally {
        setLoading(false);
      }
    };

    fetchItem();
  }, [db, itemId]);

  return { item, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useBOQItemSelection
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
      prev.map(s =>
        s.item.id === itemId ? { ...s, notes } : s
      )
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

// ─────────────────────────────────────────────────────────────────
// HOOK: useBOQSummary
// ─────────────────────────────────────────────────────────────────

interface BOQSummary {
  totalItems: number;
  totalContractValue: number;
  requisitionedValue: number;
  executedValue: number;
  remainingValue: number;
  byStatus: Record<BOQItemStatus, number>;
  currency: string;
}

export function useBOQSummary(items: ControlBOQItem[]): BOQSummary {
  return useMemo(() => {
    const summary: BOQSummary = {
      totalItems: items.length,
      totalContractValue: 0,
      requisitionedValue: 0,
      executedValue: 0,
      remainingValue: 0,
      byStatus: {
        pending: 0,
        partial: 0,
        requisitioned: 0,
        in_progress: 0,
        completed: 0,
      },
      currency: items[0]?.currency || 'UGX',
    };

    for (const item of items) {
      summary.totalContractValue += item.amount;
      summary.requisitionedValue += item.quantityRequisitioned * item.rate;
      summary.executedValue += item.quantityExecuted * item.rate;
      summary.remainingValue += getAvailableQuantity(item) * item.rate;
      summary.byStatus[item.status]++;
    }

    return summary;
  }, [items]);
}
