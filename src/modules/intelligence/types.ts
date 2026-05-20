// ============================================================================
// MARKET INTELLIGENCE TYPES
// DawinOS v2.0 - Market Intelligence Module
// TypeScript interfaces and types
// ============================================================================

import {
  DataSourceType,
  SentimentLevel,
  TrendDirection,
  ThreatLevel,
  InsightType,
} from './constants';

// ============================================================================
// COMPETITOR TYPES
// ============================================================================

export interface Competitor {
  id: string;
  name: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  
  sector: string;
  subsector?: string;
  threatLevel: ThreatLevel;
  competitorType: 'direct' | 'indirect' | 'potential' | 'substitute';
  
  foundedYear?: number;
  headquarters?: string;
  employeeCount?: number;
  revenueEstimateUSD?: number;
  fundingTotalUSD?: number;
  
  marketShare?: number;
  strengthScore: number;
  weaknessScore: number;
  
  isTracked: boolean;
  alertsEnabled: boolean;
  lastUpdated: string;
  
  socialProfiles?: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
  };
  
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface CompetitorActivity {
  id: string;
  competitorId: string;
  activityType: 'product_launch' | 'funding' | 'partnership' | 'hiring' | 'expansion' | 'news' | 'social' | 'other';
  title: string;
  description: string;
  date: string;
  source: DataSourceType;
  sourceUrl?: string;
  sentiment: SentimentLevel;
  impact: 'high' | 'medium' | 'low';
  tags: string[];
}

// ============================================================================
// MARKET DATA TYPES
// ============================================================================

export interface MarketData {
  id: string;
  sector: string;
  subsector?: string;
  region: string;
  
  marketSizeUSD: number;
  marketSizeUGX: number;
  growthRate: number;
  projectedGrowthRate: number;
  
  trend: TrendDirection;
  sentiment: SentimentLevel;
  
  period: string;
  periodStart: string;
  periodEnd: string;
  
  sources: DataSourceType[];
  confidence: number;
  
  updatedAt: string;
}

export interface IndustryTrend {
  id: string;
  title: string;
  description: string;
  sector: string;
  
  direction: TrendDirection;
  strength: number;
  maturity: 'emerging' | 'growing' | 'mature' | 'declining';
  
  impactLevel: 'transformative' | 'significant' | 'moderate' | 'minor';
  affectedSegments: string[];
  
  timeframe: 'immediate' | 'short_term' | 'medium_term' | 'long_term';
  
  sources: {
    type: DataSourceType;
    url?: string;
    title: string;
  }[];
  
  identifiedAt: string;
  confidence: number;
}

// ============================================================================
// NEWS & CONTENT TYPES
// ============================================================================

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  content?: string;
  
  sourceName: string;
  sourceUrl: string;
  sourceType: DataSourceType;
  author?: string;
  
  category: string;
  tags: string[];
  sectors: string[];
  mentionedCompetitors: string[];
  
  sentiment: SentimentLevel;
  sentimentScore: number;
  relevanceScore: number;
  
  imageUrl?: string;
  
  publishedAt: string;
  fetchedAt: string;
  
  isRead: boolean;
  isBookmarked: boolean;
  isFlagged: boolean;
}

// ============================================================================
// INSIGHT TYPES
// ============================================================================

export interface Insight {
  id: string;
  title: string;
  description: string;
  type: InsightType;
  
  priority: 'critical' | 'high' | 'medium' | 'low';
  isActionable: boolean;
  
  sector?: string;
  competitorIds?: string[];
  relatedArticleIds?: string[];
  
  recommendations?: string[];
  
  confidence: number;
  dataPoints: number;
  
  generatedBy: 'ai' | 'manual' | 'hybrid';
  modelVersion?: string;
  
  status: 'new' | 'reviewed' | 'actioned' | 'dismissed';
  reviewedBy?: string;
  reviewedAt?: string;
  
  createdAt: string;
  expiresAt?: string;
}

// ============================================================================
// DASHBOARD TYPES
// ============================================================================

export interface IntelligenceDashboard {
  trackedCompetitors: number;
  activeInsights: number;
  unreadNews: number;
  alertsToday: number;
  
  recentInsights: Insight[];
  recentNews: NewsArticle[];
  competitorAlerts: CompetitorActivity[];
  
  marketTrends: IndustryTrend[];
  topicTrends: { topic: string; mentions: number; trend: TrendDirection }[];
  
  overallSentiment: SentimentLevel;
  sentimentTrend: TrendDirection;
  
  lastRefresh: string;
}

export interface Alert {
  id: string;
  type: 'competitor' | 'market' | 'news' | 'insight';
  title: string;
  message: string;
  severity: 'critical' | 'warning' | 'info';
  
  entityType?: string;
  entityId?: string;
  
  isRead: boolean;
  isDismissed: boolean;
  
  createdAt: string;
  readAt?: string;
}
