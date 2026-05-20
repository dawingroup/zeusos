/**
 * useCustomerPicker
 * Hook for searching and selecting customers with debounced search
 */

import { useState, useCallback, useRef } from 'react';
import { subscribeToCustomers } from '../services/customerService';
import type { CustomerListItem } from '../types';

export function useCustomerPicker() {
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [allCustomers, setAllCustomers] = useState<CustomerListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout>>();

  /**
   * Search customers with debounce (client-side filter)
   */
  const search = useCallback(
    (query: string) => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }

      if (!query.trim()) {
        setCustomers(allCustomers);
        return;
      }

      debounceTimer.current = setTimeout(() => {
        const term = query.toLowerCase();
        const filtered = allCustomers.filter(
          (c) =>
            c.name.toLowerCase().includes(term) ||
            c.code.toLowerCase().includes(term) ||
            c.email?.toLowerCase().includes(term)
        );
        setCustomers(filtered);
      }, 300);
    },
    [allCustomers],
  );

  /**
   * Load pickable customers for the dropdown.
   *
   * Includes `active` AND `prospect` — prospects are the whole point of
   * the CRM deal-creation funnel, so filtering them out (as the
   * previous `status === 'active'` gate did) silently hid exactly the
   * customers users were trying to pick. Only `inactive` is excluded
   * here; merged rows are dropped upstream by `subscribeToCustomers`.
   *
   * We keep the subscription live and return the unsubscribe function
   * so the caller can clean up on unmount. An earlier version called
   * `unsubscribe()` inside the first snapshot callback to make this a
   * one-shot load — but Firestore's onSnapshot fires the cached
   * snapshot first (often partial, e.g. only the just-created record)
   * and the server snapshot second. Unsubscribing after the first
   * snapshot silently cut off the full customer list, leaving only
   * whatever happened to be in the local cache.
   */
  const loadAll = useCallback(() => {
    setLoading(true);
    const unsubscribe = subscribeToCustomers(
      (data) => {
        const pickable = data.filter(c => c.status !== 'inactive');
        setAllCustomers(pickable);
        setCustomers(pickable);
        setLoading(false);
      },
      () => {
        setLoading(false);
      },
    );
    return unsubscribe;
  }, []);

  return {
    customers,
    loading,
    search,
    loadAll,
  };
}
