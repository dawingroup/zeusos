/**
 * QuickBooks Invoice Sync Trigger
 * Auto-creates Invoices in QuickBooks when Manufacturing Orders complete
 */

const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const { createInvoiceFromSalesOrder, createInvoiceFromQuote } = require('../integrations/quickbooks/invoiceSync');
const { TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET } = require('../integrations/quickbooks/auth');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * Trigger: Auto-create Invoice when Manufacturing Order is completed
 */
exports.onManufacturingOrderCompleted = onDocumentUpdated({
  document: 'manufacturingOrders/{moId}',
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
}, async (event) => {
  const moId = event.params.moId;
  const beforeData = event.data.before.data();
  const afterData = event.data.after.data();

  console.log(`[InvoiceTrigger] MO ${moId} updated`);

  // 1. Check if status changed to 'completed'
  const statusChanged = beforeData.status !== afterData.status;
  const isNowCompleted = afterData.status === 'completed';

  if (!statusChanged || !isNowCompleted) {
    console.log(`[InvoiceTrigger] MO ${moId} status not changed to completed, skipping`);
    return;
  }

  console.log(`[InvoiceTrigger] MO ${moId} completed, checking invoice eligibility`);

  // Helper to record skip reason on MO document
  const recordSkip = async (reason) => {
    try {
      await db.collection('manufacturingOrders').doc(moId).update({
        'qboInvoiceSyncStatus': 'skipped',
        'qboInvoiceSyncSkipReason': reason,
        'qboInvoiceSyncSkippedAt': admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) { console.warn('[InvoiceTrigger] Failed to record skip reason:', e.message); }
  };

  // 2. Check if MO has a linked project
  if (!afterData.projectId) {
    console.log(`[InvoiceTrigger] MO ${moId} has no linked projectId, skipping invoice creation`);
    await recordSkip('No linked project');
    return;
  }

  // 3. Find the approved quote for this project
  let quote;
  try {
    const quotesSnapshot = await db.collection('clientQuotes')
      .where('projectId', '==', afterData.projectId)
      .where('status', '==', 'approved')
      .limit(1)
      .get();

    if (quotesSnapshot.empty) {
      console.log(`[InvoiceTrigger] No approved quote found for project ${afterData.projectId}, skipping`);
      await recordSkip('No approved quote for project');
      return;
    }

    quote = { id: quotesSnapshot.docs[0].id, ...quotesSnapshot.docs[0].data() };
    console.log(`[InvoiceTrigger] Found approved quote ${quote.id} for project ${afterData.projectId}`);
  } catch (error) {
    console.error(`[InvoiceTrigger] Error fetching quote for project ${afterData.projectId}:`, error);
    return;
  }

  // 4. Check if invoice already created
  if (quote.qboInvoiceId) {
    console.log(`[InvoiceTrigger] Quote ${quote.id} already has invoice ${quote.qboInvoiceId}, skipping`);
    return;
  }

  // 5. Check if Sales Order exists — if not, create invoice directly from quote
  const hasSalesOrder = !!quote.qboSalesOrderId;

  // 6. Check if QuickBooks is connected
  const qbDoc = await db.collection('integrations').doc('quickbooks').get();
  if (!qbDoc.exists || !qbDoc.data().isConnected) {
    console.log('[InvoiceTrigger] QuickBooks not connected, skipping auto-invoice');
    await recordSkip('QuickBooks not connected');
    return;
  }

  // 7. Check if account mapping is configured
  const configDoc = await db.collection('integrations').doc('quickbooks_config').get();
  if (!configDoc.exists || !configDoc.data().isConfigured) {
    console.log('[InvoiceTrigger] QuickBooks config not complete, skipping auto-invoice');
    await recordSkip('QuickBooks account mapping not configured');
    return;
  }

  // 8. Check if auto-create invoices feature is enabled
  const config = configDoc.data();
  if (config.features?.autoCreateInvoices === false) {
    console.log('[InvoiceTrigger] Auto-create invoices feature disabled, skipping');
    await recordSkip('Auto-create invoices feature disabled');
    return;
  }

  // 9. Attempt to create invoice
  try {
    let result;
    if (hasSalesOrder) {
      console.log(`[InvoiceTrigger] Creating invoice from Sales Order for MO ${moId} and quote ${quote.id}`);
      result = await createInvoiceFromSalesOrder(moId, quote.id);
    } else {
      console.log(`[InvoiceTrigger] No Sales Order — creating invoice directly from quote ${quote.id}`);
      result = await createInvoiceFromQuote(quote.id);
    }

    console.log(`[InvoiceTrigger] Successfully created invoice for MO ${moId}:`, result);

    // Emit business event
    try {
      await db.collection('business_events').add({
        type: 'invoice_created_in_quickbooks',
        entityType: 'manufacturingOrder',
        entityId: moId,
        data: {
          moNumber: afterData.moNumber,
          projectId: afterData.projectId,
          quoteId: quote.id,
          quoteNumber: quote.quoteNumber,
          customerName: quote.customerName,
          qboInvoiceId: result.qboInvoiceId,
          qboInvoiceDocNumber: result.qboInvoiceDocNumber,
          totalAmount: quote.total,
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (eventError) {
      console.error('[InvoiceTrigger] Failed to emit business event:', eventError);
      // Don't throw - invoice was created successfully
    }
  } catch (error) {
    console.error(`[InvoiceTrigger] Failed to create invoice for MO ${moId}:`, error);

    // Record error on MO
    try {
      await db.collection('manufacturingOrders').doc(moId).update({
        'qboInvoiceSyncStatus': 'error',
        'qboInvoiceSyncError': error.message,
        'qboInvoiceSyncErrorAt': admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) { console.warn('[InvoiceTrigger] Failed to record error status:', e.message); }

    // Emit error event
    try {
      await db.collection('business_events').add({
        type: 'invoice_sync_error',
        entityType: 'manufacturingOrder',
        entityId: moId,
        data: {
          moNumber: afterData.moNumber,
          projectId: afterData.projectId,
          quoteId: quote.id,
          quoteNumber: quote.quoteNumber,
          error: error.message,
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (eventError) {
      console.error('[InvoiceTrigger] Failed to emit error event:', eventError);
    }

    // Don't throw - allow MO completion to succeed even if invoice creation fails
    // User can manually retry from UI
  }
});
