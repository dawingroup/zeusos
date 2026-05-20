/**
 * Marketing Campaign Types
 * Type definitions for marketing campaigns
 */

import { Timestamp } from 'firebase/firestore';

// ============================================
// Campaign Types
// ============================================

export type CampaignType = 'whatsapp' | 'social_media' | 'product_promotion' | 'hybrid';
export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed' | 'cancelled';
export type SendRate = 'immediate' | 'scheduled' | 'throttled';

export interface MarketingCampaign {
  id: string;
  companyId: string;

  // Campaign Identity
  name: string;
  description: string;
  campaignType: CampaignType;

  // Targeting
  targetAudience: AudienceSegment;
  estimatedReach: number;

  // Scheduling
  status: CampaignStatus;
  scheduledStartDate: Timestamp;
  scheduledEndDate: Timestamp;
  actualStartDate?: Timestamp;
  actualEndDate?: Timestamp;

  // Type-specific configuration
  whatsappConfig?: WhatsAppCampaignConfig;
  socialMediaConfig?: SocialMediaCampaignConfig;
  productPromotionConfig?: ProductPromotionConfig;

  // Budget & Goals
  budget?: number;
  budgetCurrency: string;
  goals: CampaignGoal[];

  // Analytics (aggregated)
  metrics: CampaignMetrics;

  // Metadata
  createdBy: string;
  createdByName: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  tags: string[];
}

// ============================================
// Audience Segmentation
// ============================================

export type SegmentType = 'all' | 'custom' | 'customer_ids' | 'filters';
export type CustomerType = 'residential' | 'commercial' | 'contractor' | 'designer';
export type CustomerStatus = 'active' | 'inactive' | 'prospect';

export interface AudienceSegment {
  segmentType: SegmentType;
  customerIds?: string[];
  filters?: AudienceFilters;
  estimatedSize: number;
}

export interface AudienceFilters {
  customerType?: CustomerType[];
  customerStatus?: CustomerStatus[];
  tags?: string[];
  hasWhatsApp?: boolean;
  minProjectCount?: number;
}

// ============================================
// WhatsApp Campaign Configuration
// ============================================

export interface WhatsAppCampaignConfig {
  templateId: string;
  templateName: string;
  templateParams?: Record<string, string>;
  usePersonalization: boolean;
  sendRate: SendRate;
  throttleConfig?: ThrottleConfig;
}

export interface ThrottleConfig {
  messagesPerMinute: number;
  messagesPerHour: number;
}

// ============================================
// Social Media Campaign Configuration
// ============================================

export type SocialPlatform = 'facebook' | 'instagram' | 'linkedin' | 'twitter';
export type PostType = 'single' | 'carousel' | 'story' | 'reel';

export interface SocialMediaCampaignConfig {
  platforms: SocialPlatform[];
  postType: PostType;
  contentTemplateId?: string;
  scheduledPosts: ScheduledPost[];
}

export interface ScheduledPost {
  id: string;
  platform: SocialPlatform;
  scheduledFor: Timestamp;
  content: string;
  mediaUrls?: string[];
  status: 'pending' | 'published' | 'failed';
}

// ============================================
// Product Promotion Configuration
// ============================================

export interface ProductPromotionConfig {
  productIds: string[];
  shopifyProductIds?: string[];
  discountCode?: string;
  discountPercentage?: number;
  landingPageUrl?: string;
  utmParameters?: UTMParameters;
}

export interface UTMParameters {
  source: string;
  medium: string;
  campaign: string;
  term?: string;
  content?: string;
}

// ============================================
// Campaign Goals
// ============================================

export type GoalType = 'reach' | 'engagement' | 'conversion' | 'revenue' | 'custom';

export interface CampaignGoal {
  id: string;
  type: GoalType;
  name: string;
  targetValue: number;
  currentValue: number;
  unit: string;
}

// ============================================
// Campaign Metrics
// ============================================

export interface CampaignMetrics {
  // Universal metrics
  totalSent: number;
  totalReached: number;
  totalEngagements: number;
  totalConversions: number;
  totalRevenue: number;

  // WhatsApp-specific
  whatsappDelivered?: number;
  whatsappRead?: number;
  whatsappReplied?: number;
  whatsappFailed?: number;

  // Social media-specific
  socialImpressions?: number;
  socialLikes?: number;
  socialShares?: number;
  socialComments?: number;
  socialClicks?: number;

  // Calculated
  engagementRate: number;
  conversionRate: number;
  roi?: number;
  costPerConversion?: number;

  lastUpdated: Timestamp;
}

// ============================================
// Campaign Send Records
// ============================================

export type SendStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'replied';

export interface CampaignSend {
  id: string;
  campaignId: string;

  // Target
  customerId: string;
  customerName: string;
  phoneNumber: string;

  // WhatsApp Integration
  conversationId?: string;
  messageId?: string;
  zokoMessageId?: string;

  // Status Tracking
  status: SendStatus;
  sentAt?: Timestamp;
  deliveredAt?: Timestamp;
  readAt?: Timestamp;
  repliedAt?: Timestamp;
  failureReason?: string;

  // Content Used
  templateParams?: Record<string, string>;

  // Engagement
  replied: boolean;
  replyCount: number;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ============================================
// Form & Filter Types
// ============================================

export interface CampaignFormData {
  name: string;
  description: string;
  campaignType: CampaignType;
  targetAudience: AudienceSegment;
  scheduledStartDate: Date;
  scheduledEndDate: Date;
  whatsappConfig?: WhatsAppCampaignConfig;
  socialMediaConfig?: SocialMediaCampaignConfig;
  productPromotionConfig?: ProductPromotionConfig;
  budget?: number;
  budgetCurrency: string;
  goals: Omit<CampaignGoal, 'id' | 'currentValue'>[];
  tags: string[];
}

export interface CampaignFilters {
  status?: CampaignStatus;
  campaignType?: CampaignType;
  search?: string;
  tags?: string[];
  dateFrom?: Date;
  dateTo?: Date;
}

export interface SendFilters {
  status?: SendStatus;
  replied?: boolean;
  dateFrom?: Date;
  dateTo?: Date;
}
