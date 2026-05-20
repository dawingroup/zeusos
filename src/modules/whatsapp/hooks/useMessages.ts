/**
 * Hook: Subscribe to messages for a conversation
 */

import { useState, useEffect } from 'react';
import { subscribeToMessages } from '../services/whatsappService';
import type { WhatsAppMessage } from '../types';

export function useMessages(conversationId: string | undefined, limit = 100) {
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToMessages(
      conversationId,
      (data) => {
        setMessages(data);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
      limit
    );

    return unsubscribe;
  }, [conversationId, limit]);

  return { messages, loading, error };
}
