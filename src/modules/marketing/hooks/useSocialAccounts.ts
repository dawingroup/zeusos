/**
 * useSocialAccounts
 * Subscribe to the social account registry for a subsidiary.
 */

import { useEffect, useState, useCallback } from 'react';
import {
  subscribeToSocialAccounts,
  createSocialAccount,
  updateSocialAccount,
  setAccountTracking,
  deleteSocialAccount,
} from '../services/socialAccountService';
import type { SocialMediaAccount, SocialAccountFormData } from '../types';

export function useSocialAccounts(
  subsidiaryId: string | undefined,
  userId: string | undefined
) {
  const [accounts, setAccounts] = useState<SocialMediaAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!subsidiaryId) {
      setAccounts([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToSocialAccounts(
      subsidiaryId,
      (next) => {
        setAccounts(next);
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsub;
  }, [subsidiaryId]);

  const create = useCallback(
    async (data: Omit<SocialAccountFormData, 'subsidiaryId'>) => {
      if (!subsidiaryId || !userId) {
        throw new Error('Subsidiary and user required');
      }
      return createSocialAccount({ ...data, subsidiaryId }, userId);
    },
    [subsidiaryId, userId]
  );

  const update = useCallback(
    async (id: string, data: Partial<SocialAccountFormData>) => {
      await updateSocialAccount(id, data);
    },
    []
  );

  const toggleTracking = useCallback(async (id: string, enabled: boolean) => {
    await setAccountTracking(id, enabled);
  }, []);

  const remove = useCallback(async (id: string) => {
    await deleteSocialAccount(id);
  }, []);

  return { accounts, loading, error, create, update, toggleTracking, remove };
}
