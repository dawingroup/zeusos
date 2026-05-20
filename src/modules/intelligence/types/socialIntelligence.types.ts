// ============================================================================
// SOCIAL INTELLIGENCE TYPES
// DawinOS v2.0 - Market Intelligence Module
// Types for social media competitor tracking and AI analysis
// ============================================================================

import { Timestamp } from 'firebase/firestore';

// ----------------------------------------------------------------------------
// AI ANALYSIS TYPES
// ----------------------------------------------------------------------------

export type SocialStrategy =
  | 'Educational'
  | 'Promotional'
  | 'FOMO'
  | 'Brand-Building'
  | 'Community'
  | 'Thought-Leadership'
  | 'Entertainment'
  | 'Product-Launch'
  | 'Recruitment'
  | 'CSR';

export type SocialTone =
  | 'Professional'
  | 'Casual'
  | 'Aggressive'
  | 'Inspirational'
  | 'Sarcastic'
  | 'Humorous'
  | 'Authoritative'
  | 'Empathetic';

export type SocialPlatform =
  | 'instagram'
  | 'twitter'
  | 'tiktok'
  | 'facebook'
  | 'linkedin'
  | 'youtube';

export const SOCIAL_PLATFORM_LABELS: Record<SocialPlatform, string> = {
  instagram: 'Instagram',
  twitter: 'X (Twitter)',
  tiktok: 'TikTok',
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
  youtube: 'YouTube',
};

export const SOCIAL_PLATFORM_COLORS: Record<SocialPlatform, string> = {
  instagram: '#E4405F',
  twitter: '#1DA1F2',
  tiktok: '#000000',
  facebook: '#1877F2',
  linkedin: '#0A66C2',
  youtube: '#FF0000',
};

export const STRATEGY_COLORS: Record<SocialStrategy, string> = {
  Educational: '#3B82F6',
  Promotional: '#F59E0B',
  FOMO: '#EF4444',
  'Brand-Building': '#8B5CF6',
  Community: '#10B981',
  'Thought-Leadership': '#6366F1',
  Entertainment: '#EC4899',
  'Product-Launch': '#F97316',
  Recruitment: '#14B8A6',
  CSR: '#22C55E',
};

export const TONE_COLORS: Record<SocialTone, string> = {
  Professional: '#3B82F6',
  Casual: '#10B981',
  Aggressive: '#EF4444',
  Inspirational: '#F59E0B',
  Sarcastic: '#8B5CF6',
  Humorous: '#EC4899',
  Authoritative: '#6366F1',
  Empathetic: '#14B8A6',
};

// ----------------------------------------------------------------------------
// SOCIAL POST
// ----------------------------------------------------------------------------

export interface SocialPostAIAnalysis {
  strategy: SocialStrategy;
  tone: SocialTone;
  targetAudience: string;
  sentiment: number;
  summary: string;
  strategicPillars: string[];
  analyzedAt: Date | Timestamp;
}

export interface SocialPost {
  id: string;
  competitorId: string;
  profileId: string;
  platform: SocialPlatform;
  postId: string;

  // Content
  contentText: string;
  contentType: string;
  mediaUrls: string[];
  hashtags: string[];
  mentions: string[];

  // Metrics
  likes: number;
  comments: number;
  shares: number;
  views: number;
  saves: number;
  engagementRate?: number;

  // AI Analysis
  aiAnalysis?: SocialPostAIAnalysis;

  // Metadata
  publishedAt: Timestamp;
  capturedAt: Timestamp;
  source: string;
}

// ----------------------------------------------------------------------------
// SOCIAL METRICS (account-level, time-series)
// ----------------------------------------------------------------------------

export interface SocialMetrics {
  id: string;
  competitorId: string;
  profileId: string;
  platform: SocialPlatform;
  profileHandle: string;

  // Account metrics
  followers: number;
  following: number;
  totalPosts: number;
  engagementRate: number;
  avgLikesPerPost: number;
  avgCommentsPerPost: number;
  avgSharesPerPost: number;
  avgViewsPerPost: number;

  // Growth deltas
  followersDelta: number;
  followingDelta: number;
  postsDelta: number;

  // Metadata
  capturedAt: Timestamp;
  source: string;
}

// ----------------------------------------------------------------------------
// AI ANALYSIS RESULTS (from Cloud Function)
// ----------------------------------------------------------------------------

export interface SocialAnalysisResult {
  success: boolean;
  analyzedCount: number;
  competitorInsight: string;
  dominantStrategy: string;
  dominantTone: string;
  avgSentiment: number;
  analyses: Array<{
    postIndex: number;
    strategy: SocialStrategy;
    tone: SocialTone;
    targetAudience: string;
    sentiment: number;
    summary: string;
    strategicPillars: string[];
  }>;
}

// ----------------------------------------------------------------------------
// SOCIAL SYNC RESULTS
// ----------------------------------------------------------------------------

export interface SocialSyncResult {
  success: boolean;
  synced: number;
  errors: number;
  totalProfiles: number;
}

export interface FetchPostsResult {
  success: boolean;
  newPosts: number;
  updatedPosts: number;
  totalPosts: number;
  metrics: {
    followers: number;
    engagementRate: number;
  } | null;
}

// ----------------------------------------------------------------------------
// COMPETITOR SOCIAL SUMMARY (aggregated for display)
// ----------------------------------------------------------------------------

export interface CompetitorSocialSummary {
  competitorId: string;
  competitorName: string;
  platforms: SocialPlatform[];
  totalFollowers: number;
  avgEngagementRate: number;
  totalPosts: number;
  recentPostCount: number;
  dominantStrategy?: string;
  dominantTone?: string;
  lastSyncedAt?: Timestamp;
}
