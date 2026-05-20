/**
 * useSocialAccountInsights
 * Subscribe to latest-snapshot per-account metrics docs for a subsidiary.
 */

import { useEffect, useState } from 'react';
import { subscribeToAccountSnapshots } from '../services/socialAccountService';
import type { SocialAccountSnapshot } from '../types';

export function useSocialAccountInsights(subsidiaryId: string | undefined) {
  const [snapshots, setSnapshots] = useState<SocialAccountSnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!subsidiaryId) {
      setSnapshots([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToAccountSnapshots(subsidiaryId, (next) => {
      setSnapshots(next);
      setLoading(false);
    });
    return unsub;
  }, [subsidiaryId]);

  return { snapshots, loading };
}
