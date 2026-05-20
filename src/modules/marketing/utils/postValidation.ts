/**
 * Light-touch validation for social posts.
 * Returns warnings the marketer can override — never blocks submit.
 */

import type { SocialPlatform, MediaType } from '../types';

export interface ValidationResult {
  warnings: string[];
}

const PLATFORM_CHAR_LIMITS: Record<SocialPlatform, number> = {
  facebook: 63_206,
  instagram: 2_200,
  linkedin: 3_000,
  twitter: 280,
};

const HASHTAG_LIMITS: Record<SocialPlatform, number> = {
  facebook: 5,
  instagram: 30,
  linkedin: 5,
  twitter: 2,
};

const TRUSTED_DOMAINS = ['dawin.group', 'dawinfinishes.com', 'dawinos.web.app'];

export interface PostValidationInput {
  content: string;
  mediaUrls: string[];
  mediaType: MediaType;
}

function countHashtags(content: string): number {
  const matches = content.match(/#[A-Za-z0-9_]+/g);
  return matches ? matches.length : 0;
}

function extractUrls(content: string): string[] {
  const matches = content.match(/https?:\/\/[^\s]+/g);
  return matches || [];
}

export function validatePost(
  post: PostValidationInput,
  platform: SocialPlatform
): ValidationResult {
  const warnings: string[] = [];
  const charLimit = PLATFORM_CHAR_LIMITS[platform];
  const hashtagLimit = HASHTAG_LIMITS[platform];

  if (post.content.length > charLimit) {
    warnings.push(
      `Over ${platform} limit (${post.content.length}/${charLimit} chars). Will be truncated.`
    );
  }

  const tagCount = countHashtags(post.content);
  if (platform === 'instagram' && tagCount === 0) {
    warnings.push('Instagram posts perform better with 8–15 niche hashtags.');
  }
  if (tagCount > hashtagLimit) {
    warnings.push(
      `Too many hashtags for ${platform} (${tagCount} used; ${hashtagLimit} recommended).`
    );
  }

  // Media requirements
  if (platform === 'instagram' && post.mediaUrls.length === 0) {
    warnings.push('Instagram requires at least one image or video.');
  }
  if (post.mediaType === 'carousel' && post.mediaUrls.length < 2) {
    warnings.push('Carousel posts need at least 2 media URLs.');
  }

  // URL quality
  const urls = extractUrls(post.content);
  for (const u of urls) {
    if (u.startsWith('http://')) {
      warnings.push(`Use https:// for links (found ${u.slice(0, 40)}…).`);
    }
    try {
      const parsed = new URL(u);
      const isTrusted = TRUSTED_DOMAINS.some(
        (d) => parsed.hostname === d || parsed.hostname.endsWith('.' + d)
      );
      if (!isTrusted && urls.length > 0) {
        warnings.push(
          `Link goes off-brand (${parsed.hostname}). Confirm this is intentional.`
        );
        break; // one warning is enough
      }
    } catch {
      // ignore malformed urls
    }
  }

  return { warnings };
}

export function validatePostAcrossPlatforms(
  post: PostValidationInput,
  platforms: SocialPlatform[]
): Record<SocialPlatform, ValidationResult> {
  const result = {} as Record<SocialPlatform, ValidationResult>;
  for (const platform of platforms) {
    result[platform] = validatePost(post, platform);
  }
  return result;
}
