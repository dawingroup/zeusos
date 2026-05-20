/**
 * useSocialBenchmark
 * Calls the `getSocialBenchmark` Cloud Function for an Own-vs-Market chart.
 * Results are cached for an hour server-side; this hook caches per-arg in-memory.
 */

import { useEffect, useState } from 'react';
import type { SocialAccountPlatform } from '../types';

export type BenchmarkMetric = 'followers' | 'engagementRate' | 'avgLikesPerPost';

export interface BenchmarkPoint {
  date: string; // YYYY-MM-DD
  ownValue: number;
  marketAvg: number;
  marketMin?: number;
  marketMax?: number;
}

export interface BenchmarkResult {
  metric: BenchmarkMetric;
  platform: SocialAccountPlatform;
  subsidiaryId: string;
  series: BenchmarkPoint[];
  generatedAt: number;
  cached: boolean;
}

interface Args {
  subsidiaryId: string | undefined;
  platform: SocialAccountPlatform | undefined;
  metric: BenchmarkMetric;
  rangeDays: number; // e.g. 30, 90
  enabled?: boolean;
}

const memCache = new Map<string, { at: number; data: BenchmarkResult }>();
const TTL_MS = 5 * 60 * 1000;

function cacheKey(args: Args): string {
  return `${args.subsidiaryId}|${args.platform}|${args.metric}|${args.rangeDays}`;
}

export function useSocialBenchmark(args: Args) {
  const { subsidiaryId, platform, metric, rangeDays, enabled = true } = args;
  const [data, setData] = useState<BenchmarkResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!enabled || !subsidiaryId || !platform) {
      return;
    }
    const key = cacheKey(args);
    const cached = memCache.get(key);
    if (cached && Date.now() - cached.at < TTL_MS) {
      setData(cached.data);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const { httpsCallable, getFunctions } = await import('firebase/functions');
        const fn = httpsCallable<
          {
            subsidiaryId: string;
            platform: SocialAccountPlatform;
            metric: BenchmarkMetric;
            rangeDays: number;
          },
          BenchmarkResult
        >(getFunctions(undefined, 'us-central1'), 'getSocialBenchmark');
        const result = await fn({ subsidiaryId, platform, metric, rangeDays });
        if (cancelled) return;
        memCache.set(key, { at: Date.now(), data: result.data });
        setData(result.data);
      } catch (err) {
        if (!cancelled) setError(err as Error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subsidiaryId, platform, metric, rangeDays, enabled]);

  return { data, loading, error };
}
