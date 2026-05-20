/**
 * Hook for subscribing to a single Google Chat space
 * Mirrors useConversation.ts pattern from WhatsApp module
 */

import { useState, useEffect } from 'react';
import type { GChatSpace } from '../types';
import { subscribeToSpace, markSpaceRead } from '../services/gchatService';

export function useSpace(spaceId: string | null) {
  const [space, setSpace] = useState<GChatSpace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!spaceId) {
      setSpace(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToSpace(
      spaceId,
      (data) => {
        setSpace(data);
        setLoading(false);
        setError(null);

        // Auto-mark as read when viewing
        if (data && data.unreadCount > 0) {
          markSpaceRead(spaceId).catch(console.error);
        }
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [spaceId]);

  return { space, loading, error };
}
