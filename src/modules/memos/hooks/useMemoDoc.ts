import { useState } from 'react';
import type { FirestoreError } from 'firebase/firestore';
import { useResilientSubscription } from '@/shared/hooks/useResilientSubscription';
import type { Memo } from '../types/memo';
import { subscribeToMemo } from '../services/memoService';

export function useMemoDoc(memoId: string | undefined): { memo: Memo | null; loading: boolean; error: FirestoreError | null } {
  const [memo, setMemo] = useState<Memo | null>(null);
  const [loading, setLoading] = useState(Boolean(memoId));
  const [error, setError] = useState<FirestoreError | null>(null);

  useResilientSubscription((health) => {
    if (!memoId) { setMemo(null); setLoading(false); return; }
    setLoading(true);
    setError(null);
    return subscribeToMemo(
      memoId,
      (m) => { setMemo(m); setLoading(false); health.ok(); },
      (err) => { setError(err); setLoading(false); health.fail(); },
    );
  }, [memoId]);

  return { memo, loading, error };
}
