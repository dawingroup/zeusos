/**
 * QuickBooks Sales Order Sync Trigger
 * Auto-creates Sales Orders in QuickBooks when Client Quotes are approved
 */

const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const { createSalesOrderFromQuote } = require('../integrations/quickbooks/salesOrderSync');
const { TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET } = require('../integrations/quickbooks/auth');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * Trigger: Auto-sync Quote to Sales Order when quote is approved
 */
exports.onClientQuoteApproved = onDocumentUpdated({
  document: 'clientQuotes/{quoteId}',
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
}, async (event) => {
  const quoteId = event.params.quoteId;
  const beforeData = event.data.before.data();
  const afterData = event.data.after.data();

  console.log(`[SalesOrderTrigger] Quote ${quoteId} updated`);

  // 1. Check if status changed to 'approved'
  const statusChanged = beforeData.status !== afterData.status;
  const isNowApproved = afterData.status === 'approved';

  if (!statusChanged || !isNowApproved) {
    console.log(`[SalesOrderTrigger] Quote ${quoteId} status not changed to approved, skipping`);
    return;
  }

  console.log(`[SalesOrderTrigger] Quote ${quoteId} approved, checking sync eligibility`);

  // 2. Check if already synced
  if (afterData.qboSalesOrderId) {
    console.log(`[SalesOrderTrigger] Quote ${quoteId} already has sales order ${afterData.qboSalesOrderId}, skipping`);
    return;
  }

  // 3. Check if QuickBooks is connected
  const qbDoc = await db.collection('integrations').doc('quickbooks').get();
  if (!qbDoc.exists || !qbDoc.data().isConnected) {
    console.log('[SalesOrderTrigger] QuickBooks not connected, skipping auto-sync');
    return;
  }

  // 4. Check if account mapping is configured
  const configDoc = await db.collection('integrations').doc('quickbooks_config').get();
  if (!configDoc.exists || !configDoc.data().isConfigured) {
    console.log('[SalesOrderTrigger] QuickBooks config not complete, skipping auto-sync');
    return;
  }

  // 5. Check if auto-create sales orders feature is enabled
  const config = configDoc.data();
  if (config.features?.autoCreateSalesOrders === false) {
    console.log('[SalesOrderTrigger] Auto-create sales orders feature disabled, skipping');
    return;
  }

  // 6. Attempt to create sales order
  try {
    console.log(`[SalesOrderTrigger] Creating sales order for approved quote ${quoteId}`);
    const result = await createSalesOrderFromQuote(quoteId);

    console.log(`[SalesOrderTrigger] Successfully created sales order for quote ${quoteId}:`, result);

    // Emit business event
    try {
      await db.collection('business_events').add({
        type: 'sales_order_created_in_quickbooks',
        entityType: 'clientQuote',
        entityId: quoteId,
        data: {
          quoteNumber: afterData.quoteNumber,
          customerName: afterData.customerName,
          projectName: afterData.projectName,
          qboSalesOrderId: result.qboSalesOrderId,
          qboSalesOrderDocNumber: result.qboSalesOrderDocNumber,
          totalAmount: afterData.total,
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (eventError) {
      console.error('[SalesOrderTrigger] Failed to emit business event:', eventError);
      // Don't throw - sales order was created successfully
    }
  } catch (error) {
    console.error(`[SalesOrderTrigger] Failed to create sales order for quote ${quoteId}:`, error);

    // Emit error event
    try {
      await db.collection('business_events').add({
        type: 'sales_order_sync_error',
        entityType: 'clientQuote',
        entityId: quoteId,
        data: {
          quoteNumber: afterData.quoteNumber,
          customerName: afterData.customerName,
          projectName: afterData.projectName,
          error: error.message,
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (eventError) {
      console.error('[SalesOrderTrigger] Failed to emit error event:', eventError);
    }

    // Don't throw - allow quote approval to succeed even if sync fails
    // User can manually retry from UI
  }
});
