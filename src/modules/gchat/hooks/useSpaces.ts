/**
 * Hook for subscribing to Google Chat spaces list
 * Mirrors useConversations.ts pattern from WhatsApp module
 */

import { useState, useEffect } from 'react';
import type { GChatSpace, SpaceFilter } from '../types';
import { subscribeToSpaces } from '../services/gchatService';

export function useSpaces(filter?: SpaceFilter) {
  const [spaces, setSpaces] = useState<GChatSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToSpaces(
      (data) => {
        setSpaces(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
      filter
    );

    return unsubscribe;
  }, [filter?.type, filter?.status, filter?.search]);

  return { spaces, loading, error };
}
