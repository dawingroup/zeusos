/**
 * useDesignOptions Hook
 * React hook for managing design options with real-time updates
 */

import { useState, useEffect, useCallback } from 'react';
import {
  createDesignOption,
  updateDesignOption,
  deleteDesignOption,
  addInspirationToOption,
  linkClipToOption,
  removeInspirationFromOption,
  reorderInspirations,
  submitForApproval,
  subscribeToDesignOptions,
  getProjectDesignOptions,
} from '../services/designOptionsService';
import type {
  DesignOption,
  DesignOptionFormData,
  DesignOptionInspiration,
  DesignOptionFilters,
  SubmitForApprovalOptions,
} from '../types/designOptions';

interface UseDesignOptionsOptions {
  projectId: string;
  designItemId?: string;
  filters?: DesignOptionFilters;
  realtime?: boolean;
}

interface UseDesignOptionsReturn {
  /** List of design options */
  options: DesignOption[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Refresh options from server */
  refresh: () => Promise<void>;
  /** Create a new design option */
  createOption: (data: DesignOptionFormData, userId: string) => Promise<DesignOption>;
  /** Update an existing option */
  updateOption: (optionId: string, updates: Partial<DesignOption>) => Promise<void>;
  /** Delete an option */
  deleteOption: (optionId: string) => Promise<void>;
  /** Add inspiration to an option */
  addInspiration: (optionId: string, inspiration: DesignOptionInspiration) => Promise<void>;
  /** Link existing clip to an option */
  linkClip: (optionId: string, clipId: string) => Promise<void>;
  /** Remove inspiration from an option */
  removeInspiration: (optionId: string, inspirationId: string) => Promise<void>;
  /** Reorder inspirations */
  reorderInspirations: (optionId: string, inspirationIds: string[]) => Promise<void>;
  /** Submit option for client approval */
  submitForApproval: (optionId: string, userId: string, options?: SubmitForApprovalOptions) => Promise<{ approvalItemId: string }>;
}

export function useDesignOptions({
  projectId,
  designItemId,
  filters,
  realtime = true,
}: UseDesignOptionsOptions): UseDesignOptionsReturn {
  const [options, setOptions] = useState<DesignOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Merge designItemId into filters
  const mergedFilters: DesignOptionFilters = {
    ...filters,
    designItemId: designItemId || filters?.designItemId,
  };

  // Load/subscribe to options
  useEffect(() => {
    setLoading(true);
    setError(null);

    if (realtime) {
      // Real-time subscription
      const unsubscribe = subscribeToDesignOptions(
        projectId,
        (fetchedOptions) => {
          setOptions(fetchedOptions);
          setLoading(false);
        },
        mergedFilters
      );

      return unsubscribe;
    } else {
      // One-time fetch
      getProjectDesignOptions(projectId, mergedFilters)
        .then((fetchedOptions) => {
          setOptions(fetchedOptions);
          setLoading(false);
        })
        .catch((err) => {
          setError(err instanceof Error ? err : new Error('Failed to fetch options'));
          setLoading(false);
        });
    }
  }, [projectId, designItemId, realtime, JSON.stringify(filters)]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const fetchedOptions = await getProjectDesignOptions(projectId, mergedFilters);
      setOptions(fetchedOptions);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to refresh options'));
    } finally {
      setLoading(false);
    }
  }, [projectId, mergedFilters]);

  const createOptionHandler = useCallback(
    async (data: DesignOptionFormData, userId: string) => {
      const option = await createDesignOption(
        projectId,
        data,
        userId,
        designItemId,
        undefined // designItemName would need to be passed in
      );
      // If not using realtime, manually add to state
      if (!realtime) {
        setOptions((prev) => [option, ...prev]);
      }
      return option;
    },
    [projectId, designItemId, realtime]
  );

  const updateOptionHandler = useCallback(
    async (optionId: string, updates: Partial<DesignOption>) => {
      await updateDesignOption(optionId, updates);
      // If not using realtime, manually update state
      if (!realtime) {
        setOptions((prev) =>
          prev.map((opt) => (opt.id === optionId ? { ...opt, ...updates } : opt))
        );
      }
    },
    [realtime]
  );

  const deleteOptionHandler = useCallback(
    async (optionId: string) => {
      await deleteDesignOption(optionId);
      // If not using realtime, manually remove from state
      if (!realtime) {
        setOptions((prev) => prev.filter((opt) => opt.id !== optionId));
      }
    },
    [realtime]
  );

  const addInspirationHandler = useCallback(
    async (optionId: string, inspiration: DesignOptionInspiration) => {
      await addInspirationToOption(optionId, inspiration);
      if (!realtime) {
        await refresh();
      }
    },
    [realtime, refresh]
  );

  const linkClipHandler = useCallback(
    async (optionId: string, clipId: string) => {
      await linkClipToOption(optionId, clipId);
      if (!realtime) {
        await refresh();
      }
    },
    [realtime, refresh]
  );

  const removeInspirationHandler = useCallback(
    async (optionId: string, inspirationId: string) => {
      await removeInspirationFromOption(optionId, inspirationId);
      if (!realtime) {
        await refresh();
      }
    },
    [realtime, refresh]
  );

  const reorderInspirationsHandler = useCallback(
    async (optionId: string, inspirationIds: string[]) => {
      await reorderInspirations(optionId, inspirationIds);
      if (!realtime) {
        await refresh();
      }
    },
    [realtime, refresh]
  );

  const submitForApprovalHandler = useCallback(
    async (optionId: string, userId: string, opts?: SubmitForApprovalOptions) => {
      const result = await submitForApproval(optionId, userId, opts);
      if (!realtime) {
        await refresh();
      }
      return result;
    },
    [realtime, refresh]
  );

  return {
    options,
    loading,
    error,
    refresh,
    createOption: createOptionHandler,
    updateOption: updateOptionHandler,
    deleteOption: deleteOptionHandler,
    addInspiration: addInspirationHandler,
    linkClip: linkClipHandler,
    removeInspiration: removeInspirationHandler,
    reorderInspirations: reorderInspirationsHandler,
    submitForApproval: submitForApprovalHandler,
  };
}

export default useDesignOptions;
