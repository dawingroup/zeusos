/**
 * RFQ-to-PO Pipeline Service
 * Connects awarded RFQs/Quotations to Purchase Order creation.
 * Bridges the supplier quotation workflow to the procurement pipeline.
 */

import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { SupplierQuotation, RequestForQuotation } from '@/modules/suppliers/types/supplier';
import type { POLineItem, LandedCosts } from '../types/purchaseOrder';
import { DEFAULT_LANDED_COSTS } from '../types/purchaseOrder';
import { createPurchaseOrder } from './purchaseOrderService';

const RFQ_COLLECTION = 'platform/suppliers/rfqs';
const QUOTATIONS_COLLECTION = 'platform/suppliers/quotations';

// ============================================================================
// RFQ AWARD → PO CREATION
// ============================================================================

/**
 * Create a Purchase Order from an awarded RFQ quotation.
 * Validates the quotation is accepted and the RFQ is awarded to this supplier.
 */
export async function createPOFromAwardedQuotation(
  quotationId: string,
  userId: string,
  options: {
    subsidiaryId: string;
    linkedProjectId?: string;
    notes?: string;
    landedCosts?: LandedCosts;
  },
): Promise<{ poId: string; poNumber: string }> {
  // Fetch the quotation
  const quotationRef = doc(db, QUOTATIONS_COLLECTION, quotationId);
  const quotationSnap = await getDoc(quotationRef);
  if (!quotationSnap.exists()) {
    throw new Error('Quotation not found');
  }
  const quotation = { id: quotationSnap.id, ...quotationSnap.data() } as SupplierQuotation;

  // Validate quotation status
  if (quotation.status !== 'accepted') {
    throw new Error(`Quotation must be in "accepted" status, currently: ${quotation.status}`);
  }

  // If linked to RFQ, validate the RFQ award
  if (quotation.rfqId) {
    const rfqRef = doc(db, RFQ_COLLECTION, quotation.rfqId);
    const rfqSnap = await getDoc(rfqRef);
    if (rfqSnap.exists()) {
      const rfq = rfqSnap.data() as RequestForQuotation;
      if (rfq.awardedSupplierId && rfq.awardedSupplierId !== quotation.supplierId) {
        throw new Error('RFQ was awarded to a different supplier');
      }
    }
  }

  // Convert quotation items to PO line items
  const lineItems: POLineItem[] = quotation.items.map((item, index) => ({
    id: `LI-${Date.now()}-${index}`,
    description: item.description,
    quantity: item.quantity,
    unitCost: item.unitRate.amount,
    totalCost: item.amount.amount,
    currency: quotation.currency,
    unit: item.unit,
    quantityReceived: 0,
    sku: item.materialCode ?? undefined,
    inventoryItemId: item.materialId ?? undefined,
  }));

  // Create the PO
  const poId = await createPurchaseOrder(
    {
      supplierName: quotation.supplierName,
      supplierId: quotation.supplierId,
      lineItems,
      landedCosts: options.landedCosts ?? { ...DEFAULT_LANDED_COSTS, currency: quotation.currency },
      subsidiaryId: options.subsidiaryId,
      linkedProjectId: options.linkedProjectId ?? quotation.projectId,
      notes: options.notes ?? `Created from Quotation ${quotation.quotationNumber}${quotation.rfqId ? ` (RFQ: ${quotation.rfqId})` : ''}`,
    },
    userId,
  );

  // Update quotation to mark PO created
  await updateDoc(quotationRef, {
    linkedPOId: poId,
    updatedAt: serverTimestamp(),
  });

  // Update RFQ status if linked
  if (quotation.rfqId) {
    const rfqRef = doc(db, RFQ_COLLECTION, quotation.rfqId);
    await updateDoc(rfqRef, {
      status: 'awarded',
      awardedSupplierId: quotation.supplierId,
      awardedQuotationId: quotationId,
      awardedAt: serverTimestamp(),
      awardedBy: userId,
      linkedPOId: poId,
      'audit.updatedAt': serverTimestamp(),
      'audit.updatedBy': userId,
    });
  }

  return { poId, poNumber: '' }; // PO number resolved from the created document
}

/**
 * Create POs from multiple accepted quotations in bulk.
 */
export async function createPOsFromMultipleQuotations(
  quotationIds: string[],
  userId: string,
  subsidiaryId: string,
): Promise<{ created: number; failed: number; results: Array<{ quotationId: string; poId?: string; error?: string }> }> {
  const results: Array<{ quotationId: string; poId?: string; error?: string }> = [];
  let created = 0;
  let failed = 0;

  for (const quotationId of quotationIds) {
    try {
      const { poId } = await createPOFromAwardedQuotation(quotationId, userId, {
        subsidiaryId,
      });
      results.push({ quotationId, poId });
      created++;
    } catch (error) {
      results.push({ quotationId, error: (error as Error).message });
      failed++;
    }
  }

  return { created, failed, results };
}

/**
 * Get quotations that are accepted but not yet linked to a PO.
 * These are ready for PO conversion.
 */
export async function getQuotationsReadyForPO(
  supplierId?: string,
): Promise<SupplierQuotation[]> {
  const { getDocs, query, where, collection } = await import('firebase/firestore');

  const constraints = [
    where('status', '==', 'accepted'),
  ];

  if (supplierId) {
    constraints.push(where('supplierId', '==', supplierId));
  }

  const q = query(collection(db, QUOTATIONS_COLLECTION), ...constraints);
  const snap = await getDocs(q);

  // Filter out quotations that already have a linked PO
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() } as SupplierQuotation & { linkedPOId?: string }))
    .filter((q) => !(q as any).linkedPOId);
}
