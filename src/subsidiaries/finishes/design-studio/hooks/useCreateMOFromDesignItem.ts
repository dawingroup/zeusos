/**
 * useCreateMOFromDesignItem — React hook for the P3 release-to-production flow.
 *
 * Wraps `createMOFromDesignItem` from the scene-studio MO service with
 * async state (`isCreating` / `error` / `result`) and a stable `release`
 * callback. The dialog layer uses this — no Firestore calls in components.
 *
 * Scope is always a single DesignItem; optional `sceneIds` / `cabinetIds`
 * filters support phased production (release a subset today, another
 * batch tomorrow). The service validates everything — we just surface
 * the outcome.
 */
import { useCallback, useState } from 'react';
import {
  createMOFromDesignItem,
  type CreateMOFromDesignItemOptions,
  type CreateMOFromDesignItemResult,
} from '../services/designItemToManufacturingOrderService';

interface UseCreateMOFromDesignItemArgs {
  projectId: string;
  designItemId: string;
  userId: string;
}

export interface UseCreateMOFromDesignItemResult {
  isCreating: boolean;
  error: string | null;
  result: CreateMOFromDesignItemResult | null;
  release: (options?: CreateMOFromDesignItemOptions) => Promise<CreateMOFromDesignItemResult | null>;
  reset: () => void;
}

export function useCreateMOFromDesignItem({
  projectId,
  designItemId,
  userId,
}: UseCreateMOFromDesignItemArgs): UseCreateMOFromDesignItemResult {
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CreateMOFromDesignItemResult | null>(null);

  const release = useCallback(
    async (
      options: CreateMOFromDesignItemOptions = {},
    ): Promise<CreateMOFromDesignItemResult | null> => {
      if (!projectId || !designItemId) {
        setError('Missing projectId or designItemId — cannot create MO.');
        return null;
      }
      setIsCreating(true);
      setError(null);
      try {
        const res = await createMOFromDesignItem(
          projectId,
          designItemId,
          options,
          userId,
        );
        setResult(res);
        return res;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setError(msg);
        return null;
      } finally {
        setIsCreating(false);
      }
    },
    [projectId, designItemId, userId],
  );

  const reset = useCallback(() => {
    setError(null);
    setResult(null);
    setIsCreating(false);
  }, []);

  return { isCreating, error, result, release, reset };
}
