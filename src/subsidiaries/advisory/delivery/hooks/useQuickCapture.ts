/**
 * QUICK CAPTURE HOOKS
 *
 * Vanilla React hooks following the existing delivery module pattern.
 * Uses useState + useCallback + useEffect (no TanStack React Query).
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { getFirestore } from 'firebase/firestore';
import { QuickCaptureService } from '../services/quick-capture-service';
import type { QuickCaptureInput, QuickCaptureIndex } from '../types/quick-capture';
import type { Requisition } from '../types/requisition';

function getService() {
  return QuickCaptureService.getInstance(getFirestore());
}

// ─────────────────────────────────────────────────────────────────
// useCreateQuickCapture
// ─────────────────────────────────────────────────────────────────

export function useCreateQuickCapture() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createCapture = useCallback(
    async (
      data: QuickCaptureInput,
      userId: string,
      orgId: string
    ): Promise<string> => {
      setLoading(true);
      setError(null);
      try {
        const id = await getService().createQuickCapture(data, userId, orgId);
        return id;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to create quick capture');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { createCapture, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// useUnlinkedCaptures
// ─────────────────────────────────────────────────────────────────

export function useUnlinkedCaptures(orgId: string | undefined) {
  const [captures, setCaptures] = useState<QuickCaptureIndex[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCaptures = useCallback(async () => {
    if (!orgId) {
      setCaptures([]);
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const result = await getService().getUnlinkedCaptures(orgId);
      setCaptures(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch unlinked captures'));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    fetchCaptures();

    // Refresh every 60s to keep countdown timers fresh
    intervalRef.current = setInterval(fetchCaptures, 60_000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchCaptures]);

  return { captures, loading, error, refresh: fetchCaptures };
}

// ─────────────────────────────────────────────────────────────────
// useLinkCapture
// ─────────────────────────────────────────────────────────────────

export function useLinkCapture() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const linkCapture = useCallback(
    async (
      captureId: string,
      projectId: string,
      requisitionId: string,
      userId: string,
      orgId: string
    ): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        await getService().linkCaptureToRequisition(
          captureId,
          projectId,
          requisitionId,
          userId,
          orgId
        );
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to link capture');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { linkCapture, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// useCreateRetroactiveRequisition
// ─────────────────────────────────────────────────────────────────

export function useCreateRetroactiveRequisition() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const createRetroactive = useCallback(
    async (
      captureId: string,
      projectId: string,
      userId: string,
      orgId: string
    ): Promise<string> => {
      setLoading(true);
      setError(null);
      try {
        const reqId = await getService().createRetroactiveRequisition(
          captureId,
          projectId,
          userId,
          orgId
        );
        return reqId;
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to create retroactive requisition');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { createRetroactive, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// useMatchingRequisitions
// ─────────────────────────────────────────────────────────────────

export function useMatchingRequisitions(
  projectId: string | undefined,
  amount: number
) {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchMatches = useCallback(async () => {
    if (!projectId || amount <= 0) {
      setRequisitions([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await getService().getMatchingRequisitions(projectId, amount);
      setRequisitions(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch matching requisitions'));
    } finally {
      setLoading(false);
    }
  }, [projectId, amount]);

  useEffect(() => {
    fetchMatches();
  }, [fetchMatches]);

  return { requisitions, loading, error, refresh: fetchMatches };
}

// ─────────────────────────────────────────────────────────────────
// useVoidCapture
// ─────────────────────────────────────────────────────────────────

export function useVoidCapture() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const voidCapture = useCallback(
    async (
      captureId: string,
      reason: string,
      userId: string,
      orgId: string
    ): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        await getService().voidCapture(captureId, reason, userId, orgId);
      } catch (err) {
        const error = err instanceof Error ? err : new Error('Failed to void capture');
        setError(error);
        throw error;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return { voidCapture, loading, error };
}
