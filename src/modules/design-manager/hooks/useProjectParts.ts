/**
 * useProjectParts Hook
 * Manages project-level parts library
 */

import { useState, useEffect, useCallback } from 'react';
import type { ProjectPart } from '../types';
import type { DesignClip } from '@/subsidiaries/finishes/clipper/types';
import {
  subscribeToProjectParts,
  createProjectPartFromClip,
  createProjectPart,
  updateProjectPart,
  deleteProjectPart,
  bulkConvertClipsToProjectParts,
  promoteToMaterialsDatabase,
} from '../services/projectPartsService';

interface UseProjectPartsReturn {
  parts: ProjectPart[];
  loading: boolean;
  error: Error | null;
  createFromClip: (clip: DesignClip) => Promise<string>;
  create: (data: Omit<ProjectPart, 'id' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  update: (partId: string, updates: Partial<ProjectPart>) => Promise<void>;
  remove: (partId: string) => Promise<void>;
  bulkConvertFromClips: (clips: DesignClip[]) => Promise<string[]>;
  promoteToMaterials: (partId: string) => Promise<string>;
}

export function useProjectParts(projectId: string | undefined, userId: string): UseProjectPartsReturn {
  const [parts, setParts] = useState<ProjectPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!projectId) {
      setParts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToProjectParts(
      projectId,
      (data) => {
        setParts(data);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [projectId]);

  const createFromClip = useCallback(async (clip: DesignClip): Promise<string> => {
    if (!projectId) throw new Error('No project ID');
    return createProjectPartFromClip(projectId, clip, userId);
  }, [projectId, userId]);

  const create = useCallback(async (
    data: Omit<ProjectPart, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<string> => {
    if (!projectId) throw new Error('No project ID');
    return createProjectPart(projectId, data, userId);
  }, [projectId, userId]);

  const update = useCallback(async (partId: string, updates: Partial<ProjectPart>): Promise<void> => {
    if (!projectId) throw new Error('No project ID');
    return updateProjectPart(projectId, partId, updates);
  }, [projectId]);

  const remove = useCallback(async (partId: string): Promise<void> => {
    if (!projectId) throw new Error('No project ID');
    return deleteProjectPart(projectId, partId);
  }, [projectId]);

  const bulkConvertFromClips = useCallback(async (clips: DesignClip[]): Promise<string[]> => {
    if (!projectId) throw new Error('No project ID');
    return bulkConvertClipsToProjectParts(projectId, clips, userId);
  }, [projectId, userId]);

  const promoteToMaterials = useCallback(async (partId: string): Promise<string> => {
    if (!projectId) throw new Error('No project ID');
    return promoteToMaterialsDatabase(projectId, partId, userId);
  }, [projectId, userId]);

  return {
    parts,
    loading,
    error,
    createFromClip,
    create,
    update,
    remove,
    bulkConvertFromClips,
    promoteToMaterials,
  };
}
