/**
 * Analytics Service
 * Reads aggregated analytics and computes client-side analytics from campaigns
 */

import {
  doc,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { COLLECTIONS } from '../constants';
import type {
  MarketingCampaign,
  CampaignType,
  DateRangeAnalytics,
  DailyMetric,
  CampaignTypeBreakdown,
  PlatformBreakdown,
  CampaignPerformance,
} from '../types';

// ============================================
// Read Aggregated Analytics
// ============================================

export interface AggregatedAnalytics {
  companyId: string;
  totalCampaigns: number;
  activeCampaigns: number;
  completedCampaigns: number;
  totalSent: number;
  totalReached: number;
  totalEngagements: number;
  totalConversions: number;
  avgEngagementRate: number;
  avgConversionRate: number;
  totalWhatsAppDelivered: number;
  totalWhatsAppRead: number;
  totalWhatsAppReplied: number;
  whatsappDeliveryRate: number;
  whatsappReadRate: number;
  whatsappReplyRate: number;
  metricsByType: Record<string, {
    totalCampaigns: number;
    totalSent: number;
    totalEngagements: number;
    totalConversions: number;
    avgEngagementRate: number;
    avgConversionRate: number;
  }>;
  topCampaigns: CampaignPerformance[];
  recentCampaignsCount: number;
  last30DaysSent: number;
  last30DaysEngagements: number;
  calculatedAt?: Timestamp;
}

/**
 * Subscribe to pre-aggregated analytics from Cloud Function output
 */
export function subscribeToAggregatedAnalytics(
  companyId: string,
  callback: (data: AggregatedAnalytics | null) => void,
  onError?: (error: Error) => void
): () => void {
  const docRef = doc(db, COLLECTIONS.ANALYTICS, `${companyId}_all_time`);

  return onSnapshot(
    docRef,
    (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as AggregatedAnalytics);
      } else {
        callback(null);
      }
    },
    (error) => {
      console.error('Error subscribing to aggregated analytics:', error);
      onError?.(error);
    }
  );
}

// ============================================
// Compute Analytics from Campaign Data
// ============================================

/**
 * Compute date range analytics from a list of campaigns (client-side computation)
 */
export function computeDateRangeAnalytics(
  campaigns: MarketingCampaign[],
  startDate: Date,
  endDate: Date
): DateRangeAnalytics {
  // Filter campaigns within date range
  const filtered = campaigns.filter((c) => {
    const created = c.createdAt?.toDate?.();
    if (!created) return false;
    return created >= startDate && created <= endDate;
  });

  // Summary metrics
  const totalSent = filtered.reduce((s, c) => s + (c.metrics?.totalSent || 0), 0);
  const totalReach = filtered.reduce((s, c) => s + (c.metrics?.totalReached || 0), 0);
  const totalEngagements = filtered.reduce((s, c) => s + (c.metrics?.totalEngagements || 0), 0);
  const totalConversions = filtered.reduce((s, c) => s + (c.metrics?.totalConversions || 0), 0);

  const totalRevenue = filtered.reduce((s, c) => {
    if (c.budget && c.metrics?.roi) return s + c.budget * c.metrics.roi;
    return s;
  }, 0);
  const totalSpent = filtered.reduce((s, c) => s + (c.budget || 0), 0);

  // Daily metrics
  const dailyMap = new Map<string, DailyMetric>();
  const dayMs = 24 * 60 * 60 * 1000;
  for (let d = new Date(startDate); d <= endDate; d = new Date(d.getTime() + dayMs)) {
    const key = d.toISOString().split('T')[0];
    dailyMap.set(key, { date: key, sent: 0, reach: 0, engagements: 0, revenue: 0 });
  }

  filtered.forEach((c) => {
    const created = c.createdAt?.toDate?.();
    if (!created) return;
    const key = created.toISOString().split('T')[0];
    const entry = dailyMap.get(key);
    if (entry) {
      entry.sent += c.metrics?.totalSent || 0;
      entry.reach += c.metrics?.totalReached || 0;
      entry.engagements += c.metrics?.totalEngagements || 0;
    }
  });

  const dailyMetrics = Array.from(dailyMap.values()).sort(
    (a, b) => a.date.localeCompare(b.date)
  );

  // Campaign type breakdown
  const typeMap = new Map<CampaignType, CampaignTypeBreakdown>();
  filtered.forEach((c) => {
    if (!typeMap.has(c.campaignType)) {
      typeMap.set(c.campaignType, {
        type: c.campaignType,
        count: 0,
        sent: 0,
        reach: 0,
        engagementRate: 0,
        revenue: 0,
      });
    }
    const entry = typeMap.get(c.campaignType)!;
    entry.count++;
    entry.sent += c.metrics?.totalSent || 0;
    entry.reach += c.metrics?.totalReached || 0;
  });

  const campaignTypeBreakdown = Array.from(typeMap.values()).map((t) => ({
    ...t,
    engagementRate: t.sent > 0 ? (t.reach / t.sent) : 0,
  }));

  // Platform breakdown
  const platformMap = new Map<string, PlatformBreakdown>();
  filtered.forEach((c) => {
    if (c.campaignType === 'whatsapp' || c.campaignType === 'hybrid') {
      if (!platformMap.has('whatsapp')) {
        platformMap.set('whatsapp', { platform: 'WhatsApp', count: 0, reach: 0, engagementRate: 0 });
      }
      const e = platformMap.get('whatsapp')!;
      e.count++;
      e.reach += c.metrics?.totalReached || 0;
    }
    if (c.campaignType === 'social_media' || c.campaignType === 'hybrid') {
      if (!platformMap.has('social')) {
        platformMap.set('social', { platform: 'Social Media', count: 0, reach: 0, engagementRate: 0 });
      }
      const e = platformMap.get('social')!;
      e.count++;
      e.reach += c.metrics?.totalReached || 0;
    }
  });

  return {
    startDate,
    endDate,
    totalCampaigns: filtered.length,
    totalSent,
    totalReach,
    totalEngagements,
    totalRevenue,
    totalSpent,
    averageEngagementRate: totalSent > 0 ? totalEngagements / totalSent : 0,
    averageConversionRate: totalSent > 0 ? totalConversions / totalSent : 0,
    averageROI: totalSpent > 0 ? (totalRevenue - totalSpent) / totalSpent : 0,
    dailyMetrics,
    campaignTypeBreakdown,
    platformBreakdown: Array.from(platformMap.values()),
  };
}

/**
 * Get top performing campaigns sorted by a metric
 */
export function getTopCampaigns(
  campaigns: MarketingCampaign[],
  sortBy: 'reach' | 'engagementRate' | 'conversions' = 'engagementRate',
  limit = 5
): CampaignPerformance[] {
  return campaigns
    .filter((c) => c.metrics?.totalSent > 0)
    .sort((a, b) => {
      switch (sortBy) {
        case 'reach':
          return (b.metrics?.totalReached || 0) - (a.metrics?.totalReached || 0);
        case 'conversions':
          return (b.metrics?.totalConversions || 0) - (a.metrics?.totalConversions || 0);
        case 'engagementRate':
        default:
          return (b.metrics?.engagementRate || 0) - (a.metrics?.engagementRate || 0);
      }
    })
    .slice(0, limit)
    .map((c) => ({
      campaignId: c.id,
      campaignName: c.name,
      campaignType: c.campaignType,
      reach: c.metrics?.totalReached,
      engagementRate: c.metrics?.engagementRate,
      roi: c.metrics?.roi,
    }));
}
