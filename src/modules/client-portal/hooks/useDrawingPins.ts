/**
 * useDrawingPins — pin comments thread for a single design signoff.
 * Loads on mount + exposes mutation helpers that refetch on success
 * so the page stays in sync without realtime subscriptions.
 *
 * Optimistic updates aren't wired — the writes are infrequent and the
 * refetch is fast. Re-evaluate when the portal goes realtime.
 */

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext.jsx';
import {
  addComment as addCommentRaw,
  addPin as addPinRaw,
  deletePin as deletePinRaw,
  getPinsForSignOff,
  reopenPin as reopenPinRaw,
  resolvePin as resolvePinRaw,
  type DrawingPin,
} from '@/modules/customer-hub/services/client-portal/drawingPinsService';

export interface DrawingPinsState {
  pins: DrawingPin[];
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
  addPin: (args: { x: number; y: number; firstComment: string }) => Promise<DrawingPin | null>;
  addComment: (pinId: string, body: string) => Promise<void>;
  resolvePin: (pinId: string) => Promise<void>;
  reopenPin: (pinId: string) => Promise<void>;
  deletePin: (pinId: string) => Promise<void>;
}

interface UseDrawingPinsArgs {
  signOffId: string | undefined;
  /**
   * Whether the current viewer is a client (portal) user. Drives the
   * `isClient` flag on every comment + the visual chip in the
   * comments thread.
   */
  isClient: boolean;
}

export function useDrawingPins({ signOffId, isClient }: UseDrawingPinsArgs): DrawingPinsState {
  const { user } = useAuth();
  const [pins, setPins] = useState<DrawingPin[]>([]);
  const [loading, setLoading] = useState<boolean>(!!signOffId);
  const [error, setError] = useState<Error | null>(null);

  const refetch = useCallback(async () => {
    if (!signOffId) {
      setPins([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const fresh = await getPinsForSignOff(signOffId);
      setPins(fresh);
    } catch (err) {
      setError(err as Error);
    } finally {
      setLoading(false);
    }
  }, [signOffId]);

  useEffect(() => { void refetch(); }, [refetch]);

  const addPin: DrawingPinsState['addPin'] = useCallback(async ({ x, y, firstComment }) => {
    if (!user || !signOffId) return null;
    const highestN = pins.reduce((m, p) => (p.n > m ? p.n : m), 0);
    try {
      const newPin = await addPinRaw({
        signOffId, x, y,
        firstComment,
        highestN,
        user,
        isClient,
      });
      // Optimistic insert + refetch for consistency.
      setPins((prev) => [...prev, newPin]);
      void refetch();
      return newPin;
    } catch (err) {
      setError(err as Error);
      return null;
    }
  }, [user, signOffId, pins, isClient, refetch]);

  const addComment: DrawingPinsState['addComment'] = useCallback(async (pinId, body) => {
    if (!user) return;
    await addCommentRaw({ pinId, body, user, isClient });
    await refetch();
  }, [user, isClient, refetch]);

  const resolvePin: DrawingPinsState['resolvePin'] = useCallback(async (pinId) => {
    if (!user) return;
    await resolvePinRaw(pinId, user);
    await refetch();
  }, [user, refetch]);

  const reopenPin: DrawingPinsState['reopenPin'] = useCallback(async (pinId) => {
    if (!user) return;
    await reopenPinRaw(pinId, user);
    await refetch();
  }, [user, refetch]);

  const deletePin: DrawingPinsState['deletePin'] = useCallback(async (pinId) => {
    await deletePinRaw(pinId);
    await refetch();
  }, [refetch]);

  return { pins, loading, error, refetch, addPin, addComment, resolvePin, reopenPin, deletePin };
}
