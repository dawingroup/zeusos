/**
 * useProductionContext — Real-time subscription to Manufacturing Order data
 *
 * Subscribes to the MO document and enriches BOM entries with stock availability
 * badges from the stockLevels collection.
 */

import { useState, useEffect } from 'react';
import { subscribeToMO, fetchMOWithBOM } from '../services/productionService';
import type { ProductionContext } from '../types/workshop-viewer.types';

interface UseProductionContextResult {
  production: ProductionContext | null;
  loading: boolean;
  error: string | null;
}

export function useProductionContext(moId: string | null): UseProductionContextResult {
  const [production, setProduction] = useState<ProductionContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!moId) {
      setProduction(null);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    // Initial fetch
    fetchMOWithBOM(moId)
      .then((ctx) => {
        setProduction(ctx);
        if (!ctx) setError('Manufacturing order not found');
      })
      .catch((err) => {
        console.error('[useProductionContext] Initial fetch failed:', err);
        setError('Failed to load manufacturing order');
      })
      .finally(() => setLoading(false));

    // Real-time subscription for updates
    const unsub = subscribeToMO(moId, (ctx) => {
      setProduction(ctx);
    });

    return () => unsub();
  }, [moId]);

  return { production, loading, error };
}
