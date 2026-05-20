/**
 * useCampaignSends Hook
 * Subscribe to campaign sends (messages) with real-time updates
 */

import { useState, useEffect } from 'react';
import type { CampaignSend } from '../types';
import { subscribeToCampaignSends } from '../services/campaignService';

export interface UseCampaignSendsResult {
  sends: CampaignSend[];
  loading: boolean;
  error: Error | null;
}

/**
 * Subscribe to campaign sends
 */
export function useCampaignSends(
  campaignId: string | undefined,
  limitCount = 100
): UseCampaignSendsResult {
  const [sends, setSends] = useState<CampaignSend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!campaignId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToCampaignSends(
      campaignId,
      (data) => {
        setSends(data);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
      limitCount
    );

    return () => {
      unsubscribe();
    };
  }, [campaignId, limitCount]);

  return { sends, loading, error };
}
