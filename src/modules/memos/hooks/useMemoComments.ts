import { useState } from 'react';
import { useResilientSubscription } from '@/shared/hooks/useResilientSubscription';
import type { MemoComment } from '../types/memo';
import { subscribeToMemoComments } from '../services/memoCommentService';

export function useMemoComments(memoId: string | undefined): { comments: MemoComment[]; error: string | null } {
  const [comments, setComments] = useState<MemoComment[]>([]);
  const [error, setError] = useState<string | null>(null);
  useResilientSubscription((health) => {
    if (!memoId) return;
    return subscribeToMemoComments(
      memoId,
      (rows) => { setComments(rows); setError(null); health.ok(); },
      (err) => { setError(err.message); health.fail(); },
    );
  }, [memoId]);
  return { comments, error };
}
