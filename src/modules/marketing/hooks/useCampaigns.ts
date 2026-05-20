/**
 * useCampaigns Hook
 * Subscribe to campaigns list with real-time updates
 */

import { useState, useEffect } from 'react';
import type { MarketingCampaign, CampaignFilters } from '../types';
import { subscribeToCampaigns } from '../services/campaignService';

export interface UseCampaignsResult {
  campaigns: MarketingCampaign[];
  loading: boolean;
  error: Error | null;
}

/**
 * Subscribe to campaigns list for a company
 */
export function useCampaigns(
  companyId: string | undefined,
  filters: CampaignFilters = {}
): UseCampaignsResult {
  const [campaigns, setCampaigns] = useState<MarketingCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToCampaigns(
      companyId,
      (data) => {
        setCampaigns(data);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      },
      filters
    );

    return () => {
      unsubscribe();
    };
  }, [companyId, JSON.stringify(filters)]);

  return { campaigns, loading, error };
}
