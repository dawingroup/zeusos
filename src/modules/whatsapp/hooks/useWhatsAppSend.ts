/**
 * Hook: Send WhatsApp messages (text, template, image)
 */

import { useState, useCallback } from 'react';
import { sendWhatsAppMessage } from '../services/whatsappApiService';
import type { SendMessagePayload, SendMessageResult } from '../types';

export function useWhatsAppSend() {
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastResult, setLastResult] = useState<SendMessageResult | null>(null);

  const send = useCallback(async (payload: SendMessagePayload): Promise<SendMessageResult> => {
    setSending(true);
    setError(null);

    try {
      const result = await sendWhatsAppMessage(payload);
      setLastResult(result);

      if (!result.success) {
        setError(result.error || 'Failed to send message');
      }

      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send message';
      setError(message);
      return {
        success: false,
        conversationId: payload.conversationId || '',
        messageId: '',
        error: message,
      };
    } finally {
      setSending(false);
    }
  }, []);

  const sendText = useCallback(
    (conversationId: string, phoneNumber: string, text: string) =>
      send({ conversationId, phoneNumber, messageType: 'text', text }),
    [send]
  );

  const sendTemplate = useCallback(
    (conversationId: string, phoneNumber: string, templateId: string, templateName: string, templateParams?: Record<string, string>) =>
      send({ conversationId, phoneNumber, messageType: 'template', templateId, templateName, templateParams }),
    [send]
  );

  const sendImage = useCallback(
    (conversationId: string, phoneNumber: string, imageUrl: string, imageCaption?: string) =>
      send({ conversationId, phoneNumber, messageType: 'image', imageUrl, imageCaption }),
    [send]
  );

  const clearError = useCallback(() => setError(null), []);

  return { send, sendText, sendTemplate, sendImage, sending, error, lastResult, clearError };
}
