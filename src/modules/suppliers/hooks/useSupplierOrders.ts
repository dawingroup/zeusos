/**
 * useSupplierOrders Hook
 * Subscribes to purchase orders for a specific supplier (real-time).
 */

import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { PurchaseOrder } from '@/modules/procurement/types/purchaseOrder';

export interface UseSupplierOrdersReturn {
  orders: PurchaseOrder[];
  loading: boolean;
  error: string | null;
  /** Aggregate stats computed from the orders */
  stats: {
    totalOrders: number;
    totalValue: number;
    currency: string;
    openOrders: number;
    receivedOrders: number;
    avgOrderValue: number;
  };
}

const ACTIVE_STATUSES = ['draft', 'pending-approval', 'approved', 'sent', 'partially-received'];
const RECEIVED_STATUSES = ['received', 'closed'];

export function useSupplierOrders(supplierId: string | null): UseSupplierOrdersReturn {
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!supplierId) {
      setOrders([]);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, 'purchaseOrders'),
      where('supplierId', '==', supplierId),
      orderBy('createdAt', 'desc'),
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const results = snapshot.docs.map(
          (d) => ({ id: d.id, ...d.data() } as PurchaseOrder),
        );
        setOrders(results);
        setLoading(false);
      },
      (err) => {
        console.error('Failed to subscribe to supplier orders:', err);
        setError(err.message);
        setLoading(false);
      },
    );

    return unsubscribe;
  }, [supplierId]);

  const stats = {
    totalOrders: orders.length,
    totalValue: orders.reduce((sum, o) => sum + (o.totals?.grandTotal || 0), 0),
    currency: orders[0]?.totals?.currency || 'UGX',
    openOrders: orders.filter((o) => ACTIVE_STATUSES.includes(o.status)).length,
    receivedOrders: orders.filter((o) => RECEIVED_STATUSES.includes(o.status)).length,
    avgOrderValue:
      orders.length > 0
        ? orders.reduce((sum, o) => sum + (o.totals?.grandTotal || 0), 0) / orders.length
        : 0,
  };

  return { orders, loading, error, stats };
}
