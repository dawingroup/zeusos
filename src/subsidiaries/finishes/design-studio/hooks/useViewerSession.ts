/**
 * useViewerSession — Save/load viewer sessions from Firestore
 */

import { useState, useEffect, useCallback } from 'react';
import type { ViewerSession } from '../types/workshop-viewer.types';
import {
  subscribeToSessions,
  getSession,
  createSession,
  deleteSession,
} from '../services/workshopViewerService';

interface UseViewerSessionReturn {
  sessions: ViewerSession[];
  currentSession: ViewerSession | null;
  loading: boolean;
  error: string | null;
  loadSession: (id: string) => Promise<ViewerSession | null>;
  saveNewSession: typeof createSession;
  removeSession: (id: string) => Promise<void>;
}

export function useViewerSession(): UseViewerSessionReturn {
  const [sessions, setSessions] = useState<ViewerSession[]>([]);
  const [currentSession, setCurrentSession] = useState<ViewerSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Subscribe to session list
  useEffect(() => {
    const unsubscribe = subscribeToSessions(
      (data) => {
        setSessions(data);
        setLoading(false);
      },
      (err) => {
        setError(`Failed to load sessions: ${err.message}`);
        setLoading(false);
      },
    );
    return () => unsubscribe();
  }, []);

  const loadSession = useCallback(async (id: string) => {
    try {
      const session = await getSession(id);
      setCurrentSession(session);
      return session;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session');
      return null;
    }
  }, []);

  const removeSession = useCallback(async (id: string) => {
    try {
      await deleteSession(id);
      if (currentSession?.id === id) setCurrentSession(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete session');
    }
  }, [currentSession]);

  return {
    sessions,
    currentSession,
    loading,
    error,
    loadSession,
    saveNewSession: createSession,
    removeSession,
  };
}
