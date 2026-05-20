/**
 * Hook: Subscribe to WhatsApp broadcast campaigns
 */

import { useState, useEffect } from 'react';
import { subscribeToBroadcasts } from '../services/whatsappService';
import type { WhatsAppBroadcast } from '../types';

export function useBroadcasts() {
  const [broadcasts, setBroadcasts] = useState<WhatsAppBroadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToBroadcasts(
      (data) => {
        setBroadcasts(data);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsubscribe;
  }, []);

  return { broadcasts, loading, error };
}
