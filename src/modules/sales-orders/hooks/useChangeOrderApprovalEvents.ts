/**
 * useChangeOrderApprovalEvents — real-time approval audit trail for a CO.
 * Reads from `changeOrders/{coId}/approvalEvents` (ordered ascending by
 * createdAt). Every state transition writes exactly one event.
 */

import { useEffect, useState } from 'react';
import type { ChangeOrderApprovalEvent } from '../types';
import { subscribeToApprovalEvents } from '../services/changeOrderService';

export interface UseChangeOrderApprovalEventsResult {
  events: ChangeOrderApprovalEvent[];
  loading: boolean;
}

export function useChangeOrderApprovalEvents(
  coId: string | undefined,
): UseChangeOrderApprovalEventsResult {
  const [events, setEvents] = useState<ChangeOrderApprovalEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!coId) {
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToApprovalEvents(coId, (rows) => {
      setEvents(rows);
      setLoading(false);
    });
    return unsub;
  }, [coId]);

  return { events, loading };
}
