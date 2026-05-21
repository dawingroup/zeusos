// ============================================================================
// DIGITAL PROFILE TYPES
// ZeusOS v2.0 - Market Intelligence Module
// Types for competitor digital profile discovery and tracking
// ============================================================================

import { Timestamp } from 'firebase/firestore';

// ----------------------------------------------------------------------------
// DIGITAL PROFILE PLATFORM TYPES
// ----------------------------------------------------------------------------

export type DigitalPlatform =
  | 'website'
  | 'linkedin'
  | 'twitter'
  | 'facebook'
  | 'instagram'
  | 'youtube'
  | 'tiktok'
  | 'github'
  | 'crunchbase'
  | 'glassdoor'
  | 'google_business'
  | 'app_store'
  | 'play_store'
  | 'blog'
  | 'medium'
  | 'reddit'
  | 'pinterest'
  | 'other';

export const PLATFORM_LABELS: Record<DigitalPlatform, string> = {
  website: 'Website',
  linkedin: 'LinkedIn',
  twitter: 'X (Twitter)',
  facebook: 'Facebook',
  instagram: 'Instagram',
  youtube: 'YouTube',
  tiktok: 'TikTok',
  github: 'GitHub',
  crunchbase: 'Crunchbase',
  glassdoor: 'Glassdoor',
  google_business: 'Google Business',
  app_store: 'App Store',
  play_store: 'Play Store',
  blog: 'Blog',
  medium: 'Medium',
  reddit: 'Reddit',
  pinterest: 'Pinterest',
  other: 'Other',
};

export const PLATFORM_ICONS: Record<DigitalPlatform, string> = {
  website: 'Globe',
  linkedin: 'Linkedin',
  twitter: 'Twitter',
  facebook: 'Facebook',
  instagram: 'Instagram',
  youtube: 'Youtube',
  tiktok: 'Music2',
  github: 'Github',
  crunchbase: 'TrendingUp',
  glassdoor: 'Building2',
  google_business: 'MapPin',
  app_store: 'Apple',
  play_store: 'Smartphone',
  blog: 'PenTool',
  medium: 'BookOpen',
  reddit: 'MessageCircle',
  pinterest: 'Image',
  other: 'Link2',
};

export const PLATFORM_COLORS: Record<DigitalPlatform, string> = {
  website: '#6366F1',
  linkedin: '#0A66C2',
  twitter: '#1DA1F2',
  facebook: '#1877F2',
  instagram: '#E4405F',
  youtube: '#FF0000',
  tiktok: '#000000',
  github: '#333333',
  crunchbase: '#0288D1',
  glassdoor: '#0CAA41',
  google_business: '#4285F4',
  app_store: '#0D96F6',
  play_store: '#34A853',
  blog: '#FF6B35',
  medium: '#000000',
  reddit: '#FF4500',
  pinterest: '#E60023',
  other: '#6B7280',
};

// ----------------------------------------------------------------------------
// CORE DIGITAL PROFILE TYPE
// ----------------------------------------------------------------------------

export interface DigitalProfile {
  id: string;
  competitorId: string;
  competitorName: string;

  // Platform details
  platform: DigitalPlatform;
  profileUrl: string;
  profileHandle?: string;
  profileName?: string;
  verified: boolean;

  // Metrics (platform-specific, updated on each scan)
  followers?: number;
  following?: number;
  posts?: number;
  engagement?: number;
  rating?: number;
  reviewCount?: number;

  // Status
  isActive: boolean;
  isTracking: boolean;
  lastScannedAt?: Timestamp;
  lastActivityAt?: Timestamp;

  // Discovery
  discoveredBy: 'auto_search' | 'manual' | 'ai_suggestion';
  discoveredAt: Timestamp;
  confidence: number;

  // Metadata
  notes?: string;
  tags: string[];
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// ----------------------------------------------------------------------------
// DIGITAL PROFILE SNAPSHOT (point-in-time metrics)
// ----------------------------------------------------------------------------

export interface ProfileSnapshot {
  id: string;
  profileId: string;
  competitorId: string;
  platform: DigitalPlatform;

  // Metrics at time of snapshot
  followers?: number;
  following?: number;
  posts?: number;
  engagement?: number;
  rating?: number;
  reviewCount?: number;

  // Content summary
  recentPostCount?: number;
  topContent?: string[];

  capturedAt: Timestamp;
}

// ----------------------------------------------------------------------------
// SEARCH DISCOVERY RESULT
// ----------------------------------------------------------------------------

export interface ProfileDiscoveryResult {
  platform: DigitalPlatform;
  url: string;
  title: string;
  snippet: string;
  confidence: number;
  alreadyTracked: boolean;
}

export interface DigitalProfileFormInput {
  competitorId: string;
  competitorName: string;
  platform: DigitalPlatform;
  profileUrl: string;
  profileHandle?: string;
  profileName?: string;
  notes?: string;
}
