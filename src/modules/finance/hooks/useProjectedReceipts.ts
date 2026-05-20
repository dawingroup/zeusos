// ============================================================================
// USE PROJECTED RECEIPTS HOOK
// Specialized hook for the Projected Receipts page with filtering, sorting,
// real-time subscription, and summary statistics
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { where, orderBy } from 'firebase/firestore';
import type { QueryConstraint } from 'firebase/firestore';
import type {
  ProjectedReceipt,
  ReceiptFilters,
  ConfidenceLevel,
} from '../types/optimizer.types';
import { subscribeToCollection } from '@/shared/services/firebase/firestore';
import { optimizerService } from '../services/optimizerService';

interface UseProjectedReceiptsOptions {
  companyId: string;
  initialFilters?: ReceiptFilters;
  autoLoad?: boolean;
}

export type ReceiptSortField = 'amount' | 'expectedDate' | 'confidenceScore' | 'sourceType';
type SortDirection = 'asc' | 'desc';

export interface ReceiptSummary {
  totalProjected: number;
  confirmedAmount: number;
  probableAmount: number;
  possibleAmount: number;
  overdueCount: number;
  confidenceCounts: Record<ConfidenceLevel, number>;
}

interface UseProjectedReceiptsReturn {
  // Data
  items: ProjectedReceipt[];
  filteredItems: ProjectedReceipt[];
  selectedItem: ProjectedReceipt | null;

  // Stats
  totalCount: number;
  filteredCount: number;
  summary: ReceiptSummary;

  // Filters
  filters: ReceiptFilters;
  setFilters: (filters: ReceiptFilters) => void;
  updateFilter: <K extends keyof ReceiptFilters>(key: K, value: ReceiptFilters[K]) => void;
  clearFilters: () => void;

  // Sort
  sortField: ReceiptSortField;
  sortDirection: SortDirection;
  setSortField: (field: ReceiptSortField) => void;
  toggleSortDirection: () => void;

  // Selection
  selectItem: (id: string | null) => void;

  // State
  isLoading: boolean;
  error: string | null;

  // Actions
  refresh: () => Promise<void>;
}

export function useProjectedReceipts({
  companyId,
  initialFilters = {},
  autoLoad = true,
}: UseProjectedReceiptsOptions): UseProjectedReceiptsReturn {
  const [items, setItems] = useState<ProjectedReceipt[]>([]);
  const [selectedItem, setSelectedItem] = useState<ProjectedReceipt | null>(null);
  const [filters, setFilters] = useState<ReceiptFilters>(initialFilters);
  const [sortField, setSortField] = useState<ReceiptSortField>('expectedDate');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Real-time subscription via onSnapshot
  useEffect(() => {
    if (!companyId || !autoLoad) return;
    setIsLoading(true);
    setError(null);

    const constraints: QueryConstraint[] = [];

    if (filters.status) {
      constraints.push(where('status', '==', filters.status));
    } else {
      // Default: exclude received/cancelled
      constraints.push(where('status', 'in', ['projected', 'invoiced', 'overdue']));
    }

    constraints.push(orderBy('expectedDate', 'asc'));

    if (filters.subsidiaryId) {
      constraints.push(where('subsidiaryId', '==', filters.subsidiaryId));
    }

    const collectionPath = `companies/${companyId}/projected_receipts`;
    const unsubscribe = subscribeToCollection<ProjectedReceipt>(
      collectionPath,
      (data) => {
        setItems(data);
        setIsLoading(false);
      },
      constraints,
      (err) => {
        setError(err.message || 'Failed to load projected receipts');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [companyId, autoLoad, filters.status, filters.subsidiaryId]);

  // Manual refresh fallback
  const loadReceipts = useCallback(async () => {
    if (!companyId) return;
    setIsLoading(true);
    setError(null);
    try {
      const receipts = await optimizerService.getProjectedReceipts(companyId, {
        status: filters.status,
        subsidiaryId: filters.subsidiaryId,
      });
      setItems(receipts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projected receipts');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, filters.status, filters.subsidiaryId]);

  // Client-side filtering and sorting
  const filteredItems = useMemo(() => {
    let result = [...items];

    if (filters.confidenceLevel) {
      result = result.filter(i => i.confidenceLevel === filters.confidenceLevel);
    }
    if (filters.sourceType) {
      result = result.filter(i => i.sourceType === filters.sourceType);
    }
    if (filters.customerId) {
      result = result.filter(i => i.customerId === filters.customerId);
    }
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      result = result.filter(i =>
        i.sourceName?.toLowerCase().includes(term) ||
        i.customerName?.toLowerCase().includes(term)
      );
    }
    if (filters.minAmount !== undefined) {
      result = result.filter(i => i.amount >= filters.minAmount!);
    }
    if (filters.maxAmount !== undefined) {
      result = result.filter(i => i.amount <= filters.maxAmount!);
    }
    if (filters.dateFrom) {
      const from = filters.dateFrom.getTime();
      result = result.filter(i => {
        const ts = i.expectedDate;
        const ms = ts instanceof Date ? ts.getTime()
          : (ts as unknown as { toMillis: () => number }).toMillis?.() || 0;
        return ms >= from;
      });
    }
    if (filters.dateTo) {
      const to = filters.dateTo.getTime();
      result = result.filter(i => {
        const ts = i.expectedDate;
        const ms = ts instanceof Date ? ts.getTime()
          : (ts as unknown as { toMillis: () => number }).toMillis?.() || 0;
        return ms <= to;
      });
    }

    // Sort
    result.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortField) {
        case 'amount':
          aVal = a.amount;
          bVal = b.amount;
          break;
        case 'expectedDate': {
          const aDate = a.expectedDate instanceof Date
            ? a.expectedDate.getTime()
            : (a.expectedDate as unknown as { toMillis: () => number }).toMillis?.() || 0;
          const bDate = b.expectedDate instanceof Date
            ? b.expectedDate.getTime()
            : (b.expectedDate as unknown as { toMillis: () => number }).toMillis?.() || 0;
          aVal = aDate;
          bVal = bDate;
          break;
        }
        case 'confidenceScore':
          aVal = a.confidenceScore || 0;
          bVal = b.confidenceScore || 0;
          break;
        case 'sourceType':
          aVal = a.sourceType;
          bVal = b.sourceType;
          break;
        default:
          aVal = a.amount;
          bVal = b.amount;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDirection === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number);
    });

    return result;
  }, [items, filters, sortField, sortDirection]);

  // Summary stats (computed from ALL items, not filtered)
  const summary = useMemo<ReceiptSummary>(() => {
    const confidenceCounts: Record<ConfidenceLevel, number> = {
      confirmed: 0,
      probable: 0,
      possible: 0,
    };

    let totalProjected = 0;
    let confirmedAmount = 0;
    let probableAmount = 0;
    let possibleAmount = 0;
    let overdueCount = 0;

    for (const item of items) {
      totalProjected += item.amount;
      confidenceCounts[item.confidenceLevel] = (confidenceCounts[item.confidenceLevel] || 0) + 1;

      switch (item.confidenceLevel) {
        case 'confirmed':
          confirmedAmount += item.amount;
          break;
        case 'probable':
          probableAmount += item.amount;
          break;
        case 'possible':
          possibleAmount += item.amount;
          break;
      }

      if (item.status === 'overdue') overdueCount++;
    }

    return { totalProjected, confirmedAmount, probableAmount, possibleAmount, overdueCount, confidenceCounts };
  }, [items]);

  // Filter helpers
  const updateFilter = useCallback(<K extends keyof ReceiptFilters>(
    key: K,
    value: ReceiptFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
  }, []);

  // Selection
  const selectItem = useCallback((id: string | null) => {
    if (!id) {
      setSelectedItem(null);
      return;
    }
    const item = items.find(i => i.id === id) || null;
    setSelectedItem(item);
  }, [items]);

  return {
    items,
    filteredItems,
    selectedItem,
    totalCount: items.length,
    filteredCount: filteredItems.length,
    summary,
    filters,
    setFilters,
    updateFilter,
    clearFilters,
    sortField,
    sortDirection,
    setSortField,
    toggleSortDirection: () => setSortDirection(d => d === 'asc' ? 'desc' : 'asc'),
    selectItem,
    isLoading,
    error,
    refresh: loadReceipts,
  };
}
