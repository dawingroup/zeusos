// ============================================================================
// USE KPI LIBRARY HOOK - DawinOS CEO Strategy Command
// Browses KPI Library with search/filter and tracking status enrichment
// ============================================================================

import { useState, useMemo, useCallback } from 'react';
import {
  KPI_LIBRARY,
  KPI_LIBRARY_CATEGORIES,
  LIBRARY_CATEGORY_TO_KPI_CATEGORY,
  type KPILibraryEntry,
  type KPILibraryCategoryDef,
} from '../constants/kpiLibrary.constants';
import type { KPIDefinition } from '../types/kpi.types';

// ----------------------------------------------------------------------------
// Types
// ----------------------------------------------------------------------------

export interface UseKPILibraryOptions {
  trackedKPIs?: KPIDefinition[];
  initialCategory?: string;
  initialSubCategory?: string;
  initialSearch?: string;
}

export interface UseKPILibraryReturn {
  // Data
  entries: KPILibraryEntry[];
  categories: KPILibraryCategoryDef[];
  totalCount: number;
  filteredCount: number;
  trackedCount: number;

  // Filters
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  selectedCategory: string;
  setSelectedCategory: (c: string) => void;
  selectedSubCategory: string;
  setSelectedSubCategory: (sc: string) => void;
  selectedModule: string;
  setSelectedModule: (m: string) => void;
  showTrackedOnly: boolean;
  setShowTrackedOnly: (v: boolean) => void;

  // Helpers
  isTracked: (libraryEntryId: string) => boolean;
  getTrackedKPI: (libraryEntryId: string) => KPIDefinition | undefined;
  clearFilters: () => void;
  getCategoryEntryCount: (libraryCategoryId: string) => number;
}

// ----------------------------------------------------------------------------
// Hook Implementation
// ----------------------------------------------------------------------------

export function useKPILibrary(options: UseKPILibraryOptions = {}): UseKPILibraryReturn {
  const {
    trackedKPIs = [],
    initialCategory = '',
    initialSubCategory = '',
    initialSearch = '',
  } = options;

  const [searchQuery, setSearchQuery] = useState(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState(initialCategory);
  const [selectedSubCategory, setSelectedSubCategory] = useState(initialSubCategory);
  const [selectedModule, setSelectedModule] = useState('');
  const [showTrackedOnly, setShowTrackedOnly] = useState(false);

  // Build tracked library entry IDs set
  const trackedEntryIds = useMemo(() => {
    const ids = new Set<string>();
    for (const kpi of trackedKPIs) {
      if (kpi.libraryEntryId) {
        ids.add(kpi.libraryEntryId);
      }
    }
    return ids;
  }, [trackedKPIs]);

  const trackedCount = trackedEntryIds.size;

  // Filter entries
  const entries = useMemo(() => {
    let result = [...KPI_LIBRARY];

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(
        (entry) =>
          entry.name.toLowerCase().includes(q) ||
          entry.code.toLowerCase().includes(q) ||
          entry.description.toLowerCase().includes(q) ||
          entry.formula.toLowerCase().includes(q) ||
          entry.tags.some((tag) => tag.includes(q))
      );
    }

    // Category filter (maps library category ID to KPI_CATEGORY value)
    if (selectedCategory) {
      const kpiCategory = LIBRARY_CATEGORY_TO_KPI_CATEGORY[selectedCategory];
      if (kpiCategory) {
        result = result.filter((entry) => entry.category === kpiCategory);
      }
    }

    // Sub-category filter
    if (selectedSubCategory) {
      result = result.filter((entry) => entry.subCategory === selectedSubCategory);
    }

    // Module filter
    if (selectedModule) {
      result = result.filter((entry) => entry.moduleLinkage?.module === selectedModule);
    }

    // Tracked-only filter
    if (showTrackedOnly) {
      result = result.filter((entry) => trackedEntryIds.has(entry.id));
    }

    return result;
  }, [searchQuery, selectedCategory, selectedSubCategory, selectedModule, showTrackedOnly, trackedEntryIds]);

  const isTracked = useCallback(
    (libraryEntryId: string) => trackedEntryIds.has(libraryEntryId),
    [trackedEntryIds]
  );

  const getTrackedKPI = useCallback(
    (libraryEntryId: string) =>
      trackedKPIs.find((kpi) => kpi.libraryEntryId === libraryEntryId),
    [trackedKPIs]
  );

  const clearFilters = useCallback(() => {
    setSearchQuery('');
    setSelectedCategory('');
    setSelectedSubCategory('');
    setSelectedModule('');
    setShowTrackedOnly(false);
  }, []);

  const getCategoryEntryCount = useCallback(
    (libraryCategoryId: string) => {
      const kpiCategory = LIBRARY_CATEGORY_TO_KPI_CATEGORY[libraryCategoryId];
      if (!kpiCategory) return 0;
      return KPI_LIBRARY.filter((entry) => entry.category === kpiCategory).length;
    },
    []
  );

  return {
    entries,
    categories: KPI_LIBRARY_CATEGORIES,
    totalCount: KPI_LIBRARY.length,
    filteredCount: entries.length,
    trackedCount,
    searchQuery,
    setSearchQuery,
    selectedCategory,
    setSelectedCategory,
    selectedSubCategory,
    setSelectedSubCategory,
    selectedModule,
    setSelectedModule,
    showTrackedOnly,
    setShowTrackedOnly,
    isTracked,
    getTrackedKPI,
    clearFilters,
    getCategoryEntryCount,
  };
}
