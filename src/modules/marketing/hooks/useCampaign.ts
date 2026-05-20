/**
 * useCampaign Hook
 * Subscribe to a single campaign with real-time updates
 */

import { useState, useEffect } from 'react';
import type { MarketingCampaign } from '../types';
import { subscribeToCampaign } from '../services/campaignService';

export interface UseCampaignResult {
  campaign: MarketingCampaign | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Subscribe to a single campaign
 */
export function useCampaign(campaignId: string | undefined): UseCampaignResult {
  const [campaign, setCampaign] = useState<MarketingCampaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!campaignId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToCampaign(
      campaignId,
      (data) => {
        setCampaign(data);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );

    return () => {
      unsubscribe();
    };
  }, [campaignId]);

  return { campaign, loading, error };
}
