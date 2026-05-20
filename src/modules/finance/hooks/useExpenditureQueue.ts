// ============================================================================
// USE EXPENDITURE QUEUE HOOK
// Specialized hook for the expenditure queue page with filtering, sorting,
// and grouped-by-project view
// ============================================================================

import { useState, useEffect, useCallback, useMemo } from 'react';
import { where, orderBy } from 'firebase/firestore';
import type { QueryConstraint } from 'firebase/firestore';
import type {
  ExpenditureItem,
  ExpenditureFilters,
  PriorityTier,
  CommitmentLevel,
} from '../types/optimizer.types';
import { subscribeToCollection } from '@/shared/services/firebase/firestore';
import { optimizerService } from '../services/optimizerService';

interface UseExpenditureQueueOptions {
  companyId: string;
  initialFilters?: ExpenditureFilters;
  autoLoad?: boolean;
}

export type SortField = 'compositeScore' | 'amountUGX' | 'latestDate' | 'category';
type SortDirection = 'asc' | 'desc';
export type ViewMode = 'flat' | 'grouped';

export interface ProjectGroup {
  projectId: string;
  projectName: string;
  commitmentLevel: CommitmentLevel;
  projectApprovalStatus?: string;
  items: ExpenditureItem[];
  totalAmount: number;
  highestTier: PriorityTier;
  itemCount: number;
}

const TIER_RANK: Record<PriorityTier, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
  DEFERRABLE: 4,
};

interface UseExpenditureQueueReturn {
  // Data
  items: ExpenditureItem[];
  filteredItems: ExpenditureItem[];
  groupedItems: ProjectGroup[];
  selectedItem: ExpenditureItem | null;

  // View
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  // Stats
  totalCount: number;
  filteredCount: number;
  totalAmount: number;
  tierCounts: Record<PriorityTier, number>;

  // Filters
  filters: ExpenditureFilters;
  setFilters: (filters: ExpenditureFilters) => void;
  updateFilter: <K extends keyof ExpenditureFilters>(key: K, value: ExpenditureFilters[K]) => void;
  clearFilters: () => void;

  // Sort
  sortField: SortField;
  sortDirection: SortDirection;
  setSortField: (field: SortField) => void;
  toggleSortDirection: () => void;

  // Selection
  selectItem: (id: string | null) => void;

  // State
  isLoading: boolean;
  error: string | null;

  // Actions
  refresh: () => Promise<void>;
  approveItem: (id: string) => Promise<void>;
  deferItem: (id: string, reason: string) => Promise<void>;
}

export function useExpenditureQueue({
  companyId,
  initialFilters = {},
  autoLoad = true,
}: UseExpenditureQueueOptions): UseExpenditureQueueReturn {
  const [items, setItems] = useState<ExpenditureItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<ExpenditureItem | null>(null);
  const [filters, setFilters] = useState<ExpenditureFilters>(initialFilters);
  const [sortField, setSortField] = useState<SortField>('compositeScore');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [viewMode, setViewMode] = useState<ViewMode>('flat');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Real-time subscription via onSnapshot
  useEffect(() => {
    if (!companyId || !autoLoad) return;
    setIsLoading(true);
    setError(null);

    const constraints: QueryConstraint[] = [
      where('status', '==', filters.status || 'pending'),
      orderBy('compositeScore', 'desc'),
    ];
    if (filters.subsidiaryId) {
      constraints.push(where('subsidiaryId', '==', filters.subsidiaryId));
    }

    const collectionPath = `companies/${companyId}/expenditure_queue`;
    const unsubscribe = subscribeToCollection<ExpenditureItem>(
      collectionPath,
      (data) => {
        setItems(data);
        setIsLoading(false);
      },
      constraints,
      (err) => {
        setError(err.message || 'Failed to load expenditure queue');
        setIsLoading(false);
      }
    );

    return () => unsubscribe();
  }, [companyId, autoLoad, filters.status, filters.subsidiaryId]);

  // Manual refresh fallback
  const loadQueue = useCallback(async () => {
    if (!companyId) return;
    setIsLoading(true);
    setError(null);
    try {
      const queue = await optimizerService.getExpenditureQueue(companyId, {
        status: filters.status || 'pending',
        subsidiaryId: filters.subsidiaryId,
      });
      setItems(queue);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load expenditure queue');
    } finally {
      setIsLoading(false);
    }
  }, [companyId, filters.status, filters.subsidiaryId]);

  // Client-side filtering and sorting
  const filteredItems = useMemo(() => {
    let result = [...items];

    if (filters.priorityTier) {
      result = result.filter(i => i.priorityTier === filters.priorityTier);
    }
    if (filters.category) {
      result = result.filter(i => i.category === filters.category);
    }
    if (filters.commitmentLevel) {
      const normalized = filters.commitmentLevel;
      result = result.filter(i => {
        const level = i.commitmentLevel;
        if (normalized === 'committed') return level === 'committed' || level === 'approved';
        if (normalized === 'probable') return level === 'probable' || level === 'projected' || !level;
        return true;
      });
    }
    if (filters.sourceType) {
      result = result.filter(i => i.sourceType === filters.sourceType);
    }
    if (filters.projectId) {
      result = result.filter(i => i.projectId === filters.projectId);
    }
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      result = result.filter(i =>
        i.description.toLowerCase().includes(term) ||
        i.vendor?.toLowerCase().includes(term) ||
        i.projectName?.toLowerCase().includes(term)
      );
    }
    if (filters.minAmount !== undefined) {
      result = result.filter(i => i.amountUGX >= filters.minAmount!);
    }
    if (filters.maxAmount !== undefined) {
      result = result.filter(i => i.amountUGX <= filters.maxAmount!);
    }

    // Sort
    result.sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortField) {
        case 'compositeScore':
          aVal = a.compositeScore;
          bVal = b.compositeScore;
          break;
        case 'amountUGX':
          aVal = a.amountUGX;
          bVal = b.amountUGX;
          break;
        case 'latestDate': {
          const aDate = a.latestDate instanceof Date
            ? a.latestDate.getTime()
            : (a.latestDate as unknown as { toMillis: () => number }).toMillis?.() || 0;
          const bDate = b.latestDate instanceof Date
            ? b.latestDate.getTime()
            : (b.latestDate as unknown as { toMillis: () => number }).toMillis?.() || 0;
          aVal = aDate;
          bVal = bDate;
          break;
        }
        case 'category':
          aVal = a.category;
          bVal = b.category;
          break;
        default:
          aVal = a.compositeScore;
          bVal = b.compositeScore;
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

  // Grouped by project
  const groupedItems = useMemo(() => {
    const groupMap = new Map<string, ProjectGroup>();

    for (const item of filteredItems) {
      const key = item.projectId || '__unlinked__';
      const existing = groupMap.get(key);

      if (existing) {
        existing.items.push(item);
        existing.totalAmount += item.amountUGX;
        existing.itemCount++;
        if (TIER_RANK[item.priorityTier] < TIER_RANK[existing.highestTier]) {
          existing.highestTier = item.priorityTier;
        }
        // Upgrade commitment level if any item is more committed
        if (item.commitmentLevel === 'approved' || (item.commitmentLevel === 'committed' && existing.commitmentLevel === 'projected')) {
          existing.commitmentLevel = item.commitmentLevel;
        }
      } else {
        groupMap.set(key, {
          projectId: key,
          projectName: item.projectName || (key === '__unlinked__' ? 'Unlinked Expenditures' : key),
          commitmentLevel: item.commitmentLevel || 'committed',
          projectApprovalStatus: item.projectApprovalStatus,
          items: [item],
          totalAmount: item.amountUGX,
          highestTier: item.priorityTier,
          itemCount: 1,
        });
      }
    }

    // Sort groups: committed before projected, then by highest tier, then by total amount
    const groups = Array.from(groupMap.values());
    groups.sort((a, b) => {
      // Unlinked always last
      if (a.projectId === '__unlinked__') return 1;
      if (b.projectId === '__unlinked__') return -1;
      // Committed before projected
      const commitOrder: Record<string, number> = { approved: 0, committed: 0, probable: 1, projected: 2 };
      const commitDiff = (commitOrder[a.commitmentLevel] ?? 1) - (commitOrder[b.commitmentLevel] ?? 1);
      if (commitDiff !== 0) return commitDiff;
      // Then by highest tier
      const tierDiff = TIER_RANK[a.highestTier] - TIER_RANK[b.highestTier];
      if (tierDiff !== 0) return tierDiff;
      // Then by total amount desc
      return b.totalAmount - a.totalAmount;
    });

    return groups;
  }, [filteredItems]);

  // Computed stats
  const tierCounts = useMemo(() => {
    const counts: Record<PriorityTier, number> = {
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
      DEFERRABLE: 0,
    };
    items.forEach(item => {
      counts[item.priorityTier] = (counts[item.priorityTier] || 0) + 1;
    });
    return counts;
  }, [items]);

  const totalAmount = useMemo(
    () => filteredItems.reduce((sum, item) => sum + item.amountUGX, 0),
    [filteredItems]
  );

  // Filter helpers
  const updateFilter = useCallback(<K extends keyof ExpenditureFilters>(
    key: K,
    value: ExpenditureFilters[K]
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

  // Actions
  const approveItem = useCallback(async (id: string) => {
    await optimizerService.updateExpenditure(companyId, id, { status: 'approved' }, 'user');
    await loadQueue();
  }, [companyId, loadQueue]);

  const deferItem = useCallback(async (id: string, reason: string) => {
    await optimizerService.deferSpendPlanItem(companyId, id, reason, 'user');
    await loadQueue();
  }, [companyId, loadQueue]);

  return {
    items,
    filteredItems,
    groupedItems,
    selectedItem,
    viewMode,
    setViewMode,
    totalCount: items.length,
    filteredCount: filteredItems.length,
    totalAmount,
    tierCounts,
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
    refresh: loadQueue,
    approveItem,
    deferItem,
  };
}
