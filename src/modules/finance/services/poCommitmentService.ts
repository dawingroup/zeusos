/**
 * PO Commitment Service
 * Aggregates approved Purchase Order amounts into budget commitments
 * and projects PO-driven cash outflows for cash flow forecasting.
 */

import {
  collection,
  getDocs,
  query,
  where,
  doc,
  writeBatch,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { PurchaseOrder } from '@/modules/procurement/types/purchaseOrder';

const PURCHASE_ORDERS_COLLECTION = 'purchaseOrders';
const BUDGETS_COLLECTION = 'budgets';
const BUDGET_LINES_COLLECTION = 'budgetLines';

// ============================================================================
// TYPES
// ============================================================================

export interface POCommitmentSummary {
  totalCommitted: number;
  totalReceived: number;
  totalPending: number;
  currency: string;
  bySupplier: Array<{
    supplierId: string;
    supplierName: string;
    committed: number;
    received: number;
    pending: number;
  }>;
  byStatus: Record<string, { count: number; total: number }>;
}

export interface POCashProjection {
  date: string;          // YYYY-MM-DD
  amount: number;
  poId: string;
  poNumber: string;
  supplierName: string;
  dueDate: string;
  paymentTerms: string;
  status: 'projected' | 'overdue' | 'paid';
}

// ============================================================================
// DEFAULT PAYMENT TERM DAYS
// ============================================================================

const PAYMENT_TERM_DAYS: Record<string, number> = {
  'Net 7': 7,
  'Net 10': 10,
  'Net 15': 15,
  'Net 30': 30,
  'Net 45': 45,
  'Net 60': 60,
  'Net 90': 90,
  'Due on Receipt': 0,
  'COD': 0,
  'Prepaid': -7, // 7 days before delivery
};

function getPaymentTermDays(terms?: string): number {
  if (!terms) return 30; // Default to Net 30
  return PAYMENT_TERM_DAYS[terms] ?? 30;
}

// ============================================================================
// COMMITMENT AGGREGATION
// ============================================================================

/**
 * Get all committed PO amounts for a subsidiary.
 * Committed = approved + sent + partially-received (not yet fully paid/closed).
 */
export async function getPOCommitmentSummary(
  subsidiaryId: string,
): Promise<POCommitmentSummary> {
  const committedStatuses = ['approved', 'sent', 'partially-received'];
  const q = query(
    collection(db, PURCHASE_ORDERS_COLLECTION),
    where('subsidiaryId', '==', subsidiaryId),
    where('status', 'in', committedStatuses),
  );
  const snap = await getDocs(q);
  const pos = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PurchaseOrder));

  let totalCommitted = 0;
  let totalReceived = 0;
  const supplierMap = new Map<string, { supplierId: string; supplierName: string; committed: number; received: number }>();
  const statusMap: Record<string, { count: number; total: number }> = {};

  for (const po of pos) {
    const committed = po.totals.grandTotal;
    const receivedValue = po.lineItems.reduce((sum, li) => {
      const receivedRatio = li.quantity > 0 ? li.quantityReceived / li.quantity : 0;
      return sum + (li.totalCost + (li.landedCostAllocation ?? 0)) * receivedRatio;
    }, 0);

    totalCommitted += committed;
    totalReceived += receivedValue;

    // By supplier
    const key = po.supplierId ?? po.supplierName;
    const existing = supplierMap.get(key) ?? {
      supplierId: po.supplierId ?? '',
      supplierName: po.supplierName,
      committed: 0,
      received: 0,
    };
    existing.committed += committed;
    existing.received += receivedValue;
    supplierMap.set(key, existing);

    // By status
    if (!statusMap[po.status]) {
      statusMap[po.status] = { count: 0, total: 0 };
    }
    statusMap[po.status].count++;
    statusMap[po.status].total += committed;
  }

  const bySupplier = Array.from(supplierMap.values())
    .map((s) => ({ ...s, pending: s.committed - s.received }))
    .sort((a, b) => b.committed - a.committed);

  return {
    totalCommitted,
    totalReceived,
    totalPending: totalCommitted - totalReceived,
    currency: pos[0]?.totals.currency ?? 'UGX',
    bySupplier,
    byStatus: statusMap,
  };
}

// ============================================================================
// BUDGET COMMITMENT SYNC
// ============================================================================

/**
 * Sync PO committed amounts into budget line items.
 * Matches POs to budget lines by account type (expense accounts).
 * Updates totalCommitted on the parent budget after sync.
 */
export async function syncPOCommitmentsToBudget(
  companyId: string,
  subsidiaryId: string,
  userId: string,
): Promise<{ updatedLines: number; totalCommitted: number }> {
  // Get all committed POs
  const summary = await getPOCommitmentSummary(subsidiaryId);

  // Get active budgets for this company
  const budgetQuery = query(
    collection(db, 'companies', companyId, BUDGETS_COLLECTION),
    where('status', 'in', ['active', 'approved']),
  );
  const budgetSnap = await getDocs(budgetQuery);

  let updatedLines = 0;

  for (const budgetDoc of budgetSnap.docs) {
    const budgetId = budgetDoc.id;

    // Get budget lines (expense-type accounts map to PO spend)
    const linesQuery = query(
      collection(db, 'companies', companyId, BUDGET_LINES_COLLECTION),
      where('budgetId', '==', budgetId),
    );
    const linesSnap = await getDocs(linesQuery);

    const batch = writeBatch(db);
    let budgetTotalCommitted = 0;

    for (const lineDoc of linesSnap.docs) {
      const line = lineDoc.data();
      // Only update expense-type budget lines with PO commitment
      if (['expense', 'cost_of_goods_sold'].includes(line.accountType)) {
        // Proportionally allocate PO commitment across expense lines
        const lineShare = line.annualBudget > 0
          ? (line.annualBudget / budgetDoc.data().totalBudget) * summary.totalCommitted
          : 0;

        const roundedShare = Math.round(lineShare * 100) / 100;
        budgetTotalCommitted += roundedShare;

        batch.update(lineDoc.ref, {
          annualCommitted: roundedShare,
          annualAvailable: line.annualBudget - line.annualActual - roundedShare,
          updatedAt: Timestamp.now(),
          updatedBy: userId,
        });
        updatedLines++;
      }
    }

    // Update the parent budget totalCommitted
    batch.update(doc(db, 'companies', companyId, BUDGETS_COLLECTION, budgetId), {
      totalCommitted: Math.round(budgetTotalCommitted * 100) / 100,
      totalAvailable: budgetDoc.data().totalBudget - budgetDoc.data().totalActual - budgetTotalCommitted,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });

    await batch.commit();
  }

  return { updatedLines, totalCommitted: summary.totalCommitted };
}

// ============================================================================
// PO CASH FLOW PROJECTIONS
// ============================================================================

/**
 * Project future cash outflows from approved/sent POs based on payment terms.
 * Returns a timeline of expected payments.
 */
export async function getPOCashProjections(
  subsidiaryId: string,
  horizonMonths: number = 6,
): Promise<POCashProjection[]> {
  const committedStatuses = ['approved', 'sent', 'partially-received'];
  const q = query(
    collection(db, PURCHASE_ORDERS_COLLECTION),
    where('subsidiaryId', '==', subsidiaryId),
    where('status', 'in', committedStatuses),
  );
  const snap = await getDocs(q);
  const pos = snap.docs.map((d) => ({ id: d.id, ...d.data() } as PurchaseOrder));

  const now = new Date();
  const horizonEnd = new Date(now);
  horizonEnd.setMonth(horizonEnd.getMonth() + horizonMonths);

  const projections: POCashProjection[] = [];

  for (const po of pos) {
    // Calculate outstanding amount (not yet received/paid)
    const outstandingAmount = po.lineItems.reduce((sum, li) => {
      const remainingRatio = li.quantity > 0
        ? Math.max(0, (li.quantity - li.quantityReceived) / li.quantity)
        : 0;
      return sum + (li.totalCost + (li.landedCostAllocation ?? 0)) * remainingRatio;
    }, 0);

    if (outstandingAmount <= 0) continue;

    // Determine due date based on approval/sent date + payment terms
    const paymentTermDays = getPaymentTermDays(po.supplierContact); // Payment terms from supplier
    const baseDate = po.updatedAt
      ? new Date((po.updatedAt as unknown as { seconds: number }).seconds * 1000)
      : new Date();
    const dueDate = new Date(baseDate);
    dueDate.setDate(dueDate.getDate() + paymentTermDays);

    if (dueDate > horizonEnd) continue;

    const status: POCashProjection['status'] = dueDate < now ? 'overdue' : 'projected';

    projections.push({
      date: dueDate.toISOString().split('T')[0],
      amount: Math.round(outstandingAmount * 100) / 100,
      poId: po.id,
      poNumber: po.poNumber,
      supplierName: po.supplierName,
      dueDate: dueDate.toISOString().split('T')[0],
      paymentTerms: po.supplierContact ?? 'Net 30',
      status,
    });
  }

  // Sort by due date
  projections.sort((a, b) => a.date.localeCompare(b.date));

  return projections;
}

/**
 * Aggregate PO cash projections by month for cash flow forecasting.
 */
export async function getPOMonthlyCashOutflows(
  subsidiaryId: string,
  horizonMonths: number = 12,
): Promise<Array<{ month: string; amount: number; poCount: number }>> {
  const projections = await getPOCashProjections(subsidiaryId, horizonMonths);

  const monthMap = new Map<string, { amount: number; poCount: number }>();

  for (const p of projections) {
    const month = p.date.slice(0, 7); // YYYY-MM
    const existing = monthMap.get(month) ?? { amount: 0, poCount: 0 };
    existing.amount += p.amount;
    existing.poCount++;
    monthMap.set(month, existing);
  }

  return Array.from(monthMap.entries())
    .map(([month, data]) => ({
      month,
      amount: Math.round(data.amount * 100) / 100,
      poCount: data.poCount,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}
