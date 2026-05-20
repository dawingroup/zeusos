/**
 * useDiscountPolicy — Fetch and manage discount policies.
 */

import { useState, useEffect, useCallback } from 'react';
import type { DiscountPolicy, DiscountEvaluation } from '../types';
import {
  getPolicy,
  getAllPolicies,
  evaluateDiscount,
} from '../services/discountPolicyService';

export interface UseDiscountPolicyResult {
  policy: DiscountPolicy | null;
  policies: DiscountPolicy[];
  loading: boolean;
  error: string | null;
  evaluate: (
    orderId: string,
    discountPercent: number,
    discountAmount: number,
  ) => Promise<DiscountEvaluation>;
}

export function useDiscountPolicy(subsidiaryId: string | undefined): UseDiscountPolicyResult {
  const [policy, setPolicy] = useState<DiscountPolicy | null>(null);
  const [policies, setPolicies] = useState<DiscountPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!subsidiaryId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    Promise.all([
      getPolicy(subsidiaryId),
      getAllPolicies(subsidiaryId),
    ])
      .then(([active, all]) => {
        setPolicy(active);
        setPolicies(all);
        setLoading(false);
      })
      .catch((err) => {
        setError((err as Error).message);
        setLoading(false);
      });
  }, [subsidiaryId]);

  const evaluate = useCallback(
    (orderId: string, discountPercent: number, discountAmount: number) =>
      evaluateDiscount(orderId, discountPercent, discountAmount),
    [],
  );

  return { policy, policies, loading, error, evaluate };
}
