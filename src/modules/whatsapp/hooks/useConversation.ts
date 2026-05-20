/**
 * Hook: Subscribe to a single WhatsApp conversation
 */

import { useState, useEffect } from 'react';
import { subscribeToConversation } from '../services/whatsappService';
import type { WhatsAppConversation } from '../types';

export function useConversation(conversationId: string | undefined) {
  const [conversation, setConversation] = useState<WhatsAppConversation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!conversationId) {
      setConversation(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToConversation(
      conversationId,
      (data) => {
        setConversation(data);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [conversationId]);

  return { conversation, loading, error };
}
