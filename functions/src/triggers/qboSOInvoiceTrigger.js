/**
 * QuickBooks SO Invoice Sync Trigger
 * Auto-creates Invoices in QuickBooks when Sales Orders are released to production
 */

const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const { createInvoiceFromSODocument } = require('../integrations/quickbooks/invoiceSync');
const { TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET } = require('../integrations/quickbooks/auth');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * Trigger: Auto-create Invoice when Sales Order status changes to 'released_to_production'
 */
exports.onSalesOrderReleasedInvoice = onDocumentUpdated({
  document: 'salesOrders/{orderId}',
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
}, async (event) => {
  const orderId = event.params.orderId;
  const beforeData = event.data.before.data();
  const afterData = event.data.after.data();

  // 1. Check if status changed to 'released_to_production'
  const statusChanged = beforeData.status !== afterData.status;
  const isNowReleased = afterData.status === 'released_to_production';

  if (!statusChanged || !isNowReleased) {
    return;
  }

  console.log(`[SOInvoiceTrigger] Sales Order ${orderId} released to production, checking sync eligibility`);

  // 2. Check if already synced (idempotency)
  if (afterData.qboInvoiceId) {
    console.log(`[SOInvoiceTrigger] SO ${orderId} already has invoice ${afterData.qboInvoiceId}, skipping`);
    return;
  }

  // 3. Check if QuickBooks is connected
  const qbDoc = await db.collection('integrations').doc('quickbooks').get();
  if (!qbDoc.exists || !qbDoc.data().isConnected) {
    console.log('[SOInvoiceTrigger] QuickBooks not connected, skipping auto-sync');
    return;
  }

  // 4. Check if account mapping is configured
  const configDoc = await db.collection('integrations').doc('quickbooks_config').get();
  if (!configDoc.exists || !configDoc.data().isConfigured) {
    console.log('[SOInvoiceTrigger] QuickBooks config not complete, skipping auto-sync');
    return;
  }

  // 5. Check if auto-create invoices feature is enabled
  const config = configDoc.data();
  if (config.features?.autoCreateInvoices === false) {
    console.log('[SOInvoiceTrigger] Auto-create invoices feature disabled, skipping');
    return;
  }

  // 6. Attempt to create invoice
  try {
    console.log(`[SOInvoiceTrigger] Creating invoice for released SO ${orderId}`);
    const result = await createInvoiceFromSODocument(orderId);

    console.log(`[SOInvoiceTrigger] Successfully created invoice for SO ${orderId}:`, result);

    // Emit business event
    try {
      await db.collection('business_events').add({
        type: 'so_invoice_created_in_quickbooks',
        entityType: 'salesOrder',
        entityId: orderId,
        data: {
          orderNumber: afterData.orderNumber,
          customerName: afterData.customerName,
          currentAmount: afterData.currentAmount,
          qboInvoiceId: result.qboInvoiceId,
          qboInvoiceDocNumber: result.qboInvoiceDocNumber,
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (eventError) {
      console.error('[SOInvoiceTrigger] Failed to emit business event:', eventError);
      // Don't throw - invoice was created successfully
    }
  } catch (error) {
    console.error(`[SOInvoiceTrigger] Failed to create invoice for SO ${orderId}:`, error);

    // Emit error event
    try {
      await db.collection('business_events').add({
        type: 'so_invoice_sync_error',
        entityType: 'salesOrder',
        entityId: orderId,
        data: {
          orderNumber: afterData.orderNumber,
          customerName: afterData.customerName,
          error: error.message,
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (eventError) {
      console.error('[SOInvoiceTrigger] Failed to emit error event:', eventError);
    }

    // Don't throw - allow SO status transition to succeed even if sync fails
    // User can manually retry from UI
  }
});
