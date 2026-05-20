/**
 * Deal → Sales Order Bridge Service
 * Creates a sales order when a CRM deal is marked as won.
 * Looks up the deal's linked project, finds approved quotes, and calls createFromQuote.
 */

import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  doc,
  updateDoc,
  getDoc,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import { getDeal } from './crmDealService';
import { createFromQuote, appendQuoteLinesToSalesOrder } from '@/modules/sales-orders/services/salesOrderService';
import type { SalesOrder } from '@/modules/sales-orders/types';
import { SO_COLLECTION } from '@/modules/sales-orders/constants';
import { getApprovedLineItems } from '@/modules/design-manager/services/clientPortalService';
import type { ClientQuote, ClientQuoteLineItem } from '@/modules/design-manager/types/clientPortal';
import type { ItemCategory } from '@/modules/sales-orders/types';
import { stampSalesOrderDealId } from '@/shared/utils/fkResolvers';

const CLIENT_QUOTES_COLLECTION = 'clientQuotes';
const APPROVED_QUOTE_SCAN_LIMIT = 20;

/** Map quote categories to SO item categories */
export function mapCategory(cat: ClientQuoteLineItem['category']): ItemCategory {
  switch (cat) {
    case 'material':
    case 'hardware':
    case 'finishing':
      return 'furniture';
    case 'labor':
      return 'installation';
    case 'outsourcing':
    case 'procurement':
    case 'procurement-logistics':
    case 'procurement-customs':
      return 'fitout';
    case 'overhead':
      return 'consultation';
    default:
      return 'other';
  }
}

export interface DealToSOResult {
  salesOrderId?: string;
  quoteUsed?: string;
  skipped?: boolean;
  reason?: string;
}

/**
 * Find the most recent quote that can produce an SO, optionally preferring the
 * same document as an existing sales order (`quoteId`) so progressive line
 * approvals stay on one quotation.
 */
export async function findApprovedQuoteForProject(
  projectId: string,
  options?: { preferQuoteId?: string },
): Promise<ClientQuote | null> {
  const q = query(
    collection(db, CLIENT_QUOTES_COLLECTION),
    where('projectId', '==', projectId),
    orderBy('createdAt', 'desc'),
    limit(APPROVED_QUOTE_SCAN_LIMIT),
  );

  const snap = await getDocs(q);
  if (snap.empty) return null;

  const quotes = snap.docs.map((quoteDoc) => ({
    id: quoteDoc.id,
    ...quoteDoc.data(),
  })) as ClientQuote[];

  if (options?.preferQuoteId) {
    const preferred = quotes.find((quote) => quote.id === options.preferQuoteId);
    if (preferred && getApprovedLineItems(preferred).length > 0) {
      return preferred;
    }
  }

  // Preferred: overall approved status with SO-eligible items.
  const statusApproved = quotes.find(
    (quote) => quote.status === 'approved' && getApprovedLineItems(quote).length > 0,
  );
  if (statusApproved) return statusApproved;

  // Fallback: item-level approvals exist but quote status not normalized yet.
  const partialApproved = quotes.find((quote) => getApprovedLineItems(quote).length > 0);
  if (partialApproved) return partialApproved;

  return null;
}

/**
 * Create a sales order from a CRM deal that has been marked as won.
 * Looks for approved quotes linked to the deal's project. If none found, returns
 * without creating an SO (the user can create one manually).
 */
export async function createSalesOrderFromDeal(
  dealId: string,
  userId: string,
  subsidiaryId: string,
): Promise<DealToSOResult> {
  const deal = await getDeal(dealId);
  if (!deal) throw new Error('Deal not found');

  // Must have a linked project to find quotes
  if (!deal.linkedProjectId) {
    return { skipped: true, reason: 'No linked project — create a sales order manually' };
  }

  const quote = await findApprovedQuoteForProject(deal.linkedProjectId);

  if (!quote) {
    // No approved quote — skip SO creation
    return { skipped: true, reason: 'No approved quotation found for the linked project' };
  }

  // Map approved quote line items to SO line items (backward compat: all items if no approvalStatus)
  const approvedItems = getApprovedLineItems(quote);
  if (approvedItems.length === 0) {
    return { skipped: true, reason: 'No approved line items found on the linked quote' };
  }
  const lineItems = approvedItems.map((li) => ({
    description: li.description,
    specification: '',
    quantity: li.quantity,
    unit: li.unit || 'pcs',
    unitPrice: li.unitPrice,
    totalPrice: li.totalPrice,
    category: mapCategory(li.category),
    designItemId: li.linkedDesignItemId,
    quoteLineItemId: li.id,
  }));

  return _createSOFromDeal(dealId, deal, quote, lineItems, userId, subsidiaryId);
}

/**
 * Create a sales order from a CRM deal with a specific subset of quote line items.
 * Used by the SelectItemsForSODialog when the user picks which items to include.
 */
export async function createSalesOrderFromDealWithItems(
  dealId: string,
  userId: string,
  subsidiaryId: string,
  selectedLineItems: ClientQuoteLineItem[],
  quote: ClientQuote,
): Promise<DealToSOResult> {
  const deal = await getDeal(dealId);
  if (!deal) throw new Error('Deal not found');

  if (!deal.linkedProjectId) {
    return { skipped: true, reason: 'No linked project' };
  }
  if (selectedLineItems.length === 0) {
    return { skipped: true, reason: 'No line items selected for the sales order' };
  }

  const lineItems = selectedLineItems.map((li) => ({
    description: li.description,
    specification: '',
    quantity: li.quantity,
    unit: li.unit || 'pcs',
    unitPrice: li.unitPrice,
    totalPrice: li.totalPrice,
    category: mapCategory(li.category),
    designItemId: li.linkedDesignItemId,
    quoteLineItemId: li.id,
  }));

  return _createSOFromDeal(dealId, deal, quote, lineItems, userId, subsidiaryId);
}

/**
 * True if this approved quote line is already represented on the sales order scope.
 * Uses `quoteLineItemId` when present; otherwise matches `designItemId` ↔ `linkedDesignItemId`.
 */
export function isQuoteLineAlreadyOnSalesOrder(
  so: SalesOrder,
  quoteLine: ClientQuoteLineItem,
): boolean {
  for (const item of so.scopeItems) {
    if (!item.isActive) continue;
    if (item.quoteLineItemId && item.quoteLineItemId === quoteLine.id) return true;
    const did = quoteLine.linkedDesignItemId;
    if (did && item.designItemId === did) return true;
  }
  return false;
}

/**
 * Append selected approved quote lines to an existing SO (same deal / progressive approval).
 */
export async function appendQuoteLinesToDealSalesOrder(
  dealId: string,
  salesOrderId: string,
  userId: string,
  selectedLineItems: ClientQuoteLineItem[],
  quote: ClientQuote,
): Promise<DealToSOResult> {
  const deal = await getDeal(dealId);
  if (!deal) throw new Error('Deal not found');

  const soSnap = await getDoc(doc(db, SO_COLLECTION, salesOrderId));
  if (!soSnap.exists()) throw new Error('Sales order not found');
  const soDealId = soSnap.data()?.dealId as string | undefined;
  if (soDealId && soDealId !== dealId) {
    throw new Error('Sales order does not belong to this deal');
  }

  if (selectedLineItems.length === 0) {
    return { skipped: true, reason: 'No line items selected' };
  }

  const lineItems = selectedLineItems.map((li) => ({
    description: li.description,
    specification: '',
    quantity: li.quantity,
    unit: li.unit || 'pcs',
    unitPrice: li.unitPrice,
    totalPrice: li.totalPrice,
    category: mapCategory(li.category),
    designItemId: li.linkedDesignItemId,
    quoteLineItemId: li.id,
  }));

  await appendQuoteLinesToSalesOrder(salesOrderId, lineItems, userId);
  return { salesOrderId, quoteUsed: quote.id };
}

/** Shared SO creation logic */
async function _createSOFromDeal(
  dealId: string,
  deal: Awaited<ReturnType<typeof getDeal>>,
  quote: ClientQuote,
  lineItems: Array<{
    description: string;
    specification: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
    category: ItemCategory;
    designItemId?: string;
    quoteLineItemId?: string;
  }>,
  userId: string,
  subsidiaryId: string,
): Promise<DealToSOResult> {
  if (!deal) throw new Error('Deal not found');

  const selectedTotal = lineItems.reduce((sum, li) => sum + li.totalPrice, 0);

  // Build payment terms from quote milestone payments
  const depositPercent = quote.milestonePayments?.[0]?.percentage ?? quote.depositRequired ?? 50;
  const paymentTerms = {
    depositRequired: true,
    depositPercent,
    billingMilestones: quote.milestonePayments?.map((m) => `${m.label}: ${m.percentage}%`) ?? [],
    milestonePayments: quote.milestonePayments ?? [],
  };

  const salesOrderId = await createFromQuote(
    {
      designProjectId: deal.linkedProjectId!,
      quoteId: quote.id,
      // P16/F13 — canonical CRM deal FK. Legacy `crmDealId` was dropped
      // post-backfill (2026-04-18); the stamp helper now emits only
      // `{ dealId }` but stays as the centralized writer idiom.
      ...stampSalesOrderDealId(dealId),
      customerId: deal.customerId,
      customerName: deal.customerName,
      customerPhone: deal.customerPhone,
      // P8/F1 — forward the deal's party ref verbatim. If the deal
      // predates P8-2 and has no `party`, `createFromQuote` will fall
      // back to the finishes_customer default — same net effect as
      // before P8-2, just plus the new field.
      party: deal.party,
      title: deal.title,
      description: deal.description || `Sales order from deal ${deal.dealNumber}`,
      originalQuoteAmount: selectedTotal,
      currency: (quote.currency === 'UGX' || quote.currency === 'USD' ? quote.currency : 'UGX') as 'UGX' | 'USD',
      lineItems,
      paymentTerms,
    },
    userId,
    subsidiaryId,
  );

  // Write back linkedSalesOrderId to the deal
  if (salesOrderId) {
    try {
      const dealRef = doc(db, 'crmDeals', dealId);
      await updateDoc(dealRef, { linkedSalesOrderId: salesOrderId });
    } catch (err) {
      console.warn('[DealToSO] Failed to write back linkedSalesOrderId:', err);
    }
  }

  return { salesOrderId, quoteUsed: quote.id };
}
