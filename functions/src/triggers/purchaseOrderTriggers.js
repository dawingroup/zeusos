/**
 * Purchase Order Triggers - DawinOS v2.0
 * Cloud Function triggers for Purchase Order lifecycle events
 * Creates business events when POs are created or status changes
 */

const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

/**
 * Helper: Create a business event for procurement
 */
async function createProcurementEvent({
  eventType,
  severity,
  entityId,
  entityName,
  title,
  description,
  previousState,
  currentState,
  changedFields,
  triggeredBy,
  metadata,
}) {
  const eventData = {
    eventType,
    category: 'procurement',
    severity: severity || 'medium',
    sourceModule: 'procurement',
    subsidiary: 'finishes',
    entityType: 'purchase_order',
    entityId,
    entityName: entityName || '',
    projectId: null,
    projectName: null,
    title,
    description: description || '',
    previousState: previousState || null,
    currentState: currentState || null,
    changedFields: changedFields || [],
    triggeredBy: triggeredBy || 'system',
    triggeredByName: 'System',
    metadata: metadata || {},
    status: 'pending',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    processedAt: null,
  };

  const ref = await db.collection('businessEvents').add(eventData);
  logger.info(`Created procurement event: ${eventType} (${ref.id})`);
  return ref.id;
}

/**
 * Trigger: Purchase Order Created
 */
exports.onPurchaseOrderCreated = onDocumentCreated(
  { document: 'purchaseOrders/{poId}', region: 'us-central1' },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    logger.info(`PO created: ${data.poNumber}`);

    await createProcurementEvent({
      eventType: 'purchase_order_created',
      severity: 'low',
      entityId: event.params.poId,
      entityName: data.poNumber,
      title: `New Purchase Order: ${data.poNumber}`,
      description: `Purchase order created for supplier ${data.supplierName}. ${data.lineItems?.length || 0} line items. Subtotal: ${data.totals?.subtotal?.toLocaleString() || 0} ${data.totals?.currency || 'UGX'}.`,
      currentState: { status: data.status },
      triggeredBy: data.createdBy,
      metadata: {
        poNumber: data.poNumber,
        supplierId: data.supplierId,
        supplierName: data.supplierName,
        lineItemCount: data.lineItems?.length || 0,
        subtotal: data.totals?.subtotal || 0,
        currency: data.totals?.currency || 'UGX',
      },
    });
  }
);

/**
 * Trigger: Purchase Order Updated
 * Detects status transitions and goods receipt
 */
exports.onPurchaseOrderUpdated = onDocumentUpdated(
  { document: 'purchaseOrders/{poId}', region: 'us-central1' },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    const poId = event.params.poId;

    // Detect status changes
    if (before.status !== after.status) {
      // Submitted for approval
      if (after.status === 'pending-approval') {
        await createProcurementEvent({
          eventType: 'purchase_order_submitted_for_approval',
          severity: 'medium',
          entityId: poId,
          entityName: after.poNumber,
          title: `PO Submitted for Approval: ${after.poNumber}`,
          description: `Purchase order for ${after.supplierName} submitted for approval. Total: ${after.totals?.grandTotal?.toLocaleString() || 0} ${after.totals?.currency || 'UGX'}.`,
          previousState: { status: before.status },
          currentState: { status: after.status },
          changedFields: ['status'],
          triggeredBy: after.updatedBy || 'system',
          metadata: {
            supplierName: after.supplierName,
            grandTotal: after.totals?.grandTotal || 0,
          },
        });
      }

      // Approved
      if (after.status === 'approved') {
        await createProcurementEvent({
          eventType: 'purchase_order_approved',
          severity: 'medium',
          entityId: poId,
          entityName: after.poNumber,
          title: `PO Approved: ${after.poNumber}`,
          description: `Purchase order approved. Ready to be sent to supplier ${after.supplierName}.`,
          previousState: { status: before.status },
          currentState: { status: after.status },
          changedFields: ['status'],
          triggeredBy: after.approval?.approvedBy || 'system',
        });
      }

      // Rejected
      if (after.status === 'rejected') {
        await createProcurementEvent({
          eventType: 'purchase_order_rejected',
          severity: 'high',
          entityId: poId,
          entityName: after.poNumber,
          title: `PO Rejected: ${after.poNumber}`,
          description: `Purchase order rejected. Reason: ${after.approval?.rejectionReason || 'Not specified'}.`,
          previousState: { status: before.status },
          currentState: { status: after.status },
          changedFields: ['status'],
          triggeredBy: after.approval?.approvedBy || 'system',
          metadata: { rejectionReason: after.approval?.rejectionReason },
        });
      }

      // Sent to supplier
      if (after.status === 'sent') {
        await createProcurementEvent({
          eventType: 'purchase_order_sent',
          severity: 'low',
          entityId: poId,
          entityName: after.poNumber,
          title: `PO Sent: ${after.poNumber}`,
          description: `Purchase order sent to supplier ${after.supplierName}.`,
          previousState: { status: before.status },
          currentState: { status: after.status },
          changedFields: ['status'],
          triggeredBy: after.updatedBy || 'system',
        });
      }

      // Goods received (partially or fully)
      if (
        (after.status === 'partially-received' || after.status === 'received') &&
        before.status !== 'partially-received' && before.status !== 'received'
      ) {
        await createProcurementEvent({
          eventType: 'goods_received',
          severity: 'medium',
          entityId: poId,
          entityName: after.poNumber,
          title: `Goods Received: ${after.poNumber}`,
          description: `Goods received for PO from ${after.supplierName}. Status: ${after.status}.`,
          previousState: { status: before.status },
          currentState: { status: after.status },
          changedFields: ['status', 'goodsReceipts'],
          triggeredBy: after.updatedBy || 'system',
          metadata: {
            receiptCount: after.goodsReceipts?.length || 0,
          },
        });
      }

      // Closed
      if (after.status === 'closed') {
        await createProcurementEvent({
          eventType: 'purchase_order_closed',
          severity: 'low',
          entityId: poId,
          entityName: after.poNumber,
          title: `PO Closed: ${after.poNumber}`,
          description: `Purchase order closed. All goods received and accounted for.`,
          previousState: { status: before.status },
          currentState: { status: after.status },
          changedFields: ['status'],
          triggeredBy: after.updatedBy || 'system',
        });
      }

      // ============================================
      // BUDGET COMMITMENT TRACKING
      // Update commitment snapshot when PO enters/leaves committed statuses
      // ============================================
      const committedStatuses = ['approved', 'sent', 'partially-received'];
      const wasCommitted = committedStatuses.includes(before.status);
      const isCommitted = committedStatuses.includes(after.status);

      if (wasCommitted !== isCommitted) {
        // PO entered or exited committed status — update commitment snapshot
        try {
          const subsidiaryId = after.subsidiaryId || 'finishes';
          const snapshotRef = db.collection('commitmentSnapshots').doc(subsidiaryId);
          const snapshotDoc = await snapshotRef.get();
          const currentTotal = snapshotDoc.exists ? (snapshotDoc.data().totalCommitted || 0) : 0;
          const grandTotal = after.totals?.grandTotal || 0;

          if (isCommitted && !wasCommitted) {
            // Entering committed status — add to total
            await snapshotRef.set({
              totalCommitted: currentTotal + grandTotal,
              currency: after.totals?.currency || 'UGX',
              lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
              poCount: admin.firestore.FieldValue.increment(1),
            }, { merge: true });
            logger.info(`Budget commitment +${grandTotal} for PO ${after.poNumber}`);
          } else if (wasCommitted && !isCommitted) {
            // Leaving committed status — subtract from total
            await snapshotRef.set({
              totalCommitted: Math.max(0, currentTotal - grandTotal),
              lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
              poCount: admin.firestore.FieldValue.increment(-1),
            }, { merge: true });
            logger.info(`Budget commitment -${grandTotal} for PO ${after.poNumber}`);
          }
        } catch (err) {
          logger.warn('Failed to update commitment snapshot:', err.message);
        }
      }
    }
  }
);
