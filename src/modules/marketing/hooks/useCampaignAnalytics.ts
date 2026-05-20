/**
 * useCampaignAnalytics Hook
 * Subscribe to aggregated analytics and compute date-range analytics
 */

import { useState, useEffect, useMemo } from 'react';
import type { MarketingCampaign, DateRangeAnalytics, CampaignPerformance } from '../types';
import {
  subscribeToAggregatedAnalytics,
  computeDateRangeAnalytics,
  getTopCampaigns,
  type AggregatedAnalytics,
} from '../services/analyticsService';
import { useCampaigns } from './useCampaigns';

export interface UseCampaignAnalyticsResult {
  /** Pre-aggregated analytics from Cloud Function (all-time) */
  aggregated: AggregatedAnalytics | null;
  /** Client-computed analytics for the selected date range */
  dateRange: DateRangeAnalytics | null;
  /** Top performing campaigns */
  topCampaigns: CampaignPerformance[];
  /** All campaigns (used for computing) */
  campaigns: MarketingCampaign[];
  loading: boolean;
  error: Error | null;
}

export function useCampaignAnalytics(
  companyId: string | undefined,
  startDate: Date,
  endDate: Date
): UseCampaignAnalyticsResult {
  const [aggregated, setAggregated] = useState<AggregatedAnalytics | null>(null);
  const [aggLoading, setAggLoading] = useState(true);
  const [aggError, setAggError] = useState<Error | null>(null);

  const { campaigns, loading: campaignsLoading, error: campaignsError } = useCampaigns(companyId);

  // Subscribe to pre-aggregated analytics
  useEffect(() => {
    if (!companyId) {
      setAggLoading(false);
      return;
    }

    setAggLoading(true);
    const unsubscribe = subscribeToAggregatedAnalytics(
      companyId,
      (data) => {
        setAggregated(data);
        setAggLoading(false);
      },
      (err) => {
        setAggError(err);
        setAggLoading(false);
      }
    );

    return () => unsubscribe();
  }, [companyId]);

  // Compute date range analytics from campaigns
  const dateRange = useMemo(() => {
    if (campaigns.length === 0) return null;
    return computeDateRangeAnalytics(campaigns, startDate, endDate);
  }, [campaigns, startDate.getTime(), endDate.getTime()]);

  // Top campaigns
  const topCampaigns = useMemo(
    () => getTopCampaigns(campaigns, 'engagementRate', 5),
    [campaigns]
  );

  return {
    aggregated,
    dateRange,
    topCampaigns,
    campaigns,
    loading: aggLoading || campaignsLoading,
    error: aggError || campaignsError,
  };
}
