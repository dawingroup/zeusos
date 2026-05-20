/**
 * QuickBooks Bill Sync Trigger
 * Auto-creates Bills in QuickBooks when Purchase Orders are approved
 * Auto-updates Bills in QuickBooks when goods receipts are corrected
 */

const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const { createBillFromPO, updateBillFromPO } = require('../integrations/quickbooks/billSync');
const { TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET } = require('../integrations/quickbooks/auth');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * Trigger: Auto-sync PO to Bill when PO is approved
 */
exports.onPurchaseOrderApproved = onDocumentUpdated({
  document: 'purchaseOrders/{poId}',
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
}, async (event) => {
  const poId = event.params.poId;
  const beforeData = event.data.before.data();
  const afterData = event.data.after.data();

  console.log(`[BillSyncTrigger] PO ${poId} updated`);

  // 1. Check if status changed to 'approved'
  const statusChanged = beforeData.status !== afterData.status;
  const isNowApproved = afterData.status === 'approved';

  if (!statusChanged || !isNowApproved) {
    console.log(`[BillSyncTrigger] PO ${poId} status not changed to approved, skipping`);
    return;
  }

  console.log(`[BillSyncTrigger] PO ${poId} approved, checking sync eligibility`);

  // 2. Check if already synced
  if (afterData.qboBillId) {
    console.log(`[BillSyncTrigger] PO ${poId} already has bill ${afterData.qboBillId}, skipping`);
    return;
  }

  // 3. Check if QuickBooks is connected
  const qbDoc = await db.collection('integrations').doc('quickbooks').get();
  if (!qbDoc.exists || !qbDoc.data().isConnected) {
    console.log('[BillSyncTrigger] QuickBooks not connected, skipping auto-sync');
    return;
  }

  // 4. Check if account mapping is configured
  const configDoc = await db.collection('integrations').doc('quickbooks_config').get();
  if (!configDoc.exists || !configDoc.data().isConfigured) {
    console.log('[BillSyncTrigger] QuickBooks config not complete, skipping auto-sync');
    return;
  }

  // 5. Check if auto-create bills feature is enabled
  const config = configDoc.data();
  if (config.features?.autoCreateBills === false) {
    console.log('[BillSyncTrigger] Auto-create bills feature disabled, skipping');
    return;
  }

  // 6. Attempt to create bill
  try {
    console.log(`[BillSyncTrigger] Creating bill for approved PO ${poId}`);
    const result = await createBillFromPO(poId);

    console.log(`[BillSyncTrigger] Successfully created bill for PO ${poId}:`, result);

    // Emit business event
    try {
      await db.collection('business_events').add({
        type: 'bill_created_in_quickbooks',
        entityType: 'purchaseOrder',
        entityId: poId,
        data: {
          poNumber: afterData.poNumber,
          supplierName: afterData.supplierName,
          qboBillId: result.qboBillId,
          qboBillDocNumber: result.qboBillDocNumber,
          totalAmount: afterData.totals?.grandTotal,
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (eventError) {
      console.error('[BillSyncTrigger] Failed to emit business event:', eventError);
      // Don't throw - bill was created successfully
    }
  } catch (error) {
    console.error(`[BillSyncTrigger] Failed to create bill for PO ${poId}:`, error);

    // Emit error event
    try {
      await db.collection('business_events').add({
        type: 'bill_sync_error',
        entityType: 'purchaseOrder',
        entityId: poId,
        data: {
          poNumber: afterData.poNumber,
          supplierName: afterData.supplierName,
          error: error.message,
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (eventError) {
      console.error('[BillSyncTrigger] Failed to emit error event:', eventError);
    }

    // Don't throw - allow PO approval to succeed even if sync fails
    // User can manually retry from UI
  }
});

/**
 * Trigger: Auto-update QBO Bill when a goods receipt is corrected.
 * Fires when qboSyncStatus changes to 'correction-pending' and a qboBillId exists.
 */
exports.onReceiptCorrectionBillSync = onDocumentUpdated({
  document: 'purchaseOrders/{poId}',
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
}, async (event) => {
  const poId = event.params.poId;
  const beforeData = event.data.before.data();
  const afterData = event.data.after.data();

  // Only react to qboSyncStatus changing to 'correction-pending'
  const syncStatusChanged = beforeData.qboSyncStatus !== afterData.qboSyncStatus;
  const isCorrectionPending = afterData.qboSyncStatus === 'correction-pending';

  if (!syncStatusChanged || !isCorrectionPending) {
    return;
  }

  // Must already have a QBO Bill to update
  if (!afterData.qboBillId) {
    console.log(`[BillSyncTrigger] PO ${poId} correction-pending but no qboBillId, skipping`);
    return;
  }

  console.log(`[BillSyncTrigger] PO ${poId} receipt corrected, updating QBO Bill ${afterData.qboBillId}`);

  // Check if QuickBooks is connected
  const qbDoc = await db.collection('integrations').doc('quickbooks').get();
  if (!qbDoc.exists || !qbDoc.data().isConnected) {
    console.log('[BillSyncTrigger] QuickBooks not connected, skipping auto-correction sync');
    return;
  }

  // Check if auto-update feature is enabled
  const configDoc = await db.collection('integrations').doc('quickbooks_config').get();
  if (!configDoc.exists || !configDoc.data().isConfigured) {
    console.log('[BillSyncTrigger] QuickBooks config not complete, skipping');
    return;
  }

  const config = configDoc.data();
  if (config.features?.autoUpdateBillsOnCorrection === false) {
    console.log('[BillSyncTrigger] Auto-update bills on correction disabled, skipping');
    return;
  }

  // Attempt to update the bill
  try {
    const result = await updateBillFromPO(poId);

    console.log(`[BillSyncTrigger] Successfully updated bill for PO ${poId}:`, result);

    // Emit business event
    try {
      await db.collection('business_events').add({
        type: 'bill_updated_in_quickbooks',
        entityType: 'purchaseOrder',
        entityId: poId,
        data: {
          poNumber: afterData.poNumber,
          supplierName: afterData.supplierName,
          qboBillId: result.qboBillId,
          qboBillDocNumber: result.qboBillDocNumber,
          trigger: 'receipt_correction',
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (eventError) {
      console.error('[BillSyncTrigger] Failed to emit correction event:', eventError);
    }
  } catch (error) {
    console.error(`[BillSyncTrigger] Failed to update bill for PO ${poId}:`, error);

    // Emit error event
    try {
      await db.collection('business_events').add({
        type: 'bill_correction_sync_error',
        entityType: 'purchaseOrder',
        entityId: poId,
        data: {
          poNumber: afterData.poNumber,
          supplierName: afterData.supplierName,
          qboBillId: afterData.qboBillId,
          error: error.message,
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (eventError) {
      console.error('[BillSyncTrigger] Failed to emit error event:', eventError);
    }

    // Don't throw - user can manually retry from UI
  }
});
