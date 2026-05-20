/**
 * usePaletteBulkSelection Hook
 * Set-based multi-select state management for Material Palette entries.
 * Mirrors inventory/hooks/useBulkSelection.ts pattern.
 */

import { useState, useCallback } from 'react';
import type { MaterialPaletteEntry } from '@/shared/types';

export interface UsePaletteBulkSelectionResult {
  selectedIds: Set<string>;
  selectedCount: number;
  isSelected: (id: string) => boolean;
  toggleItem: (id: string) => void;
  toggleAll: (visibleIds: string[]) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  getSelectedEntries: (allEntries: MaterialPaletteEntry[]) => MaterialPaletteEntry[];
}

export function usePaletteBulkSelection(): UsePaletteBulkSelectionResult {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleItem = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAll = useCallback((visibleIds: string[]) => {
    setSelectedIds(prev => {
      const allSelected = visibleIds.length > 0 && visibleIds.every(id => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        visibleIds.forEach(id => next.delete(id));
        return next;
      } else {
        const next = new Set(prev);
        visibleIds.forEach(id => next.add(id));
        return next;
      }
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds(new Set(ids));
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback(
    (id: string) => selectedIds.has(id),
    [selectedIds]
  );

  const getSelectedEntries = useCallback(
    (allEntries: MaterialPaletteEntry[]) =>
      allEntries.filter(entry => selectedIds.has(entry.id)),
    [selectedIds]
  );

  return {
    selectedIds,
    selectedCount: selectedIds.size,
    isSelected,
    toggleItem,
    toggleAll,
    selectAll,
    clearSelection,
    getSelectedEntries,
  };
}
