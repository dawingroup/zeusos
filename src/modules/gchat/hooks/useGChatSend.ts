/**
 * Hook for sending messages to Google Chat spaces
 * Mirrors useWhatsAppSend.ts pattern from WhatsApp module
 */

import { useState, useCallback } from 'react';
import { sendGChatMessage } from '../services/gchatApiService';

export function useGChatSend() {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = useCallback(
    async (spaceId: string, text: string, threadKey?: string) => {
      setSending(true);
      setError(null);

      try {
        const result = await sendGChatMessage({ spaceId, text, threadKey });
        if (!result.success) {
          setError(result.error || 'Failed to send message');
        }
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to send message';
        setError(message);
        return { success: false, error: message };
      } finally {
        setSending(false);
      }
    },
    []
  );

  return { send, sending, error };
}
