/**
 * Hook: Subscribe to WhatsApp message templates
 * By default fetches only approved templates. Pass includeAll to get all statuses.
 */

import { useState, useEffect } from 'react';
import { subscribeToTemplates, subscribeToAllTemplates } from '../services/whatsappService';
import type { WhatsAppTemplate } from '../types';

interface Options {
  includeAll?: boolean;
}

export function useWhatsAppTemplates(options?: Options) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const includeAll = options?.includeAll ?? false;

  useEffect(() => {
    setLoading(true);

    const subscribeFn = includeAll ? subscribeToAllTemplates : subscribeToTemplates;

    const unsubscribe = subscribeFn(
      (data) => {
        setTemplates(data);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return unsubscribe;
  }, [includeAll]);

  return { templates, loading, error };
}
