/**
 * Hook for subscribing to messages in a Google Chat space
 * Mirrors useMessages.ts pattern from WhatsApp module
 */

import { useState, useEffect } from 'react';
import type { GChatMessage } from '../types';
import { subscribeToGChatMessages } from '../services/gchatService';

export function useGChatMessages(spaceId: string | null, messageLimit = 100) {
  const [messages, setMessages] = useState<GChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!spaceId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToGChatMessages(
      spaceId,
      (data) => {
        setMessages(data);
        setLoading(false);
        setError(null);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
      messageLimit
    );

    return unsubscribe;
  }, [spaceId, messageLimit]);

  return { messages, loading, error };
}
