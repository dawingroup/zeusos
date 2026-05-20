/**
 * useCabinetGroup — scene-level cabinet grouping state + mutations.
 *
 * Subscribes to the `designScenes/{sceneId}/groups` subcollection,
 * exposes the live list, and wraps the `groupRepo` + `scene.service`
 * helpers with application-level flows (Group / Ungroup) so the UI
 * layer doesn't duplicate the batching logic.
 *
 * The hook deliberately keeps the Firestore write in the callbacks
 * (not inside the subscription listener) — optimistic updates for
 * drag still run through `useScene.moveCabinet`, which scene.service
 * batches alongside group writes.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { subscribeToGroups } from '../services/groupRepo';
import {
  assignToGroup as sceneAssignToGroup,
  removeFromGroup as sceneRemoveFromGroup,
  ungroup as sceneUngroup,
} from '../services/scene.service';
import { createGroup as repoCreateGroup } from '../services/groupRepo';
import type { CabinetGroup } from '../types/cabinetGroup.types';

interface UseCabinetGroupResult {
  groups: CabinetGroup[];
  /** Look up by id. */
  groupById: Map<string, CabinetGroup>;
  /** Resolve a cabinet id → the group it belongs to (if any). */
  groupOf: (cabinetId: string) => CabinetGroup | null;
  /** All cabinet ids that belong to the same group as `cabinetId`
   *  (includes `cabinetId` itself). If not grouped, returns `[cabinetId]`. */
  siblingIds: (cabinetId: string) => string[];
  /** Create a new group with the given cabinets as members. */
  createGroup: (cabinetIds: string[], name?: string) => Promise<string>;
  /** Add more cabinets to an existing group. */
  addToGroup: (groupId: string, cabinetIds: string[]) => Promise<void>;
  /** Remove a single cabinet from its group (group kept alive). */
  removeFromGroup: (cabinetId: string) => Promise<void>;
  /** Delete a group entirely (all members un-grouped). */
  ungroup: (groupId: string) => Promise<void>;
  isLoading: boolean;
}

export function useCabinetGroup(sceneId: string | null | undefined): UseCabinetGroupResult {
  const [groups, setGroups] = useState<CabinetGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!sceneId) {
      setGroups([]);
      return;
    }
    setIsLoading(true);
    const unsub = subscribeToGroups(
      sceneId,
      (next) => {
        setGroups(next);
        setIsLoading(false);
      },
      (err) => {
        console.warn('[useCabinetGroup] subscribe error:', err);
        setIsLoading(false);
      },
    );
    return unsub;
  }, [sceneId]);

  const groupById = useMemo(() => {
    const m = new Map<string, CabinetGroup>();
    for (const g of groups) m.set(g.id, g);
    return m;
  }, [groups]);

  // cabinetId → group lookup. Built once per groups change.
  const cabinetToGroup = useMemo(() => {
    const m = new Map<string, CabinetGroup>();
    for (const g of groups) {
      for (const cabId of g.cabinetIds) m.set(cabId, g);
    }
    return m;
  }, [groups]);

  const groupOf = useCallback((cabinetId: string) => {
    return cabinetToGroup.get(cabinetId) ?? null;
  }, [cabinetToGroup]);

  const siblingIds = useCallback((cabinetId: string) => {
    const g = cabinetToGroup.get(cabinetId);
    return g ? g.cabinetIds.slice() : [cabinetId];
  }, [cabinetToGroup]);

  const createGroup = useCallback(async (cabinetIds: string[], name?: string) => {
    if (!sceneId) throw new Error('No scene loaded');
    if (cabinetIds.length === 0) throw new Error('Cannot create an empty group');
    const groupId = await repoCreateGroup({ sceneId, name, cabinetIds });
    // Wire cabinets → new group. groupRepo.createGroup already wrote the
    // group's cabinetIds list; `assignToGroup` fills in each cabinet's
    // `groupId` FK and handles any prior memberships atomically.
    await sceneAssignToGroup(sceneId, cabinetIds, groupId);
    return groupId;
  }, [sceneId]);

  const addToGroup = useCallback(async (groupId: string, cabinetIds: string[]) => {
    if (!sceneId) throw new Error('No scene loaded');
    await sceneAssignToGroup(sceneId, cabinetIds, groupId);
  }, [sceneId]);

  const removeFromGroup = useCallback(async (cabinetId: string) => {
    if (!sceneId) throw new Error('No scene loaded');
    await sceneRemoveFromGroup(sceneId, cabinetId);
  }, [sceneId]);

  const ungroup = useCallback(async (groupId: string) => {
    if (!sceneId) throw new Error('No scene loaded');
    await sceneUngroup(sceneId, groupId);
  }, [sceneId]);

  return {
    groups,
    groupById,
    groupOf,
    siblingIds,
    createGroup,
    addToGroup,
    removeFromGroup,
    ungroup,
    isLoading,
  };
}
