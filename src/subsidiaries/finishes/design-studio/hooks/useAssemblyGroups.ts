import { useState, useEffect, useCallback } from 'react';
import type { PartTreeNode, AssemblyGroup } from '../types/workshop-viewer.types';
import { suggestAssemblyGroups } from '../services/assemblyEngine';

/**
 * `hydrate` — when the caller has PERSISTED assemblies for this
 * cabinet (scene-side), pass a function that returns them converted
 * to AssemblyGroup[]. The hook seeds its state with those instead of
 * re-running the suggester, so the user's previous rearrangement
 * sticks across reloads + drawer re-opens.
 */
export function useAssemblyGroups(
  partTree: PartTreeNode[],
  hydrate?: (partTree: PartTreeNode[]) => AssemblyGroup[] | null,
) {
  const [groups, setGroups] = useState<AssemblyGroup[]>([]);
  const [isConfirmed, setIsConfirmed] = useState(false);

  // Auto-suggest when partTree changes, preferring the hydrated
  // (persisted) groups when the caller can provide them.
  useEffect(() => {
    if (partTree.length === 0) {
      setGroups([]);
      setIsConfirmed(false);
      return;
    }
    const hydrated = hydrate?.(partTree);
    if (hydrated && hydrated.length > 0) {
      setGroups(hydrated);
      setIsConfirmed(true);
      return;
    }
    const suggested = suggestAssemblyGroups(partTree);
    setGroups(suggested);
    setIsConfirmed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- hydrate is a stable ref from the caller
  }, [partTree]);

  const movePart = useCallback((partId: string, fromGroupId: string, toGroupId: string) => {
    setGroups(prev => prev.map(g => {
      if (g.id === fromGroupId) {
        return { ...g, partIds: g.partIds.filter(id => id !== partId), isUserModified: true };
      }
      if (g.id === toGroupId) {
        return { ...g, partIds: [...g.partIds, partId], isUserModified: true };
      }
      return g;
    }));
    setIsConfirmed(false);
  }, []);

  const confirmGroups = useCallback(() => {
    setIsConfirmed(true);
  }, []);

  const resetGroups = useCallback(() => {
    if (partTree.length > 0) {
      setGroups(suggestAssemblyGroups(partTree));
    }
    setIsConfirmed(false);
  }, [partTree]);

  return { groups, isConfirmed, movePart, confirmGroups, resetGroups };
}
