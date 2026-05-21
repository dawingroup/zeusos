// ============================================================================
// TOPIC TRACKING TYPES
// ZeusOS v2.0 - Market Intelligence Module
// Types for tracking discussions on topics at global and local levels
// ============================================================================

import { Timestamp } from 'firebase/firestore';

// ----------------------------------------------------------------------------
// TOPIC SCOPE
// ----------------------------------------------------------------------------

export type TopicScope = 'global' | 'local' | 'regional';

export const TOPIC_SCOPE_LABELS: Record<TopicScope, string> = {
  global: 'Global',
  local: 'Local (Uganda)',
  regional: 'Regional (East Africa)',
};

// ----------------------------------------------------------------------------
// TOPIC STATUS
// ----------------------------------------------------------------------------

export type TopicStatus = 'active' | 'paused' | 'archived';

// ----------------------------------------------------------------------------
// TRACKED TOPIC
// ----------------------------------------------------------------------------

export interface TrackedTopic {
  id: string;
  name: string;
  description: string;

  // Tracking config
  keywords: string[];
  excludeKeywords: string[];
  scope: TopicScope;
  regions: string[];
  languages: string[];

  // Status
  status: TopicStatus;
  isAlertEnabled: boolean;
  alertThreshold: 'any' | 'high_volume' | 'sentiment_shift';

  // Metrics (updated on each scan)
  totalMentions: number;
  mentionsLast24h: number;
  mentionsLast7d: number;
  mentionsLast30d: number;
  overallSentiment: 'positive' | 'neutral' | 'negative' | 'mixed';
  sentimentScore: number;
  trendDirection: 'rising' | 'stable' | 'declining';

  // Related entities
  relatedCompetitorIds: string[];
  relatedTopicIds: string[];

  // Scan history
  lastScanAt?: Timestamp;
  nextScanAt?: Timestamp;
  scanFrequency: 'hourly' | 'daily' | 'weekly';

  // Metadata
  category: string;
  tags: string[];
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ----------------------------------------------------------------------------
// TOPIC MENTION (individual discussion/article found)
// ----------------------------------------------------------------------------

export interface TopicMention {
  id: string;
  topicId: string;
  topicName: string;

  // Source
  sourceType: 'news' | 'social' | 'forum' | 'blog' | 'academic' | 'government' | 'other';
  sourceName: string;
  sourceUrl: string;
  sourceRegion?: string;

  // Content
  title: string;
  snippet: string;
  fullContent?: string;
  author?: string;
  imageUrl?: string;

  // Analysis
  sentiment: 'positive' | 'neutral' | 'negative';
  sentimentScore: number;
  relevanceScore: number;
  matchedKeywords: string[];

  // Context
  scope: TopicScope;
  language: string;
  publishedAt: Timestamp;

  // User interaction
  isRead: boolean;
  isBookmarked: boolean;
  isFlagged: boolean;
  notes?: string;

  // Metadata
  discoveredAt: Timestamp;
}

// ----------------------------------------------------------------------------
// TOPIC ANALYTICS
// ----------------------------------------------------------------------------

export interface TopicAnalytics {
  topicId: string;
  period: 'day' | 'week' | 'month';

  mentionsByDay: { date: string; count: number; sentiment: number }[];
  mentionsBySource: { source: string; count: number }[];
  mentionsByRegion: { region: string; count: number }[];
  topKeywords: { keyword: string; count: number }[];
  sentimentTrend: { date: string; score: number }[];

  totalMentions: number;
  avgSentiment: number;
  peakDay: string;
  peakCount: number;
}

// ----------------------------------------------------------------------------
// FORM INPUT
// ----------------------------------------------------------------------------

export interface TrackedTopicFormInput {
  name: string;
  description: string;
  keywords: string[];
  excludeKeywords: string[];
  scope: TopicScope;
  regions: string[];
  languages: string[];
  category: string;
  scanFrequency: 'hourly' | 'daily' | 'weekly';
  isAlertEnabled: boolean;
  alertThreshold: 'any' | 'high_volume' | 'sentiment_shift';
  relatedCompetitorIds: string[];
}

// ----------------------------------------------------------------------------
// TOPIC CATEGORIES
// ----------------------------------------------------------------------------

export const TOPIC_CATEGORIES = [
  { id: 'industry', label: 'Industry Trends' },
  { id: 'technology', label: 'Technology' },
  { id: 'regulation', label: 'Regulation & Policy' },
  { id: 'market', label: 'Market Dynamics' },
  { id: 'competitor', label: 'Competitor Activity' },
  { id: 'customer', label: 'Customer Sentiment' },
  { id: 'economic', label: 'Economic Indicators' },
  { id: 'innovation', label: 'Innovation & R&D' },
  { id: 'sustainability', label: 'Sustainability & ESG' },
  { id: 'talent', label: 'Talent & Workforce' },
  { id: 'custom', label: 'Custom' },
] as const;
