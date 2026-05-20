/**
 * useGenerateSocialCopy
 * Thin wrapper around the `generateSocialCopy` callable Cloud Function.
 */

import { useState, useCallback } from 'react';
import type { SocialPlatform } from '../types';

export interface SocialCopyVariant {
  platform: SocialPlatform;
  caption: string;
  hashtags: string[];
  cta?: string;
}

export interface GenerateInput {
  brief: string;
  subsidiaryId: string;
  subsidiaryName?: string;
  platforms: SocialPlatform[];
  tone?: string;
  mediaUrls?: string[];
}

export function useGenerateSocialCopy() {
  const [variants, setVariants] = useState<SocialCopyVariant[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const generate = useCallback(async (input: GenerateInput) => {
    setLoading(true);
    setError(null);
    try {
      const { httpsCallable, getFunctions } = await import('firebase/functions');
      const fn = httpsCallable<GenerateInput, { variants: SocialCopyVariant[] }>(
        getFunctions(undefined, 'us-central1'),
        'generateSocialCopy'
      );
      const result = await fn(input);
      setVariants(result.data.variants || []);
      return result.data.variants || [];
    } catch (err) {
      setError(err as Error);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setVariants([]);
    setError(null);
  }, []);

  return { variants, loading, error, generate, reset };
}
