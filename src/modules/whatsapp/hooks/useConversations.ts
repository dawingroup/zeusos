/**
 * Hook: Subscribe to WhatsApp conversations list
 */

import { useState, useEffect } from 'react';
import { subscribeToConversations } from '../services/whatsappService';
import type { WhatsAppConversation, ConversationFilter } from '../types';

export function useConversations(filter?: ConversationFilter) {
  const [conversations, setConversations] = useState<WhatsAppConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToConversations(
      (data) => {
        setConversations(data);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
      filter
    );

    return unsubscribe;
  }, [filter?.customerId, filter?.assignedTo, filter?.status, filter?.search]);

  return { conversations, loading, error };
}
