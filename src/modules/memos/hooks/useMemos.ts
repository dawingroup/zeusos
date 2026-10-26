import { useMemo, useState } from 'react';
import type { FirestoreError } from 'firebase/firestore';
import { useResilientSubscription } from '@/shared/hooks/useResilientSubscription';
import type { Memo, MemoFilters } from '../types/memo';
import { subscribeToMemos, type SubscribeMemosOptions } from '../services/memoService';

export interface UseMemosResult {
  memos: Memo[];
  loading: boolean;
  /** Set from the snapshot error — an empty list with error ≠ "no memos". */
  error: FirestoreError | null;
}

export function useMemos(filters: MemoFilters, options: SubscribeMemosOptions = {}): UseMemosResult {
  const [memos, setMemos] = useState<Memo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<FirestoreError | null>(null);
  const key = useMemo(() => JSON.stringify({ filters, options }), [filters, options]);

  useResilientSubscription((health) => {
    setLoading(true);
    setError(null);
    const parsed = JSON.parse(key) as { filters: MemoFilters; options: SubscribeMemosOptions };
    return subscribeToMemos(
      parsed.filters,
      (rows) => { setMemos(rows); setLoading(false); health.ok(); },
      (err) => { setError(err); setLoading(false); health.fail(); },
      parsed.options,
    );
  }, [key]);

  return { memos, loading, error };
}
