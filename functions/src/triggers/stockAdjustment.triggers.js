/**
 * Stock Adjustment Cloud Functions
 * - Auto-number generation on create
 * - Status change handler (auto-approval, stock updates, QBO sync)
 */

const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');
const { TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET } = require('../integrations/quickbooks/auth');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

// ── Default auto-approval settings ──────────────────────────────────────────

const DEFAULT_SETTINGS = {
  autoApprovalEnabled: true,
  autoApprovalThreshold: 500000, // UGX 500,000
  autoApprovalTypes: ['physical_count_variance', 'damage_spoilage', 'shrinkage_loss', 'offcut_adjustment'],
  requireAttachmentForDamage: true,
  numberSequencePrefix: 'ADJ',
  numberSequenceYear: new Date().getFullYear(),
  numberSequenceCounter: 0,
};

// ── Number Generation ────────────────────────────────────────────────────────

/**
 * Generate adjustment number on document create.
 * Uses Firestore transaction for atomic counter increment.
 * Format: ADJ-YYYY-NNNN
 */
exports.generateAdjustmentNumber = onDocumentCreated({
  document: 'stock_adjustments/{adjustmentId}',
}, async (event) => {
  const adjustmentId = event.params.adjustmentId;
  const data = event.data.data();

  // Skip if already numbered (e.g. from migration)
  if (data.adjustmentNumber) {
    console.log(`[StockAdj] Adjustment ${adjustmentId} already numbered: ${data.adjustmentNumber}`);
    return;
  }

  const orgId = data.organizationId || 'dawinos';
  const settingsRef = db.collection('organization_settings').doc(orgId);
  const adjustmentRef = db.collection('stock_adjustments').doc(adjustmentId);

  try {
    const adjustmentNumber = await db.runTransaction(async (txn) => {
      const settingsDoc = await txn.get(settingsRef);
      const settings = settingsDoc.exists
        ? (settingsDoc.data().inventorySettings?.stockAdjustment || DEFAULT_SETTINGS)
        : DEFAULT_SETTINGS;

      const currentYear = new Date().getFullYear();
      let counter = settings.numberSequenceCounter || 0;
      let year = settings.numberSequenceYear || currentYear;

      // Reset counter if year changed
      if (year !== currentYear) {
        counter = 0;
        year = currentYear;
      }

      counter += 1;

      const prefix = settings.numberSequencePrefix || 'ADJ';
      const number = `${prefix}-${year}-${String(counter).padStart(4, '0')}`;

      // Update settings counter
      txn.set(settingsRef, {
        inventorySettings: {
          stockAdjustment: {
            ...settings,
            numberSequenceYear: year,
            numberSequenceCounter: counter,
          },
        },
      }, { merge: true });

      // Update adjustment document
      txn.update(adjustmentRef, { adjustmentNumber: number });

      return number;
    });

    console.log(`[StockAdj] Generated number ${adjustmentNumber} for ${adjustmentId}`);
  } catch (err) {
    console.error(`[StockAdj] Failed to generate number for ${adjustmentId}:`, err);
  }
});

// ── Status Change Handler ────────────────────────────────────────────────────

/**
 * Handle status transitions for stock adjustments.
 * - submitted: run auto-approval check
 * - approved: update inventory items, queue QBO sync
 * - rejected: log for audit
 * - cancelled: validate not previously approved
 */
exports.onStockAdjustmentStatusChange = onDocumentUpdated({
  document: 'stock_adjustments/{adjustmentId}',
  secrets: [TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
}, async (event) => {
  const adjustmentId = event.params.adjustmentId;
  const before = event.data.before.data();
  const after = event.data.after.data();

  // Only react to status changes
  if (before.status === after.status) return;

  const oldStatus = before.status;
  const newStatus = after.status;

  console.log(`[StockAdj] ${adjustmentId}: status ${oldStatus} → ${newStatus}`);

  // ── SUBMITTED ──────────────────────────────────────────────────────
  if (newStatus === 'submitted') {
    await handleSubmitted(adjustmentId, after);
    return;
  }

  // ── APPROVED ───────────────────────────────────────────────────────
  if (newStatus === 'approved') {
    await handleApproved(adjustmentId, after);
    return;
  }

  // ── CANCELLED ──────────────────────────────────────────────────────
  if (newStatus === 'cancelled') {
    if (oldStatus === 'approved') {
      console.error(`[StockAdj] BLOCKED: Cannot cancel approved adjustment ${adjustmentId}`);
      // Revert status
      await db.collection('stock_adjustments').doc(adjustmentId).update({
        status: 'approved',
      });
      return;
    }
    console.log(`[StockAdj] Adjustment ${adjustmentId} cancelled`);
    return;
  }

  // ── REJECTED ───────────────────────────────────────────────────────
  if (newStatus === 'rejected') {
    console.log(`[StockAdj] Adjustment ${adjustmentId} rejected: ${after.rejectionReason}`);

    // Emit business event
    await db.collection('business_events').add({
      type: 'stock_adjustment_rejected',
      entityType: 'stock_adjustment',
      entityId: adjustmentId,
      data: {
        adjustmentNumber: after.adjustmentNumber,
        adjustmentType: after.adjustmentType,
        rejectionReason: after.rejectionReason,
        rejectedBy: after.rejectedBy,
      },
      timestamp: FieldValue.serverTimestamp(),
    });
    return;
  }
});

// ── Handler: Submitted ───────────────────────────────────────────────────────

async function handleSubmitted(adjustmentId, data) {
  const orgId = data.organizationId || 'dawinos';

  // Fetch auto-approval settings
  const settingsDoc = await db.collection('organization_settings').doc(orgId).get();
  const settings = settingsDoc.exists
    ? (settingsDoc.data().inventorySettings?.stockAdjustment || DEFAULT_SETTINGS)
    : DEFAULT_SETTINGS;

  // Check auto-approval conditions
  const canAutoApprove = checkAutoApproval(data, settings);

  if (canAutoApprove) {
    console.log(`[StockAdj] Auto-approving adjustment ${adjustmentId} (below threshold, eligible type)`);
    await db.collection('stock_adjustments').doc(adjustmentId).update({
      status: 'approved',
      isAutoApproved: true,
      approvedBy: 'system:auto-approval',
      approvedAt: FieldValue.serverTimestamp(),
    });
    // The approved handler will fire from the status change above
  } else {
    console.log(`[StockAdj] Adjustment ${adjustmentId} requires manual approval`);
  }
}

function checkAutoApproval(data, settings) {
  if (!settings.autoApprovalEnabled) return false;

  // Check type eligibility
  if (!settings.autoApprovalTypes.includes(data.adjustmentType)) return false;

  // Check value threshold
  if (Math.abs(data.netValueImpact || 0) > settings.autoApprovalThreshold) return false;

  // Check attachment requirement for damage/spoilage
  if (
    data.adjustmentType === 'damage_spoilage' &&
    settings.requireAttachmentForDamage &&
    (!data.attachments || data.attachments.length === 0)
  ) {
    return false;
  }

  return true;
}

// ── Handler: Approved ────────────────────────────────────────────────────────

async function handleApproved(adjustmentId, data) {
  console.log(`[StockAdj] Processing approved adjustment ${adjustmentId}`);

  // 1. Update inventory item stock levels + stockLevels collection
  const lineItems = data.lineItems || [];
  const batch = db.batch();
  const updatedItemIds = new Set();

  for (const line of lineItems) {
    if (!line.itemId || line.quantity === 0) continue;

    const itemRef = db.collection('inventoryItems').doc(line.itemId);

    // Calculate the quantity change
    const qtyChange = line.direction === 'increase' ? line.quantity : -line.quantity;

    // Update BOTH stockOnHand (legacy) and inventory.inStock (current)
    batch.update(itemRef, {
      stockOnHand: FieldValue.increment(qtyChange),
      'inventory.inStock': FieldValue.increment(qtyChange),
      lastAdjustmentId: adjustmentId,
      updatedAt: FieldValue.serverTimestamp(),
    });

    updatedItemIds.add(line.itemId);
  }

  try {
    await batch.commit();
    console.log(`[StockAdj] Updated stock for ${updatedItemIds.size} items`);
  } catch (err) {
    console.error(`[StockAdj] Failed to update stock for adjustment ${adjustmentId}:`, err);
    await db.collection('stock_adjustments').doc(adjustmentId).update({
      qboSyncStatus: 'failed',
      qboSyncError: `Stock update failed: ${err.message}`,
    });
    return;
  }

  // 1b. Update stockLevels and record movements for audit trail
  for (const line of lineItems) {
    if (!line.itemId || line.quantity === 0) continue;
    const qtyChange = line.direction === 'increase' ? line.quantity : -line.quantity;

    try {
      // Find or create stockLevel for this item
      const slSnap = await db.collection('stockLevels')
        .where('inventoryItemId', '==', line.itemId)
        .limit(1)
        .get();

      let stockLevelId;
      if (slSnap.empty) {
        // Create a new stockLevel document
        const newSl = await db.collection('stockLevels').add({
          inventoryItemId: line.itemId,
          warehouseId: 'default',
          sku: line.itemSku || '',
          itemName: line.itemName || '',
          quantityOnHand: qtyChange,
          quantityAllocated: 0,
          quantityAvailable: qtyChange,
          reorderPoint: 0,
          maxStock: 0,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });
        stockLevelId = newSl.id;
      } else {
        stockLevelId = slSnap.docs[0].id;
        await db.collection('stockLevels').doc(stockLevelId).update({
          quantityOnHand: FieldValue.increment(qtyChange),
          quantityAvailable: FieldValue.increment(qtyChange),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      // Record movement for audit trail
      await db.collection('stockLevels').doc(stockLevelId)
        .collection('movements').add({
          type: 'adjustment',
          quantity: qtyChange,
          referenceType: 'stock_adjustment',
          referenceId: adjustmentId,
          notes: `${data.adjustmentNumber || adjustmentId}: ${line.direction} ${line.quantity} (counted: ${line.countedQuantity ?? 'N/A'}, system: ${line.currentStock ?? 'N/A'})`,
          performedBy: data.approvedBy || 'system',
          createdAt: FieldValue.serverTimestamp(),
        });
    } catch (err) {
      console.warn(`[StockAdj] Failed to update stockLevel for item ${line.itemId}:`, err.message);
    }
  }

  // 2. Recalculate stockAvailable and stockValuation for each updated item
  for (const itemId of updatedItemIds) {
    try {
      const itemDoc = await db.collection('inventoryItems').doc(itemId).get();
      if (!itemDoc.exists) continue;

      const itemData = itemDoc.data();
      const stockOnHand = itemData.stockOnHand || 0;
      const inStock = itemData.inventory?.inStock || stockOnHand;
      const stockAllocated = itemData.stockAllocated || 0;
      const unitCost = itemData.pricing?.costPerUnit || 0;

      await db.collection('inventoryItems').doc(itemId).update({
        stockAvailable: inStock - stockAllocated,
        stockValuation: inStock * unitCost,
      });
    } catch (err) {
      console.warn(`[StockAdj] Failed to recalculate stock for item ${itemId}:`, err.message);
    }
  }

  // 2b. Handle offcut adjustments — update offcut status in the library
  if (data.adjustmentType === 'offcut_adjustment') {
    for (const line of lineItems) {
      if (!line.offcutId) continue;
      try {
        const offcutRef = db.collection('offcuts').doc(line.offcutId);
        const offcutDoc = await offcutRef.get();
        if (!offcutDoc.exists) {
          console.warn(`[StockAdj] Offcut ${line.offcutId} not found, skipping`);
          continue;
        }

        if (line.direction === 'decrease') {
          // Scrapping / writing off the offcut
          await offcutRef.update({
            status: 'scrapped',
            scrappedAt: FieldValue.serverTimestamp(),
            scrappedReason: `Stock adjustment ${data.adjustmentNumber || adjustmentId}: ${data.reason || 'Adjusted'}`,
          });
          console.log(`[StockAdj] Scrapped offcut ${line.offcutId}`);
        }
        // 'increase' direction on offcuts not typical, but could be used
        // to re-register a previously scrapped offcut — handled separately if needed
      } catch (err) {
        console.warn(`[StockAdj] Failed to update offcut ${line.offcutId}:`, err.message);
      }
    }
  }

  // 3. Determine if QBO journal entry is needed
  const noJournalTypes = ['internal_transfer', 'reclassification'];
  if (noJournalTypes.includes(data.adjustmentType)) {
    await db.collection('stock_adjustments').doc(adjustmentId).update({
      qboSyncStatus: 'not_applicable',
    });
    console.log(`[StockAdj] No QBO journal needed for ${data.adjustmentType}`);
  }
  // QBO sync will be handled separately by syncStockAdjustmentToQBO callable

  // 4. Emit business event
  await db.collection('business_events').add({
    type: 'stock_adjustment_approved',
    entityType: 'stock_adjustment',
    entityId: adjustmentId,
    data: {
      adjustmentNumber: data.adjustmentNumber,
      adjustmentType: data.adjustmentType,
      netValueImpact: data.netValueImpact,
      lineCount: data.lineCount,
      isAutoApproved: data.isAutoApproved || false,
      approvedBy: data.approvedBy,
      itemIds: [...updatedItemIds],
    },
    timestamp: FieldValue.serverTimestamp(),
  });

  console.log(`[StockAdj] Approved adjustment ${adjustmentId} processed successfully`);
}
