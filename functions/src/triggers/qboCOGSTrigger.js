/**
 * QuickBooks COGS Sync Trigger
 * Auto-creates COGS Journal Entries when Manufacturing Orders complete
 */

const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const { createCOGSJournalEntry } = require('../integrations/quickbooks/journalEntrySync');
const { TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET } = require('../integrations/quickbooks/auth');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * Trigger: Auto-record COGS when Manufacturing Order is completed
 *
 * This trigger runs alongside the invoice trigger to complete both:
 * 1. Revenue recognition (Invoice)
 * 2. Cost recognition (COGS Journal Entry)
 */
exports.onManufacturingOrderCompletedCOGS = onDocumentUpdated({
  document: 'manufacturingOrders/{moId}',
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
}, async (event) => {
  const moId = event.params.moId;
  const beforeData = event.data.before.data();
  const afterData = event.data.after.data();

  console.log(`[COGSTrigger] MO ${moId} updated`);

  // 1. Check if status changed to 'completed'
  const statusChanged = beforeData.status !== afterData.status;
  const isNowCompleted = afterData.status === 'completed';

  if (!statusChanged || !isNowCompleted) {
    console.log(`[COGSTrigger] MO ${moId} status not changed to completed, skipping`);
    return;
  }

  console.log(`[COGSTrigger] MO ${moId} completed, checking COGS eligibility`);

  // Helper to record skip reason on MO document
  const recordSkip = async (reason) => {
    try {
      await db.collection('manufacturingOrders').doc(moId).update({
        'qboCogsSyncStatus': 'skipped',
        'qboCogsSyncSkipReason': reason,
        'qboCogsSyncSkippedAt': admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) { console.warn('[COGSTrigger] Failed to record skip reason:', e.message); }
  };

  // 2. Check if COGS already recorded
  if (afterData.qboJournalEntryId) {
    console.log(`[COGSTrigger] MO ${moId} already has journal entry ${afterData.qboJournalEntryId}, skipping`);
    return;
  }

  // 3. Check if QuickBooks is connected
  const qbDoc = await db.collection('integrations').doc('quickbooks').get();
  if (!qbDoc.exists || !qbDoc.data().isConnected) {
    console.log('[COGSTrigger] QuickBooks not connected, skipping auto-COGS');
    await recordSkip('QuickBooks not connected');
    return;
  }

  // 4. Check if account mapping is configured
  const configDoc = await db.collection('integrations').doc('quickbooks_config').get();
  if (!configDoc.exists || !configDoc.data().isConfigured) {
    console.log('[COGSTrigger] QuickBooks config not complete, skipping auto-COGS');
    await recordSkip('QuickBooks account mapping not configured');
    return;
  }

  // 5. Check if auto-record COGS feature is enabled
  const config = configDoc.data();
  if (config.features?.autoRecordCOGS === false) {
    console.log('[COGSTrigger] Auto-record COGS feature disabled, skipping');
    await recordSkip('Auto-record COGS feature disabled');
    return;
  }

  // 6. Validate that material consumptions have cost data
  if (!afterData.materialConsumptions || afterData.materialConsumptions.length === 0) {
    console.log(`[COGSTrigger] MO ${moId} has no material consumptions, skipping COGS`);
    await recordSkip('No material consumptions recorded');
    return;
  }

  // Check if consumptions have cost data
  const hasCostData = afterData.materialConsumptions.some(
    c => c.unitCost !== undefined || c.totalCost !== undefined
  );

  if (!hasCostData) {
    console.warn(`[COGSTrigger] MO ${moId} material consumptions missing cost data, cannot calculate COGS`);
    await recordSkip('Material consumptions missing cost data');

    // Emit warning event
    try {
      await db.collection('business_events').add({
        type: 'cogs_missing_cost_data',
        entityType: 'manufacturingOrder',
        entityId: moId,
        data: {
          moNumber: afterData.moNumber,
          message: 'Material consumptions missing cost data - cannot record COGS',
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (eventError) {
      console.error('[COGSTrigger] Failed to emit warning event:', eventError);
    }

    return;
  }

  // 7. Attempt to create COGS journal entry
  try {
    console.log(`[COGSTrigger] Recording COGS for completed MO ${moId}`);
    const result = await createCOGSJournalEntry(moId);

    console.log(`[COGSTrigger] Successfully recorded COGS for MO ${moId}:`, result);

    // Emit business event
    try {
      await db.collection('business_events').add({
        type: 'cogs_recorded_in_quickbooks',
        entityType: 'manufacturingOrder',
        entityId: moId,
        data: {
          moNumber: afterData.moNumber,
          projectId: afterData.projectId,
          qboJournalEntryId: result.qboJournalEntryId,
          qboJournalEntryDocNumber: result.qboJournalEntryDocNumber,
          totalCOGS: result.cogsData?.totalCOGS,
          materialCost: result.cogsData?.materialCost,
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (eventError) {
      console.error('[COGSTrigger] Failed to emit business event:', eventError);
      // Don't throw - COGS was recorded successfully
    }
  } catch (error) {
    console.error(`[COGSTrigger] Failed to record COGS for MO ${moId}:`, error);

    // Record error on MO
    try {
      await db.collection('manufacturingOrders').doc(moId).update({
        'qboCogsSyncStatus': 'error',
        'qboCogsSyncError': error.message,
        'qboCogsSyncErrorAt': admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (e) { console.warn('[COGSTrigger] Failed to record error status:', e.message); }

    // Emit error event
    try {
      await db.collection('business_events').add({
        type: 'cogs_sync_error',
        entityType: 'manufacturingOrder',
        entityId: moId,
        data: {
          moNumber: afterData.moNumber,
          projectId: afterData.projectId,
          error: error.message,
        },
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (eventError) {
      console.error('[COGSTrigger] Failed to emit error event:', eventError);
    }

    // Don't throw - allow MO completion to succeed even if COGS recording fails
    // User can manually retry from UI
  }
});
