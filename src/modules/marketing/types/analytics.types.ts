/**
 * Analytics Types
 * Type definitions for campaign analytics and reporting
 */

import { Timestamp } from 'firebase/firestore';
import { CampaignType } from './campaign.types';

// ============================================
// Campaign Analytics Summary
// ============================================

export interface CampaignAnalyticsSummary {
  id: string; // Format: {companyId}_{date_YYYY-MM-DD}
  companyId: string;
  date: string; // YYYY-MM-DD format

  // Overall metrics
  totalActiveCampaigns: number;
  totalMessagesSent: number;
  totalReach: number;
  totalEngagements: number;
  totalRevenue: number;
  totalSpent: number;

  // By campaign type
  whatsappCampaigns: number;
  socialMediaCampaigns: number;
  productPromotions: number;
  hybridCampaigns: number;

  // Engagement rates
  overallEngagementRate: number;
  overallConversionRate: number;
  overallROI: number;

  // Top performers
  topCampaignsByReach: CampaignPerformance[];
  topCampaignsByEngagement: CampaignPerformance[];
  topCampaignsByROI: CampaignPerformance[];

  createdAt: Timestamp;
}

// ============================================
// Campaign Performance
// ============================================

export interface CampaignPerformance {
  campaignId: string;
  campaignName: string;
  campaignType: CampaignType;
  reach?: number;
  engagementRate?: number;
  roi?: number;
  revenue?: number;
}

// ============================================
// Date Range Analytics
// ============================================

export interface DateRangeAnalytics {
  startDate: Date;
  endDate: Date;

  // Summary metrics
  totalCampaigns: number;
  totalSent: number;
  totalReach: number;
  totalEngagements: number;
  totalRevenue: number;
  totalSpent: number;

  // Averages
  averageEngagementRate: number;
  averageConversionRate: number;
  averageROI: number;

  // Trends
  dailyMetrics: DailyMetric[];

  // Breakdown
  campaignTypeBreakdown: CampaignTypeBreakdown[];
  platformBreakdown: PlatformBreakdown[];
}

export interface DailyMetric {
  date: string;
  sent: number;
  reach: number;
  engagements: number;
  revenue: number;
}

export interface CampaignTypeBreakdown {
  type: CampaignType;
  count: number;
  sent: number;
  reach: number;
  engagementRate: number;
  revenue: number;
}

export interface PlatformBreakdown {
  platform: string;
  count: number;
  reach: number;
  engagementRate: number;
}

// ============================================
// Real-time Campaign Stats
// ============================================

export interface RealtimeCampaignStats {
  campaignId: string;

  // Delivery stats
  totalTargeted: number;
  totalSent: number;
  totalDelivered: number;
  totalRead: number;
  totalReplied: number;
  totalFailed: number;

  // Rates
  deliveryRate: number;
  readRate: number;
  replyRate: number;
  failureRate: number;

  // Recent activity
  recentSends: RecentSend[];
  recentReplies: RecentReply[];

  lastUpdated: Timestamp;
}

export interface RecentSend {
  customerId: string;
  customerName: string;
  status: string;
  sentAt: Timestamp;
}

export interface RecentReply {
  customerId: string;
  customerName: string;
  message: string;
  repliedAt: Timestamp;
}

// ============================================
// Filter Types
// ============================================

export interface AnalyticsFilters {
  startDate: Date;
  endDate: Date;
  campaignType?: CampaignType;
  campaignIds?: string[];
}

// ============================================
// Export Types
// ============================================

export interface AnalyticsExport {
  format: 'csv' | 'pdf' | 'xlsx';
  data: DateRangeAnalytics;
  generatedAt: Timestamp;
}
