/**
 * useFulfillmentItems hook
 * Subscribes to all design items with active fulfillment status
 */

import { useState, useEffect } from 'react';
import {
  subscribeToFulfillmentItems,
  type FulfillmentItem,
} from '../services/fulfillmentQueryService';
import type { FulfillmentStatus } from '@/modules/design-manager/types';
import { deriveFulfillmentStatus } from '@/modules/design-manager/services/designItemStatusDerivation';

export function useFulfillmentItems(filterProject?: string) {
  const [items, setItems] = useState<FulfillmentItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeToFulfillmentItems((allItems) => {
      const filtered = filterProject
        ? allItems.filter((i) => i.projectId === filterProject)
        : allItems;
      setItems(filtered);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [filterProject]);

  // Group items by DERIVED status — so the kanban column reflects the
  // timestamp ground truth rather than the potentially stale flat field.
  // See P7/F10.
  const byStatus = items.reduce<Record<FulfillmentStatus, FulfillmentItem[]>>(
    (acc, item) => {
      const status = deriveFulfillmentStatus(item);
      if (!acc[status]) acc[status] = [];
      acc[status].push(item);
      return acc;
    },
    {} as Record<FulfillmentStatus, FulfillmentItem[]>,
  );

  return { items, byStatus, loading };
}
