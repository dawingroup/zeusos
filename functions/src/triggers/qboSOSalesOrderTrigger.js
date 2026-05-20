/**
 * QuickBooks Sales Order Sync Trigger (SO-centric)
 * Auto-creates Sales Orders in QuickBooks when a DawinOS Sales Order
 * transitions to 'scope_frozen' — scope is confirmed and items are finalized.
 *
 * Reuses the same createSalesOrderFromQuote function used by the quote-approval
 * trigger and MO closeout, ensuring consistent sync behavior everywhere.
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
 * Trigger: Auto-sync Sales Order to QBO when SO scope is frozen
 */
exports.onSalesOrderScopeFrozen = onDocumentUpdated({
  document: 'salesOrders/{orderId}',
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
}, async (event) => {
  const orderId = event.params.orderId;
  const beforeData = event.data.before.data();
  const afterData = event.data.after.data();

  // 1. Check if status changed to 'scope_frozen'
  const statusChanged = beforeData.status !== afterData.status;
  const isNowScopeFrozen = afterData.status === 'scope_frozen';

  if (!statusChanged || !isNowScopeFrozen) {
    return;
  }

  console.log(`[SOSalesOrderTrigger] SO ${orderId} scope frozen, checking sync eligibility`);

  // 2. Check if already synced
  if (afterData.qboSalesOrderId) {
    console.log(`[SOSalesOrderTrigger] SO ${orderId} already synced to QBO ${afterData.qboSalesOrderId}, skipping`);
    return;
  }

  // 3. Check the SO has a linked quote
  if (!afterData.quoteId) {
    console.log(`[SOSalesOrderTrigger] SO ${orderId} has no quoteId, skipping`);
    return;
  }

  // 4. Check if QuickBooks is connected
  const qbDoc = await db.collection('integrations').doc('quickbooks').get();
  if (!qbDoc.exists || !qbDoc.data().isConnected) {
    console.log('[SOSalesOrderTrigger] QuickBooks not connected, skipping auto-sync');
    return;
  }

  // 5. Check if account mapping is configured
  const configDoc = await db.collection('integrations').doc('quickbooks_config').get();
  if (!configDoc.exists || !configDoc.data().isConfigured) {
    console.log('[SOSalesOrderTrigger] QuickBooks config not complete, skipping auto-sync');
    return;
  }

  // 6. Check if auto-create sales orders feature is enabled
  const config = configDoc.data();
  if (config.features?.autoCreateSalesOrders === false) {
    console.log('[SOSalesOrderTrigger] Auto-create sales orders feature disabled, skipping');
    return;
  }

  // 7. Attempt to create sales order using the same function as quote-approval trigger
  try {
    console.log(`[SOSalesOrderTrigger] Syncing SO ${orderId} (quote: ${afterData.quoteId}) to QBO`);
    const result = await createSalesOrderFromQuote(afterData.quoteId);

    console.log(`[SOSalesOrderTrigger] Successfully synced SO ${orderId}:`, result);

    // Emit business event
    try {
      await db.collection('business_events').add({
        type: 'sales_order_created_in_quickbooks',
        entityType: 'salesOrder',
        entityId: orderId,
        data: {
          orderNumber: afterData.orderNumber,
          customerName: afterData.customerName,
          quoteId: afterData.quoteId,
          qboSalesOrderId: result.qboSalesOrderId,
          qboSalesOrderDocNumber: result.qboSalesOrderDocNumber,
          currentAmount: afterData.currentAmount,
          trigger: 'scope_frozen',
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (eventError) {
      console.error('[SOSalesOrderTrigger] Failed to emit business event:', eventError);
    }
  } catch (error) {
    console.error(`[SOSalesOrderTrigger] Failed to sync SO ${orderId}:`, error);

    // Emit error event
    try {
      await db.collection('business_events').add({
        type: 'sales_order_sync_error',
        entityType: 'salesOrder',
        entityId: orderId,
        data: {
          orderNumber: afterData.orderNumber,
          customerName: afterData.customerName,
          quoteId: afterData.quoteId,
          error: error.message,
          trigger: 'scope_frozen',
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (eventError) {
      console.error('[SOSalesOrderTrigger] Failed to emit error event:', eventError);
    }

    // Don't throw — allow SO status transition to succeed even if sync fails
    // User can manually retry from SO detail page
  }
});
