// ============================================================================
// QBO SYNC SERVICE
// ZeusOS v2.0 - Financial Management Module
// Frontend service for QuickBooks Online financial data sync
// ============================================================================

import { httpsCallable } from 'firebase/functions';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  onSnapshot,
  Unsubscribe,
} from 'firebase/firestore';
import { functions, db } from '@/shared/services/firebase';
import type {
  QBOConnectionStatus,
  QBOSyncJob,
  QBODataCategory,
  QBOProfitAndLoss,
  QBOBalanceSheet,
  QBOCashFlow,
  QBOAccount,
  QBOInvoice,
  QBOBill,
  QBOBankTransaction,
} from '../types/integrations.types';

// ============================================================================
// CONNECTION
// ============================================================================

/**
 * Get QBO connection status
 */
export async function getQBOConnectionStatus(): Promise<QBOConnectionStatus> {
  const checkConnection = httpsCallable(functions, 'qbCheckConnection');
  const result = await checkConnection();
  return result.data as QBOConnectionStatus;
}

/**
 * Get QBO OAuth authorization URL
 */
export async function getQBOAuthUrl(): Promise<string> {
  const getAuthUrl = httpsCallable(functions, 'qbGetAuthUrl');
  const result = await getAuthUrl();
  return (result.data as { url: string }).url;
}

// ============================================================================
// SYNC OPERATIONS
// ============================================================================

/**
 * Sync all QBO financial data
 */
export async function syncAllQBOData(
  companyId: string,
  categories?: QBODataCategory[]
): Promise<{
  success: boolean;
  results: Record<string, unknown>;
  errors?: Record<string, string>;
}> {
  const syncAll = httpsCallable(functions, 'syncAllQBOData');
  const result = await syncAll({ companyId, categories });
  return result.data as {
    success: boolean;
    results: Record<string, unknown>;
    errors?: Record<string, string>;
  };
}

/**
 * Sync a single QBO data category
 */
export async function syncQBOCategory(
  companyId: string,
  category: QBODataCategory,
  startDate?: string,
  endDate?: string
): Promise<{ success: boolean; category: string; result: unknown }> {
  const syncCategory = httpsCallable(functions, 'syncQBOCategory');
  const result = await syncCategory({ companyId, category, startDate, endDate });
  return result.data as { success: boolean; category: string; result: unknown };
}

// ============================================================================
// SYNC HISTORY
// ============================================================================

/**
 * Get QBO sync job history
 */
export async function getQBOSyncHistory(
  companyId: string,
  maxJobs = 20
): Promise<QBOSyncJob[]> {
  const getHistory = httpsCallable(functions, 'getQBOSyncHistory');
  const result = await getHistory({ companyId, limit: maxJobs });
  return (result.data as { jobs: QBOSyncJob[] }).jobs;
}

/**
 * Subscribe to sync jobs (real-time updates)
 */
export function subscribeToSyncJobs(
  companyId: string,
  callback: (jobs: QBOSyncJob[]) => void,
  maxJobs = 10
): Unsubscribe {
  const q = query(
    collection(db, 'companies', companyId, 'qbo_sync_jobs'),
    orderBy('startedAt', 'desc'),
    limit(maxJobs)
  );

  return onSnapshot(q, (snapshot) => {
    const jobs = snapshot.docs.map((d) => ({
      id: d.id,
      ...d.data(),
    })) as QBOSyncJob[];
    callback(jobs);
  }, (error) => {
    console.warn('[QBOSyncService] Sync jobs listener error:', error.message);
  });
}

// ============================================================================
// READ SYNCED DATA
// ============================================================================

/**
 * Get synced Profit & Loss
 */
export async function getQBOProfitAndLoss(
  companyId: string,
  startDate: string,
  endDate: string
): Promise<QBOProfitAndLoss | null> {
  const docId = `pl_${startDate}_${endDate}`;
  const docSnap = await getDoc(
    doc(db, 'companies', companyId, 'qbo_synced_data', docId)
  );
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as QBOProfitAndLoss;
}

/**
 * Get synced Balance Sheet
 */
export async function getQBOBalanceSheet(
  companyId: string,
  asOfDate: string
): Promise<QBOBalanceSheet | null> {
  const docId = `bs_${asOfDate}`;
  const docSnap = await getDoc(
    doc(db, 'companies', companyId, 'qbo_synced_data', docId)
  );
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as QBOBalanceSheet;
}

/**
 * Get synced Cash Flow Statement
 */
export async function getQBOCashFlow(
  companyId: string,
  startDate: string,
  endDate: string
): Promise<QBOCashFlow | null> {
  const docId = `cf_${startDate}_${endDate}`;
  const docSnap = await getDoc(
    doc(db, 'companies', companyId, 'qbo_synced_data', docId)
  );
  if (!docSnap.exists()) return null;
  return { id: docSnap.id, ...docSnap.data() } as QBOCashFlow;
}

/**
 * Get all available P&L reports from synced data.
 * Returns whatever P&L docs exist (fiscal-year, quarterly, monthly, etc.)
 */
export async function getAvailablePLReports(companyId: string): Promise<QBOProfitAndLoss[]> {
  const snapshot = await getDocs(
    collection(db, 'companies', companyId, 'qbo_synced_data')
  );
  return snapshot.docs
    .filter(d => d.id.startsWith('pl_'))
    .map(d => ({ id: d.id, ...d.data() }) as QBOProfitAndLoss);
}

/**
 * Get synced QBO accounts
 */
export async function getQBOAccounts(companyId: string): Promise<QBOAccount[]> {
  const snapshot = await getDocs(
    collection(db, 'companies', companyId, 'qbo_accounts')
  );
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as QBOAccount[];
}

/**
 * Get synced QBO invoices
 */
export async function getQBOInvoices(
  companyId: string,
  maxResults = 50
): Promise<QBOInvoice[]> {
  const q = query(
    collection(db, 'companies', companyId, 'qbo_invoices'),
    orderBy('txnDate', 'desc'),
    limit(maxResults)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as QBOInvoice[];
}

/**
 * Get synced QBO bills
 */
export async function getQBOBills(
  companyId: string,
  maxResults = 50
): Promise<QBOBill[]> {
  const q = query(
    collection(db, 'companies', companyId, 'qbo_bills'),
    orderBy('txnDate', 'desc'),
    limit(maxResults)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as QBOBill[];
}

/**
 * Get synced QBO bank transactions
 */
export async function getQBOBankTransactions(
  companyId: string,
  maxResults = 100
): Promise<QBOBankTransaction[]> {
  const q = query(
    collection(db, 'companies', companyId, 'qbo_bank_transactions'),
    orderBy('txnDate', 'desc'),
    limit(maxResults)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    id: d.id,
    ...d.data(),
  })) as QBOBankTransaction[];
}

// ============================================================================
// BATCH FETCH — MONTHLY FINANCIAL DATA
// ============================================================================

/**
 * Batch-fetch multiple monthly P&L docs in parallel.
 * Returns a Map keyed by period (YYYY-MM).
 */
export async function getMonthlyPLReports(
  companyId: string,
  periods: Array<{ start: string; end: string }>
): Promise<Map<string, QBOProfitAndLoss>> {
  const results = new Map<string, QBOProfitAndLoss>();
  const promises = periods.map(async ({ start, end }) => {
    const pl = await getQBOProfitAndLoss(companyId, start, end);
    if (pl) results.set(start.slice(0, 7), pl);
  });
  await Promise.all(promises);
  return results;
}

/**
 * Batch-fetch multiple monthly Balance Sheet docs in parallel.
 * Returns a Map keyed by period (YYYY-MM).
 */
export async function getMonthlyBSReports(
  companyId: string,
  asOfDates: string[]
): Promise<Map<string, QBOBalanceSheet>> {
  const results = new Map<string, QBOBalanceSheet>();
  const promises = asOfDates.map(async (asOfDate) => {
    const bs = await getQBOBalanceSheet(companyId, asOfDate);
    if (bs) results.set(asOfDate.slice(0, 7), bs);
  });
  await Promise.all(promises);
  return results;
}

/**
 * Batch-fetch multiple monthly Cash Flow docs in parallel.
 * Returns a Map keyed by period (YYYY-MM).
 */
export async function getMonthlyCFReports(
  companyId: string,
  periods: Array<{ start: string; end: string }>
): Promise<Map<string, QBOCashFlow>> {
  const results = new Map<string, QBOCashFlow>();
  const promises = periods.map(async ({ start, end }) => {
    const cf = await getQBOCashFlow(companyId, start, end);
    if (cf) results.set(start.slice(0, 7), cf);
  });
  await Promise.all(promises);
  return results;
}

// ============================================================================
// PURCHASE ORDER → BILL SYNC
// ============================================================================

/**
 * Sync a Purchase Order to QuickBooks Bill
 */
export async function syncPOToBill(poId: string): Promise<{
  success: boolean;
  action: string;
  qboBillId?: string;
  qboBillDocNumber?: string;
}> {
  const syncFunction = httpsCallable<{ poId: string }, {
    success: boolean;
    action: string;
    qboBillId?: string;
    qboBillDocNumber?: string;
  }>(functions, 'syncPOToBill');

  try {
    const result = await syncFunction({ poId });
    return result.data;
  } catch (error: any) {
    console.error('[QBOSyncService] Error syncing PO to Bill:', error);
    throw new Error(error.message || 'Failed to sync Purchase Order to QuickBooks');
  }
}

/**
 * Sync a corrected Purchase Order Bill to QuickBooks (updates existing Bill)
 */
export async function syncBillCorrection(poId: string): Promise<{
  success: boolean;
  action: string;
  qboBillId?: string;
  qboBillDocNumber?: string;
}> {
  const syncFunction = httpsCallable<{ poId: string }, {
    success: boolean;
    action: string;
    qboBillId?: string;
    qboBillDocNumber?: string;
  }>(functions, 'syncBillCorrection');

  try {
    const result = await syncFunction({ poId });
    return result.data;
  } catch (error: any) {
    console.error('[QBOSyncService] Error syncing bill correction:', error);
    throw new Error(error.message || 'Failed to update Bill in QuickBooks after correction');
  }
}

/**
 * Sync multiple Purchase Orders to QuickBooks Bills
 */
export async function syncMultiplePOsToBills(poIds: string[]): Promise<{
  success: boolean;
  synced: number;
  failed: number;
  results: any[];
  errors: any[];
}> {
  const syncFunction = httpsCallable<{ poIds: string[] }, {
    success: boolean;
    synced: number;
    failed: number;
    results: any[];
    errors: any[];
  }>(functions, 'syncMultiplePOsToBills');

  try {
    const result = await syncFunction({ poIds });
    return result.data;
  } catch (error: any) {
    console.error('[QBOSyncService] Error syncing multiple POs:', error);
    throw new Error(error.message || 'Failed to sync multiple Purchase Orders to QuickBooks');
  }
}

/**
 * Batch update all synced QBO bills to set DocNumber = PO number.
 */
export async function batchUpdateBillNumbers(): Promise<{
  success: boolean;
  updated: number;
  skipped: number;
  errors: number;
  message: string;
}> {
  const batchFunction = httpsCallable<Record<string, never>, {
    success: boolean;
    updated: number;
    skipped: number;
    errors: number;
    message: string;
  }>(functions, 'batchUpdateBillNumbers');

  try {
    const result = await batchFunction({});
    return result.data;
  } catch (error: any) {
    console.error('[QBOSyncService] Error batch updating bill numbers:', error);
    throw new Error(error.message || 'Failed to batch update bill numbers');
  }
}

// ============================================================================
// QUOTE → SALES ORDER SYNC
// ============================================================================

/**
 * Sync a Client Quote to QuickBooks Sales Order
 */
export async function syncQuoteToSalesOrder(quoteId: string): Promise<{
  success: boolean;
  action: string;
  qboSalesOrderId?: string;
  qboSalesOrderDocNumber?: string;
}> {
  const syncFunction = httpsCallable<{ quoteId: string }, {
    success: boolean;
    action: string;
    qboSalesOrderId?: string;
    qboSalesOrderDocNumber?: string;
  }>(functions, 'syncQuoteToSalesOrder');

  try {
    const result = await syncFunction({ quoteId });
    return result.data;
  } catch (error: any) {
    console.error('[QBOSyncService] Error syncing quote to sales order:', error);
    throw new Error(error.message || 'Failed to sync Quote to QuickBooks Sales Order');
  }
}

/**
 * Sync multiple Client Quotes to QuickBooks Sales Orders
 */
export async function syncMultipleQuotesToSalesOrders(quoteIds: string[]): Promise<{
  success: boolean;
  synced: number;
  failed: number;
  results: any[];
  errors: any[];
}> {
  const syncFunction = httpsCallable<{ quoteIds: string[] }, {
    success: boolean;
    synced: number;
    failed: number;
    results: any[];
    errors: any[];
  }>(functions, 'syncMultipleQuotesToSalesOrders');

  try {
    const result = await syncFunction({ quoteIds });
    return result.data;
  } catch (error: any) {
    console.error('[QBOSyncService] Error syncing multiple quotes:', error);
    throw new Error(error.message || 'Failed to sync multiple Quotes to QuickBooks');
  }
}

// ============================================================================
// MANUFACTURING ORDER → INVOICE SYNC
// ============================================================================

/**
 * Sync Manufacturing Order to QuickBooks Invoice (via Sales Order)
 */
export async function syncMOToInvoice(moId: string, quoteId: string): Promise<{
  success: boolean;
  action: string;
  qboInvoiceId?: string;
  qboInvoiceDocNumber?: string;
}> {
  const syncFunction = httpsCallable<{ moId: string; quoteId: string }, {
    success: boolean;
    action: string;
    qboInvoiceId?: string;
    qboInvoiceDocNumber?: string;
  }>(functions, 'syncMOToInvoice');

  try {
    const result = await syncFunction({ moId, quoteId });
    return result.data;
  } catch (error: any) {
    console.error('[QBOSyncService] Error syncing MO to invoice:', error);
    throw new Error(error.message || 'Failed to create Invoice in QuickBooks');
  }
}

/**
 * Sync Quote directly to QuickBooks Invoice (bypassing Sales Order)
 */
export async function syncQuoteToInvoice(quoteId: string): Promise<{
  success: boolean;
  action: string;
  qboInvoiceId?: string;
  qboInvoiceDocNumber?: string;
}> {
  const syncFunction = httpsCallable<{ quoteId: string }, {
    success: boolean;
    action: string;
    qboInvoiceId?: string;
    qboInvoiceDocNumber?: string;
  }>(functions, 'syncQuoteToInvoice');

  try {
    const result = await syncFunction({ quoteId });
    return result.data;
  } catch (error: any) {
    console.error('[QBOSyncService] Error syncing quote to invoice:', error);
    throw new Error(error.message || 'Failed to create Invoice in QuickBooks');
  }
}

// ============================================================================
// SALES ORDER → INVOICE SYNC (SO-CENTRIC)
// ============================================================================

/**
 * Sync Sales Order directly to QuickBooks Invoice (from SO scope items)
 */
export async function syncSOToInvoice(salesOrderId: string): Promise<{
  success: boolean;
  action: string;
  qboInvoiceId?: string;
  qboInvoiceDocNumber?: string;
}> {
  const syncFunction = httpsCallable<{ salesOrderId: string }, {
    success: boolean;
    action: string;
    qboInvoiceId?: string;
    qboInvoiceDocNumber?: string;
  }>(functions, 'syncSOToInvoice');

  try {
    const result = await syncFunction({ salesOrderId });
    return result.data;
  } catch (error: any) {
    console.error('[QBOSyncService] Error syncing SO to invoice:', error);
    throw new Error(error.message || 'Failed to create Invoice from Sales Order in QuickBooks');
  }
}

// ============================================================================
// MANUFACTURING ORDER → COGS JOURNAL ENTRY SYNC
// ============================================================================

/**
 * Sync Manufacturing Order to QuickBooks COGS Journal Entry
 */
export async function syncMOToCOGS(moId: string, cogsAccountId?: string): Promise<{
  success: boolean;
  action: string;
  qboJournalEntryId?: string;
  qboJournalEntryDocNumber?: string;
  cogsData?: any;
}> {
  const syncFunction = httpsCallable<{ moId: string; cogsAccountId?: string }, {
    success: boolean;
    action: string;
    qboJournalEntryId?: string;
    qboJournalEntryDocNumber?: string;
    cogsData?: any;
  }>(functions, 'syncMOToCOGS');

  try {
    const result = await syncFunction({ moId, cogsAccountId });
    return result.data;
  } catch (error: any) {
    console.error('[QBOSyncService] Error syncing MO to COGS:', error);
    throw new Error(error.message || 'Failed to create COGS Journal Entry in QuickBooks');
  }
}

/**
 * Sync multiple Manufacturing Orders to QuickBooks COGS Journal Entries
 */
export async function syncMultipleMOsToCOGS(moIds: string[]): Promise<{
  success: boolean;
  synced: number;
  failed: number;
  results: any[];
  errors: any[];
}> {
  const syncFunction = httpsCallable<{ moIds: string[] }, {
    success: boolean;
    synced: number;
    failed: number;
    results: any[];
    errors: any[];
  }>(functions, 'syncMultipleMOsToCOGS');

  try {
    const result = await syncFunction({ moIds });
    return result.data;
  } catch (error: any) {
    console.error('[QBOSyncService] Error syncing multiple MOs to COGS:', error);
    throw new Error(error.message || 'Failed to sync multiple MOs to QuickBooks COGS');
  }
}

// ============================================================================
// PAYMENT → QBO PAYMENT SYNC
// ============================================================================

/**
 * Sync a payment recorded on a Sales Order to QuickBooks as a Payment against the linked Invoice
 */
export async function syncPaymentToQBO(salesOrderId: string, paymentId: string): Promise<{
  success: boolean;
  action: string;
  qboPaymentId?: string;
}> {
  const syncFunction = httpsCallable<{ salesOrderId: string; paymentId: string }, {
    success: boolean;
    action: string;
    qboPaymentId?: string;
  }>(functions, 'syncPaymentToQBO');

  try {
    const result = await syncFunction({ salesOrderId, paymentId });
    return result.data;
  } catch (error: any) {
    console.error('[QBOSyncService] Error syncing payment to QBO:', error);
    throw new Error(error.message || 'Failed to sync payment to QuickBooks');
  }
}

// ============================================================================
// SUPPLIER → VENDOR SYNC
// ============================================================================

/**
 * Sync a Supplier to QuickBooks Vendor
 */
export async function syncSupplierToQuickBooks(supplierId: string): Promise<{
  success: boolean;
  action: string;
  qboId?: string;
}> {
  const syncFunction = httpsCallable<{ supplierId: string }, {
    success: boolean;
    action: string;
    qboId?: string;
  }>(functions, 'syncSupplierToQuickBooks');

  try {
    const result = await syncFunction({ supplierId });
    return result.data;
  } catch (error: any) {
    console.error('[QBOSyncService] Error syncing supplier to vendor:', error);
    throw new Error(error.message || 'Failed to sync Supplier to QuickBooks');
  }
}

/**
 * Sync all suppliers to QuickBooks Vendors
 */
export async function syncAllSuppliersToQuickBooks(): Promise<{
  success: boolean;
  synced: number;
  failed: number;
  results: any[];
  errors: any[];
}> {
  const syncFunction = httpsCallable<{}, {
    success: boolean;
    synced: number;
    failed: number;
    results: any[];
    errors: any[];
  }>(functions, 'syncAllSuppliersToQuickBooks');

  try {
    const result = await syncFunction({});
    return result.data;
  } catch (error: any) {
    console.error('[QBOSyncService] Error syncing all suppliers:', error);
    throw new Error(error.message || 'Failed to sync all Suppliers to QuickBooks');
  }
}

// ============================================================================
// QBO CONTACT PULL SYNC (Customers & Vendors FROM QBO)
// ============================================================================

export interface QBOContactSyncResult {
  created: number;
  updated: number;
  skipped: number;
  total: number;
}

/**
 * Pull customers and/or vendors from QuickBooks into ZeusOS
 */
export async function syncQBOContactsToFirestore(
  companyId: string,
  types?: ('customers' | 'vendors')[]
): Promise<{
  success: boolean;
  results: {
    customers?: QBOContactSyncResult;
    vendors?: QBOContactSyncResult;
  };
  errors?: Record<string, string>;
}> {
  const syncFunction = httpsCallable<
    { companyId: string; types?: string[] },
    {
      success: boolean;
      results: {
        customers?: QBOContactSyncResult;
        vendors?: QBOContactSyncResult;
      };
      errors?: Record<string, string>;
    }
  >(functions, 'syncQBOContactsToFirestore');

  try {
    const result = await syncFunction({ companyId, types });
    return result.data;
  } catch (error: any) {
    console.error('[QBOSyncService] Error syncing contacts from QBO:', error);
    throw new Error(error.message || 'Failed to sync contacts from QuickBooks');
  }
}

// ============================================================================
// QBO CUSTOM FIELD DETECTION
// ============================================================================

export interface QBOCustomFieldInfo {
  definitionId: string;
  name: string;
  type: string;
}

export interface DetectCustomFieldsResult {
  success: boolean;
  customFields: QBOCustomFieldInfo[];
  autoMapped: {
    poNumber?: string;
    docNumber?: string;
  };
  message: string;
  diagnostics?: string[];
}

/**
 * Detect QBO custom field DefinitionIds by querying existing transactions.
 * Auto-maps "PO No" and "Doc No" fields and saves them to QBO config.
 */
export async function detectQBOCustomFields(): Promise<DetectCustomFieldsResult> {
  const detectFunction = httpsCallable<
    Record<string, never>,
    DetectCustomFieldsResult
  >(functions, 'detectQBOCustomFields');

  try {
    const result = await detectFunction({});
    return result.data;
  } catch (error: any) {
    console.error('[QBOSyncService] Error detecting custom fields:', error);
    throw new Error(error.message || 'Failed to detect QuickBooks custom fields');
  }
}

/**
 * Probe QBO custom fields by attempting a write test on the most recent bill.
 * This discovers DefinitionIds that can't be found via read-only detection.
 */
export async function probeQBOCustomFields(): Promise<DetectCustomFieldsResult> {
  const probeFunction = httpsCallable<
    Record<string, never>,
    DetectCustomFieldsResult
  >(functions, 'probeQBOCustomFields');

  try {
    const result = await probeFunction({});
    return result.data;
  } catch (error: any) {
    console.error('[QBOSyncService] Error probing custom fields:', error);
    throw new Error(error.message || 'Failed to probe QuickBooks custom fields');
  }
}
