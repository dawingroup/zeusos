/**
 * Marketing Module - Constants
 * Shared constants and enums
 */

import type {
  CampaignType,
  CampaignStatus,
  SendStatus,
  SocialPlatform,
  PostType,
  PostStatus,
  TemplateType,
  GoalType,
} from '../types';

// ============================================
// Firestore Collections
// ============================================

export const COLLECTIONS = {
  CAMPAIGNS: 'marketingCampaigns',
  SOCIAL_POSTS: 'socialMediaPosts',
  SOCIAL_ACCOUNTS: 'socialMediaAccounts',
  SOCIAL_ACCOUNT_INSIGHTS: 'socialAccountInsights',
  SOCIAL_BENCHMARK_CACHE: 'socialBenchmarkCache',
  TEMPLATES: 'contentTemplates',
  ANALYTICS: 'campaignAnalytics',
  CONFIG: 'systemConfig',
} as const;

export const CAMPAIGNS_COLLECTION = 'marketingCampaigns';
export const SOCIAL_POSTS_COLLECTION = 'socialMediaPosts';
export const SOCIAL_ACCOUNTS_COLLECTION = 'socialMediaAccounts';
export const SOCIAL_ACCOUNT_INSIGHTS_COLLECTION = 'socialAccountInsights';
export const SOCIAL_BENCHMARK_CACHE_COLLECTION = 'socialBenchmarkCache';
export const TEMPLATES_COLLECTION = 'contentTemplates';
export const ANALYTICS_COLLECTION = 'campaignAnalytics';
export const PROJECT_CASE_STUDIES_COLLECTION = 'projectCaseStudies';

// Storefront source collections (publish to dawinfinishes.com metaobjects)
export const VOICES_COLLECTION = 'voices';
export const PRESS_MENTIONS_COLLECTION = 'pressMentions';
export const FEATURED_UPDATES_COLLECTION = 'featuredUpdates';
export const MARKETING_ASSETS_COLLECTION = 'marketingAssets';

// ============================================
// Project Case Study Constants
// ============================================

export const CASE_STUDY_STATUS_META: Record<
  'draft' | 'in_review' | 'approved' | 'published' | 'archived',
  { label: string; badgeClass: string }
> = {
  draft: { label: 'Draft', badgeClass: 'bg-gray-100 text-gray-700' },
  in_review: { label: 'In review', badgeClass: 'bg-amber-100 text-amber-800' },
  approved: { label: 'Approved', badgeClass: 'bg-blue-100 text-blue-800' },
  published: { label: 'Published', badgeClass: 'bg-green-100 text-green-800' },
  archived: { label: 'Archived', badgeClass: 'bg-gray-200 text-gray-600' },
};

export const CASE_STUDY_CATEGORY_META: Record<
  'residential' | 'hospitality' | 'commercial' | 'retail' | 'institutional' | 'other',
  { label: string }
> = {
  residential: { label: 'Residential' },
  hospitality: { label: 'Hospitality' },
  commercial: { label: 'Commercial' },
  retail: { label: 'Retail' },
  institutional: { label: 'Institutional' },
  other: { label: 'Other' },
};

// ============================================
// Campaign Constants
// ============================================

export const CAMPAIGN_TYPES: Record<CampaignType, { label: string; description: string }> = {
  whatsapp: {
    label: 'WhatsApp Campaign',
    description: 'Send bulk WhatsApp messages to targeted customers',
  },
  social_media: {
    label: 'Social Media Campaign',
    description: 'Schedule and manage social media posts across platforms',
  },
  product_promotion: {
    label: 'Product Promotion',
    description: 'Promote products with special offers and discounts',
  },
  hybrid: {
    label: 'Hybrid Campaign',
    description: 'Multi-channel campaign across WhatsApp, social media, and more',
  },
};

export const CAMPAIGN_STATUSES: Record<CampaignStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'gray' },
  scheduled: { label: 'Scheduled', color: 'blue' },
  active: { label: 'Active', color: 'green' },
  paused: { label: 'Paused', color: 'yellow' },
  completed: { label: 'Completed', color: 'purple' },
  cancelled: { label: 'Cancelled', color: 'red' },
};

// Aliases for backward compatibility
export const CAMPAIGN_STATUS_LABELS = CAMPAIGN_STATUSES;
export const CAMPAIGN_TYPE_LABELS = CAMPAIGN_TYPES;

export const SEND_STATUSES: Record<SendStatus, { label: string; color: string }> = {
  pending: { label: 'Pending', color: 'gray' },
  sent: { label: 'Sent', color: 'blue' },
  delivered: { label: 'Delivered', color: 'cyan' },
  read: { label: 'Read', color: 'green' },
  failed: { label: 'Failed', color: 'red' },
  replied: { label: 'Replied', color: 'purple' },
};

// ============================================
// Goal Types
// ============================================

export const GOAL_TYPES: Record<GoalType, { label: string; defaultUnit: string }> = {
  reach: { label: 'Reach', defaultUnit: 'customers' },
  engagement: { label: 'Engagement', defaultUnit: 'interactions' },
  conversion: { label: 'Conversion', defaultUnit: 'conversions' },
  revenue: { label: 'Revenue', defaultUnit: 'UGX' },
  custom: { label: 'Custom', defaultUnit: 'units' },
};

// ============================================
// Social Media Constants
// ============================================

export const SOCIAL_PLATFORMS: Record<
  SocialPlatform,
  { label: string; icon: string; color: string }
> = {
  facebook: { label: 'Facebook', icon: 'Facebook', color: '#1877F2' },
  instagram: { label: 'Instagram', icon: 'Instagram', color: '#E4405F' },
  linkedin: { label: 'LinkedIn', icon: 'Linkedin', color: '#0A66C2' },
  twitter: { label: 'Twitter/X', icon: 'Twitter', color: '#1DA1F2' },
};

export const POST_TYPES: Record<PostType, { label: string; description: string }> = {
  single: { label: 'Single Post', description: 'Single image or text post' },
  carousel: { label: 'Carousel', description: 'Multiple images in a swipeable format' },
  story: { label: 'Story', description: '24-hour temporary post' },
  reel: { label: 'Reel', description: 'Short-form video content' },
};

export const POST_STATUSES: Record<PostStatus, { label: string; color: string }> = {
  draft: { label: 'Draft', color: 'gray' },
  scheduled: { label: 'Scheduled', color: 'blue' },
  published: { label: 'Published', color: 'green' },
  failed: { label: 'Failed', color: 'red' },
};

// ============================================
// Template Constants
// ============================================

export const TEMPLATE_TYPES: Record<TemplateType, { label: string; description: string }> = {
  whatsapp: {
    label: 'WhatsApp Template',
    description: 'Pre-approved WhatsApp message template',
  },
  social_post: {
    label: 'Social Media Post',
    description: 'Reusable social media content template',
  },
  email: {
    label: 'Email Template',
    description: 'Email campaign template (future)',
  },
};

// ============================================
// Default Configuration
// ============================================

export const DEFAULT_THROTTLE_CONFIG = {
  messagesPerMinute: 20,
  messagesPerHour: 500,
};

export const DEFAULT_BUDGET_CURRENCY = 'UGX';

export const MAX_AUDIENCE_SIZE = 10000;

export const DEFAULT_ALLOWED_ROLES = ['admin', 'marketing-manager', 'manager'];

// ============================================
// Validation Constants
// ============================================

export const CAMPAIGN_NAME_MIN_LENGTH = 3;
export const CAMPAIGN_NAME_MAX_LENGTH = 100;
export const CAMPAIGN_DESCRIPTION_MAX_LENGTH = 500;

export const POST_CONTENT_MAX_LENGTH = 2000;
export const POST_TITLE_MAX_LENGTH = 100;

export const TEMPLATE_NAME_MIN_LENGTH = 3;
export const TEMPLATE_NAME_MAX_LENGTH = 100;

// ============================================
// Date/Time Constants
// ============================================

export const ANALYTICS_RETENTION_DAYS = 365;
export const RECENT_ACTIVITY_LIMIT = 10;

// ============================================
// Helper Functions
// ============================================

export function getCampaignTypeLabel(type: CampaignType): string {
  return CAMPAIGN_TYPES[type]?.label || type;
}

export function getCampaignStatusLabel(status: CampaignStatus): string {
  return CAMPAIGN_STATUSES[status]?.label || status;
}

export function getCampaignStatusColor(status: CampaignStatus): string {
  return CAMPAIGN_STATUSES[status]?.color || 'gray';
}

export function getSendStatusLabel(status: SendStatus): string {
  return SEND_STATUSES[status]?.label || status;
}

export function getSendStatusColor(status: SendStatus): string {
  return SEND_STATUSES[status]?.color || 'gray';
}

export function getSocialPlatformLabel(platform: SocialPlatform): string {
  return SOCIAL_PLATFORMS[platform]?.label || platform;
}

export function getSocialPlatformColor(platform: SocialPlatform): string {
  return SOCIAL_PLATFORMS[platform]?.color || '#000000';
}
