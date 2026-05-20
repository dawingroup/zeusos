/**
 * useIncomingManufacturingItems Hook
 * Fetches design items approaching manufacturing that haven't been handed over
 */

import { useState, useEffect, useCallback } from 'react';
import { fetchIncomingManufacturingItems } from '../services/incomingItemsService';
import type { IncomingManufacturingItem } from '../types';

interface UseIncomingManufacturingItemsReturn {
  items: IncomingManufacturingItem[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useIncomingManufacturingItems(): UseIncomingManufacturingItemsReturn {
  const [items, setItems] = useState<IncomingManufacturingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchIncomingManufacturingItems();
      setItems(data);
    } catch (err) {
      console.error('Error fetching incoming manufacturing items:', err);
      setError('Failed to load incoming items');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { items, loading, error, refetch: fetchData };
}
