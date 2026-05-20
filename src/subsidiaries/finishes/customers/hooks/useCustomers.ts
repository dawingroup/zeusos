/**
 * useCustomers Hook
 * Subscribe to customer list with filtering options
 */

import { useState, useEffect, useMemo } from 'react';
import { subscribeToCustomers } from '../services/customerService';
import type { CustomerListItem, CustomerStatus, CustomerType } from '../types';

interface UseCustomersOptions {
  status?: CustomerStatus;
  type?: CustomerType;
  searchQuery?: string;
}

interface UseCustomersReturn {
  customers: CustomerListItem[];
  loading: boolean;
  error: Error | null;
  filteredCustomers: CustomerListItem[];
}

export function useCustomers(options: UseCustomersOptions = {}): UseCustomersReturn {
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const { status, type, searchQuery } = options;

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToCustomers(
      (data) => {
        setCustomers(data);
        setLoading(false);
      },
      (err) => {
        setError(err instanceof Error ? err : new Error('Failed to load customers'));
        setLoading(false);
      },
      { status }
    );

    return () => unsubscribe();
  }, [status]);

  // Client-side filtering for type and search
  const filteredCustomers = useMemo(() => {
    let result = customers;

    if (type) {
      result = result.filter((c) => c.type === type);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          c.name.toLowerCase().includes(query) ||
          c.code.toLowerCase().includes(query) ||
          c.email?.toLowerCase().includes(query)
      );
    }

    return result;
  }, [customers, type, searchQuery]);

  return { customers, loading, error, filteredCustomers };
}
