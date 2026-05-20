/**
 * Marketing AI Agent Types
 * Type definitions for the AI-powered marketing assistant
 * Supports: key date identification, strategy-aligned post drafting, campaign planning
 */

import { Timestamp } from 'firebase/firestore';
import type { SocialPlatform } from './campaign.types';

// ============================================
// Marketing Calendar & Key Dates
// ============================================

export type MarketingDateCategory =
  | 'holiday'
  | 'industry_event'
  | 'seasonal'
  | 'company_milestone'
  | 'product_launch'
  | 'cultural'
  | 'sales_event'
  | 'custom';

export interface MarketingKeyDate {
  id: string;
  companyId: string;

  // Date Info
  name: string;
  description: string;
  date: Timestamp;
  endDate?: Timestamp;
  isRecurring: boolean;
  recurrencePattern?: 'yearly' | 'monthly' | 'quarterly';

  // Classification
  category: MarketingDateCategory;
  relevanceScore: number; // 0-100, AI-calculated
  region?: string;

  // AI-Generated Suggestions
  suggestedActions: string[];
  suggestedContentThemes: string[];
  leadTimeDays: number; // how many days before to start preparing

  // Status
  acknowledged: boolean;
  contentPlanned: boolean;
  linkedCampaignIds: string[];
  linkedPostIds: string[];

  // Source
  source: 'ai_generated' | 'manual' | 'system';
  aiConfidence?: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// Strategy Context
// ============================================

export interface StrategyContext {
  // Business Strategy
  businessGoals: string[];
  targetMarket: string;
  brandVoice: string;
  brandValues: string[];
  uniqueSellingPoints: string[];

  // Sales Strategy
  salesObjectives: string[];
  currentPromotions: string[];
  productFocus: string[];
  pricingStrategy?: string;

  // Marketing Strategy
  marketingObjectives: string[];
  targetAudience: string[];
  contentPillars: string[];
  competitorInsights: string[];
  channelStrategy: Record<SocialPlatform, string>;

  // Seasonal/Contextual
  currentSeason: string;
  upcomingEvents: string[];
  industryTrends: string[];
}

// ============================================
// AI Content Generation
// ============================================

export type ContentTone = 'professional' | 'casual' | 'inspirational' | 'educational' | 'promotional' | 'storytelling';
export type ContentLength = 'short' | 'medium' | 'long';

export interface ContentGenerationRequest {
  // What to generate
  type: 'social_post' | 'campaign_brief' | 'whatsapp_message' | 'content_calendar' | 'hashtags';

  // Context
  topic: string;
  platforms: SocialPlatform[];
  tone: ContentTone;
  length: ContentLength;

  // Strategy alignment
  strategyContext?: Partial<StrategyContext>;
  keyDate?: MarketingKeyDate;
  campaignId?: string;

  // Constraints
  includeHashtags: boolean;
  includeCallToAction: boolean;
  maxLength?: number;
  language?: string;
}

export interface GeneratedContent {
  id: string;
  requestId: string;

  // Generated output
  content: string;
  headline?: string;
  callToAction?: string;
  hashtags: string[];
  suggestedMediaDescription?: string;

  // Platform variants
  platformVariants: PlatformContentVariant[];

  // Metadata
  tone: ContentTone;
  strategyAlignment: StrategyAlignmentScore;
  generatedAt: Timestamp;
  model: string;
  confidence: number;
}

export interface PlatformContentVariant {
  platform: SocialPlatform;
  content: string;
  hashtags: string[];
  characterCount: number;
  withinLimit: boolean;
}

export interface StrategyAlignmentScore {
  overall: number; // 0-100
  brandVoice: number;
  targetAudience: number;
  businessGoals: number;
  contentPillars: number;
  notes: string[];
}

// ============================================
// AI Agent Conversation
// ============================================

export type AgentMessageRole = 'user' | 'assistant' | 'system';
export type AgentAction =
  | 'generate_post'
  | 'suggest_dates'
  | 'analyze_performance'
  | 'plan_campaign'
  | 'optimize_content'
  | 'generate_hashtags'
  | 'suggest_content_calendar';

export interface AgentMessage {
  id: string;
  role: AgentMessageRole;
  content: string;
  timestamp: Date;

  // If the agent performed an action
  action?: AgentAction;
  actionResult?: GeneratedContent | MarketingKeyDate[] | string;

  // Loading state
  isStreaming?: boolean;
}

export interface AgentConversation {
  id: string;
  companyId: string;
  messages: AgentMessage[];
  strategyContext?: Partial<StrategyContext>;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// Agent Configuration
// ============================================

export interface MarketingAgentConfig {
  companyId: string;

  // Strategy context (persisted)
  strategyContext: StrategyContext;

  // Preferences
  defaultTone: ContentTone;
  defaultPlatforms: SocialPlatform[];
  defaultLanguage: string;
  autoSuggestDates: boolean;
  leadTimeDays: number;

  // Region for key dates
  region: string;
  country: string;

  updatedAt: Timestamp;
}

// ============================================
// AI Campaign Proposals
// ============================================

export interface CampaignProposal {
  id: string;
  name: string;
  description: string;
  campaignType: 'whatsapp' | 'social_media' | 'product_promotion' | 'hybrid';
  objective: string;
  targetAudience: string;
  channels: SocialPlatform[];
  tone: ContentTone;

  // Timeline
  suggestedStartDate: string; // ISO date string
  suggestedEndDate: string;
  durationDays: number;

  // Key date linkage
  linkedKeyDateId?: string;
  linkedKeyDateName?: string;

  // Content plan
  contentIdeas: string[];
  suggestedPosts: number;
  keyMessages: string[];
  callToAction: string;
  hashtags: string[];

  // Budget & goals
  estimatedBudget?: string;
  goals: string[];

  // AI metadata
  strategyAlignmentScore: number; // 0-100
  reasoning: string;
  priority: 'high' | 'medium' | 'low';
}

// ============================================
// Constants
// ============================================

export const AGENT_COLLECTION = 'marketingAgentConversations';
export const KEY_DATES_COLLECTION = 'marketingKeyDates';
export const AGENT_CONFIG_COLLECTION = 'marketingAgentConfig';
export const STRATEGY_COLLECTION = 'marketingStrategy';

export const CONTENT_TONES: Record<ContentTone, { label: string; description: string }> = {
  professional: { label: 'Professional', description: 'Formal and business-oriented' },
  casual: { label: 'Casual', description: 'Friendly and conversational' },
  inspirational: { label: 'Inspirational', description: 'Motivating and uplifting' },
  educational: { label: 'Educational', description: 'Informative and instructive' },
  promotional: { label: 'Promotional', description: 'Sales-focused with urgency' },
  storytelling: { label: 'Storytelling', description: 'Narrative-driven engagement' },
};

export const PLATFORM_CHARACTER_LIMITS: Record<SocialPlatform, number> = {
  facebook: 63206,
  instagram: 2200,
  linkedin: 3000,
  twitter: 280,
};
