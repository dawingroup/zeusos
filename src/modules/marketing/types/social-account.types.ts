/**
 * Social Media Account Types
 * Registry of our own subsidiary-owned social pages tracked for analytics
 * (and, in Phase 2, used as publish targets).
 */

import { Timestamp } from 'firebase/firestore';

export type SocialAccountPlatform =
  | 'facebook'
  | 'instagram'
  | 'linkedin'
  | 'twitter'
  | 'tiktok'
  | 'youtube';

export type SocialAccountStatus =
  | 'tracking'
  | 'paused'
  | 'oauth_connected'
  | 'oauth_expired'
  | 'error';

export interface SocialMediaAccount {
  id: string;
  subsidiaryId: string;
  platform: SocialAccountPlatform;
  displayName: string;
  handle: string;
  profileUrl: string;
  platformAccountId?: string;
  avatarUrl?: string;
  status: SocialAccountStatus;
  trackingEnabled: boolean;
  oauthEnabled: boolean;
  lastSyncedAt?: Timestamp;
  lastSyncError?: string;
  createdAt: Timestamp;
  createdBy: string;
  updatedAt?: Timestamp;
}

export interface SocialAccountFormData {
  subsidiaryId: string;
  platform: SocialAccountPlatform;
  displayName: string;
  handle: string;
  profileUrl: string;
  trackingEnabled?: boolean;
}

export interface SocialAccountSnapshot {
  accountId: string;
  subsidiaryId: string;
  platform: SocialAccountPlatform;
  followers: number;
  following: number;
  totalPosts: number;
  engagementRate: number;
  avgLikesPerPost: number;
  avgCommentsPerPost: number;
  avgSharesPerPost: number;
  avgViewsPerPost: number;
  followersDelta: number;
  capturedAt: Timestamp;
}

export const SOCIAL_ACCOUNT_PLATFORMS: Record<
  SocialAccountPlatform,
  { label: string; color: string }
> = {
  facebook: { label: 'Facebook', color: '#1877F2' },
  instagram: { label: 'Instagram', color: '#E4405F' },
  linkedin: { label: 'LinkedIn', color: '#0A66C2' },
  twitter: { label: 'Twitter/X', color: '#1DA1F2' },
  tiktok: { label: 'TikTok', color: '#000000' },
  youtube: { label: 'YouTube', color: '#FF0000' },
};

export const SOCIAL_ACCOUNT_STATUSES: Record<
  SocialAccountStatus,
  { label: string; badgeClass: string }
> = {
  tracking: { label: 'Tracking', badgeClass: 'bg-green-100 text-green-700' },
  paused: { label: 'Paused', badgeClass: 'bg-gray-100 text-gray-600' },
  oauth_connected: { label: 'Publish-ready', badgeClass: 'bg-blue-100 text-blue-700' },
  oauth_expired: { label: 'Auth expired', badgeClass: 'bg-amber-100 text-amber-700' },
  error: { label: 'Error', badgeClass: 'bg-red-100 text-red-700' },
};
