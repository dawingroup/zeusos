/**
 * Contractor Performance Service
 * Computes performance metrics for contractor/subcontractor suppliers
 * based on their Outsourced Purchase Order (OPO) history.
 */

import {
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { PurchaseOrder } from '../types/purchaseOrder';
import type { ContractorPerformanceMetrics } from '@/modules/suppliers/types/supplier';

const PURCHASE_ORDERS_COLLECTION = 'purchaseOrders';

/**
 * Compute contractor performance metrics from their OPO history.
 *
 * Queries all outsourced purchase orders for the given supplier,
 * then calculates on-time rate, average lead time, total spend,
 * and a composite performance score.
 */
export async function computeContractorPerformance(
  supplierId: string,
  subsidiaryId: string,
): Promise<ContractorPerformanceMetrics> {
  // Query all OPOs for this supplier
  const q = query(
    collection(db, PURCHASE_ORDERS_COLLECTION),
    where('purchaseOrderType', '==', 'outsourced'),
    where('supplierId', '==', supplierId),
  );

  const snapshot = await getDocs(q);
  const opos: PurchaseOrder[] = snapshot.docs.map(d => ({
    id: d.id,
    ...d.data(),
  } as PurchaseOrder));

  // Filter by subsidiary if needed (Firestore compound query limits)
  const filtered = subsidiaryId
    ? opos.filter(o => o.subsidiaryId === subsidiaryId)
    : opos;

  const totalOrders = filtered.length;

  if (totalOrders === 0) {
    return {
      totalOrders: 0,
      completedOrders: 0,
      onTimeDeliveries: 0,
      lateDeliveries: 0,
      onTimeRate: 0,
      averageLeadTimeDays: 0,
      totalSpend: 0,
      performanceScore: 0,
    };
  }

  // Completed orders are those with status 'received' or 'closed'
  const completedStatuses = new Set(['received', 'closed']);
  const completedOrders = filtered.filter(o => completedStatuses.has(o.status));

  let onTimeDeliveries = 0;
  let lateDeliveries = 0;
  let totalLeadTimeDays = 0;
  let leadTimeCount = 0;
  let totalSpend = 0;
  let lastOrderDate: PurchaseOrder['orderDate'] | undefined;

  for (const opo of filtered) {
    // Sum total spend from totalProductCost (OPO composite cost)
    totalSpend += opo.totalProductCost ?? opo.totals?.grandTotal ?? 0;

    // Track most recent order date
    if (opo.orderDate) {
      if (!lastOrderDate || (opo.orderDate as any).toMillis?.() > (lastOrderDate as any).toMillis?.()) {
        lastOrderDate = opo.orderDate as any;
      }
    }
  }

  // For completed orders, compute on-time vs late and lead times
  for (const opo of completedOrders) {
    const expectedDate = opo.expectedDeliveryDate;
    const receivingHistory = opo.receivingHistory ?? [];

    // Find the actual last receipt date
    let lastReceiptDate: Date | null = null;
    for (const receipt of receivingHistory) {
      const receiptDate = receipt.receivedAt?.toDate?.();
      if (receiptDate && (!lastReceiptDate || receiptDate > lastReceiptDate)) {
        lastReceiptDate = receiptDate;
      }
    }

    // Determine on-time vs late
    if (expectedDate && lastReceiptDate) {
      const expectedMs = expectedDate.toDate?.()
        ? expectedDate.toDate().getTime()
        : new Date(expectedDate as any).getTime();
      const actualMs = lastReceiptDate.getTime();

      if (actualMs <= expectedMs) {
        onTimeDeliveries++;
      } else {
        lateDeliveries++;
      }
    } else if (lastReceiptDate) {
      // No expected date set — count as on-time (cannot be late without a target)
      onTimeDeliveries++;
    }

    // Calculate lead time (from order date to last receipt)
    const orderDate = opo.orderDate?.toDate?.()
      ? opo.orderDate.toDate()
      : opo.createdAt?.toDate?.()
        ? opo.createdAt.toDate()
        : null;

    if (orderDate && lastReceiptDate) {
      const diffMs = lastReceiptDate.getTime() - orderDate.getTime();
      const diffDays = Math.max(0, diffMs / (1000 * 60 * 60 * 24));
      totalLeadTimeDays += diffDays;
      leadTimeCount++;
    }
  }

  const completedCount = completedOrders.length;
  const onTimeRate = completedCount > 0
    ? Math.round((onTimeDeliveries / completedCount) * 100)
    : 0;
  const completionRate = totalOrders > 0
    ? (completedCount / totalOrders) * 100
    : 0;
  const averageLeadTimeDays = leadTimeCount > 0
    ? Math.round((totalLeadTimeDays / leadTimeCount) * 10) / 10
    : 0;

  // Composite performance score: 60% on-time rate + 40% completion rate
  const performanceScore = Math.round((onTimeRate * 0.6) + (completionRate * 0.4));

  return {
    totalOrders,
    completedOrders: completedCount,
    onTimeDeliveries,
    lateDeliveries,
    onTimeRate,
    averageLeadTimeDays,
    totalSpend,
    lastOrderDate: lastOrderDate as any,
    performanceScore,
  };
}
