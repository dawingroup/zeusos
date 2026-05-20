/**
 * useCustomer Hook
 * Subscribe to a single customer document
 */

import { useState, useEffect } from 'react';
import { subscribeToCustomer } from '../services/customerService';
import type { Customer } from '../types';

interface UseCustomerReturn {
  customer: Customer | null;
  loading: boolean;
  error: Error | null;
}

export function useCustomer(customerId: string | undefined): UseCustomerReturn {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!customerId) {
      setCustomer(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const unsubscribe = subscribeToCustomer(customerId, (data) => {
        setCustomer(data);
        setLoading(false);
      });

      return () => unsubscribe();
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load customer'));
      setLoading(false);
      return () => {};
    }
  }, [customerId]);

  return { customer, loading, error };
}
