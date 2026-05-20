/**
 * useDesignProjectChangeOrders — live CO context for a Design Project.
 *
 * Subscribes to the linked SalesOrder and its change orders, and exposes
 * a normalized `DesignProjectCOContext` object (scope version, CO
 * counts, per-design-item action map). Returns an "empty" context when
 * the project has no linked SO.
 */

import { useEffect, useState } from 'react';
import type { DesignProjectCOContext } from '../services/changeOrderContextService';
import { subscribeToDesignProjectCOContext } from '../services/changeOrderContextService';

const EMPTY: DesignProjectCOContext = {
  salesOrderId: null,
  salesOrderNumber: null,
  scopeVersion: 1,
  scopeFrozen: false,
  totalCount: 0,
  openCount: 0,
  approvedCount: 0,
  rejectedCount: 0,
  withdrawnCount: 0,
  totalApprovedValue: 0,
  totalPendingValue: 0,
  hasPostFreezeCO: false,
  changeOrders: [],
  itemMap: {},
};

export interface UseDesignProjectChangeOrdersResult {
  context: DesignProjectCOContext;
  loading: boolean;
}

export function useDesignProjectChangeOrders(
  linkedSalesOrderId: string | null | undefined,
): UseDesignProjectChangeOrdersResult {
  const [context, setContext] = useState<DesignProjectCOContext>(EMPTY);
  const [loading, setLoading] = useState<boolean>(Boolean(linkedSalesOrderId));

  useEffect(() => {
    if (!linkedSalesOrderId) {
      setContext(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsub = subscribeToDesignProjectCOContext(linkedSalesOrderId, (ctx) => {
      setContext(ctx);
      setLoading(false);
    });
    return unsub;
  }, [linkedSalesOrderId]);

  return { context, loading };
}
