/**
 * useFinishAttributes Hook
 * Fetches and subscribes to attribute definitions for a finish category.
 */

import { useState, useEffect } from 'react';
import type { AttributeDefinition, FinishCategory } from '../types';
import { subscribeToAttributeDefinitions } from '../services/finishAttributeService';

interface UseFinishAttributesResult {
  attributes: AttributeDefinition[];
  loading: boolean;
  error: Error | null;
}

export function useFinishAttributes(
  organizationId: string | undefined,
  category?: FinishCategory
): UseFinishAttributesResult {
  const [attributes, setAttributes] = useState<AttributeDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!organizationId) {
      setAttributes([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const unsubscribe = subscribeToAttributeDefinitions(
      organizationId,
      (defs) => {
        setAttributes(defs);
        setLoading(false);
      },
      category
    );

    return () => unsubscribe();
  }, [organizationId, category]);

  return { attributes, loading, error };
}
